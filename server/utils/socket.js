const {
    handlePlayerTimeout,
    countAttemptMarks,
    hasEndMark,
    stripEndMarks,
    enforceAttemptLimit,
    getSyncAndNonstopState,
    calculateWinnerScore,
    applySetterObservers,
    revertSetterObservers,
    markTeamVictory,
    updateSyncProgress,
    runStandardFlow,
    clearGameTimeoutTimers
} = require('./gameplay');
const { createLogger } = require('./logger');
const CryptoJS = require('crypto-js');

const AES_SECRET = process.env.AES_SECRET || 'My-Secret-Key';

/**
 * Socket.io 连接处理与房间管理入口
 * @param {Object} io - Socket.io 实例
 * @param {Map} rooms - 房间存储映射
 */
function setupSocket(io, rooms) {
    io.on('connection', (socket) => {
        const log = createLogger('socket', socket.id);

        const normalizeCharacterId = (id) => {
            if (id === undefined || id === null) return null;
            const normalized = String(id).trim();
            return normalized ? normalized : null;
        };

        const decryptCharacter = (character) => {
            if (!character) return null;
            if (typeof character === 'object') return character;
            if (typeof character !== 'string') return null;

            try {
                const text = CryptoJS.AES.decrypt(character, AES_SECRET).toString(CryptoJS.enc.Utf8);
                return text ? JSON.parse(text) : null;
            } catch (_error) {
                return null;
            }
        };

        const ensureGlobalPickState = (currentGame) => {
            if (!currentGame) return null;
            if (!currentGame.globalPickState) {
                currentGame.globalPickState = {
                    firstGuessByCharacter: new Map(),
                    firstRoundByCharacter: new Map(),
                    byPlayer: new Map()
                };
            }
            return currentGame.globalPickState;
        };

        const rebuildGlobalPickState = (currentGame) => {
            if (!currentGame) return;
            const state = {
                firstGuessByCharacter: new Map(),
                firstRoundByCharacter: new Map(),
                byPlayer: new Map()
            };
            const syncMode = !!currentGame?.settings?.syncMode;

            (currentGame.guesses || []).forEach(playerHistory => {
                const playerKey = typeof playerHistory?.username === 'string' ? playerHistory.username : '';
                if (!playerKey) return;
                const guesses = Array.isArray(playerHistory?.guesses) ? playerHistory.guesses : [];
                guesses.forEach(entry => {
                    const characterId = normalizeCharacterId(entry?.guessData?.id);
                    if (!characterId) return;

                    if (!state.byPlayer.has(playerKey)) {
                        state.byPlayer.set(playerKey, new Set());
                    }
                    state.byPlayer.get(playerKey).add(characterId);

                    if (syncMode) {
                        const round = Number.isFinite(entry?.round)
                            ? entry.round
                            : (Number(currentGame?.syncRound) || 1);
                        const prev = state.firstRoundByCharacter.get(characterId);
                        if (!Number.isFinite(prev) || round < prev) {
                            state.firstRoundByCharacter.set(characterId, round);
                        }
                    } else if (!state.firstGuessByCharacter.has(characterId)) {
                        state.firstGuessByCharacter.set(characterId, playerKey);
                    }
                });
            });

            currentGame.globalPickState = state;
        };

        const recordGlobalPick = (currentGame, player, characterId, roundOverride = null) => {
            if (!currentGame || !player || !characterId) return;
            const state = ensureGlobalPickState(currentGame);
            if (!state) return;
            const playerKey = typeof player.username === 'string' ? player.username : '';
            if (!playerKey) return;

            if (!state.byPlayer.has(playerKey)) {
                state.byPlayer.set(playerKey, new Set());
            }
            state.byPlayer.get(playerKey).add(characterId);

            if (currentGame.settings?.syncMode) {
                const round = Number.isFinite(roundOverride)
                    ? roundOverride
                    : (Number(currentGame.syncRound) || 1);
                const prev = state.firstRoundByCharacter.get(characterId);
                if (!Number.isFinite(prev) || round < prev) {
                    state.firstRoundByCharacter.set(characterId, round);
                }
            } else if (!state.firstGuessByCharacter.has(characterId)) {
                state.firstGuessByCharacter.set(characterId, playerKey);
            }
        };

        const getPlayerGuessRecord = (currentGame, player) => {
            if (!currentGame || !player || !Array.isArray(currentGame.guesses)) return null;
            return currentGame.guesses.find(g => g.username === player.username) || null;
        };

        const getPlayerGuessEntries = (currentGame, player) => {
            const record = getPlayerGuessRecord(currentGame, player);
            return Array.isArray(record?.guesses) ? record.guesses : [];
        };

        const hasPlayerGuessedCharacter = (currentGame, player, characterId) => {
            if (!characterId || !currentGame || !player) return false;
            const playerKey = player.username;
            const state = currentGame.globalPickState;
            if (state?.byPlayer && playerKey) {
                const picked = state.byPlayer.get(playerKey);
                if (picked?.has(characterId)) return true;
            }
            return getPlayerGuessEntries(currentGame, player)
                .some(g => normalizeCharacterId(g?.guessData?.id) === characterId);
        };

        const hasAcceptedCorrectGuess = (currentGame, player) => {
            const answerId = currentGame?.answerCharacterId || normalizeCharacterId(decryptCharacter(currentGame?.character)?.id);
            if (!answerId) return false;
            return getPlayerGuessEntries(currentGame, player)
                .some(g => (g?.playerId === player.id || g?.playerName === player.username) && g?.isCorrect && normalizeCharacterId(g?.guessData?.id) === answerId);
        };

        const shouldBypassGlobalPickForAnswer = (settings, isAnswer) => {
            if (!isAnswer) return false;
            return !!(settings?.syncMode || settings?.nonstopMode);
        };

        const validateGlobalPick = (currentGame, player, guessData, isAnswer) => {
            const settings = currentGame?.settings || {};
            if (!settings.globalPick) return { allowed: true };

            const characterId = normalizeCharacterId(guessData?.id);
            if (!characterId) return { allowed: false, message: '猜测数据无效' };

            // A player may repeat their own accepted guess. This matches the client-side BP rule
            // and avoids self-locking when another player also guessed the same character.
            if (hasPlayerGuessedCharacter(currentGame, player, characterId)) {
                return { allowed: true };
            }

            if (shouldBypassGlobalPickForAnswer(settings, isAnswer)) {
                return { allowed: true };
            }

            const state = ensureGlobalPickState(currentGame);
            if (!state) return { allowed: true };

            if (settings.syncMode) {
                const currentRound = Number(currentGame?.syncRound) || 1;
                const firstRound = state.firstRoundByCharacter?.get(characterId);
                return Number.isFinite(firstRound) && firstRound < currentRound
                    ? { allowed: false, message: '【全局BP】该角色已经被其他玩家猜过了' }
                    : { allowed: true };
            }

            const firstGuesser = state.firstGuessByCharacter?.get(characterId);
            return firstGuesser && firstGuesser !== player.username
                ? { allowed: false, message: '【全局BP】该角色已经被其他玩家猜过了' }
                : { allowed: true };
        };

        const getActiveTeamMembers = (room, teamId) => {
            if (!room || !teamId || teamId === '0') return [];
            return room.players.filter(p => p.team === teamId && !p.isAnswerSetter && !p.disconnected);
        };

        const markSyncCompletedForPlayer = (room, player) => {
            if (!room?.currentGame?.settings?.syncMode || !room.currentGame.syncPlayersCompleted || !player) return;
            const round = room.currentGame.syncRound || 1;
            const markOne = (target) => {
                if (!target || target.isAnswerSetter || target.team === '0' || target.disconnected) return;
                room.currentGame.syncPlayersCompleted.add(target.id);
                target.syncCompletedRound = round;
            };

            if (player.team && player.team !== '0') {
                getActiveTeamMembers(room, player.team).forEach(markOne);
            } else {
                markOne(player);
            }
        };

        const syncTeamGuesses = (room, teamId) => {
            if (!room?.currentGame || !teamId || teamId === '0') return;
            const updated = String(room.currentGame.teamGuesses?.[teamId] || '');
            getActiveTeamMembers(room, teamId).forEach(teammate => {
                teammate.guesses = updated;
            });
        };

        const appendEndMarkForPlayerOrTeam = (room, player, endMark, { temporaryObserver = true } = {}) => {
            if (!room?.currentGame || !player) return;
            if (player.team && player.team !== '0') {
                room.currentGame.teamGuesses = room.currentGame.teamGuesses || {};
                room.currentGame.teamGuesses[player.team] = stripEndMarks(room.currentGame.teamGuesses[player.team] || '') + endMark;
                syncTeamGuesses(room, player.team);
                getActiveTeamMembers(room, player.team).forEach(teammate => {
                    if (temporaryObserver) teammate._tempObserver = true;
                    markSyncCompletedForPlayer(room, teammate);
                });
                return;
            }

            player.guesses = stripEndMarks(player.guesses || '') + endMark;
            if (temporaryObserver) player._tempObserver = true;
            markSyncCompletedForPlayer(room, player);
        };

        const migrateSocketReferences = (roomId, room, previousSocketId, nextSocketId, player = null) => {
            if (!room?.currentGame || !previousSocketId || !nextSocketId || previousSocketId === nextSocketId) return;
            const currentGame = room.currentGame;

            const replaceId = (id) => id === previousSocketId ? nextSocketId : id;
            const replaceRevealerId = (list) => {
                if (!Array.isArray(list)) return;
                list.forEach(entry => {
                    if (!entry || !Array.isArray(entry.revealer)) return;
                    entry.revealer = Array.from(new Set(entry.revealer.map(replaceId).filter(Boolean)));
                });
            };

            replaceRevealerId(currentGame.tagBanState);
            replaceRevealerId(currentGame.tagBanStatePending);

            (currentGame.guesses || []).forEach(playerHistory => {
                if (!Array.isArray(playerHistory?.guesses)) return;
                playerHistory.guesses.forEach(entry => {
                    if (entry?.playerId === previousSocketId) entry.playerId = nextSocketId;
                });
            });

            if (currentGame.syncPlayersCompleted?.has(previousSocketId)) {
                currentGame.syncPlayersCompleted.delete(previousSocketId);
                currentGame.syncPlayersCompleted.add(nextSocketId);
            }
            if (player && typeof player.syncCompletedRound === 'number' && player.syncCompletedRound === currentGame.syncRound) {
                currentGame.syncPlayersCompleted?.add(nextSocketId);
            }

            (currentGame.nonstopWinners || []).forEach(winner => {
                if (winner?.id === previousSocketId) winner.id = nextSocketId;
            });
            if (currentGame.firstWinner?.id === previousSocketId) currentGame.firstWinner.id = nextSocketId;
            if (currentGame.syncWinner?.id === previousSocketId) currentGame.syncWinner.id = nextSocketId;
            rebindTimeoutTimer(roomId, room, previousSocketId, nextSocketId);
        };

        const removePlayerRoundReferences = (room, player) => {
            if (!room?.currentGame || !player) return;
            const currentGame = room.currentGame;
            const playerId = player.id;
            const username = player.username;

            currentGame.syncPlayersCompleted?.delete(playerId);
            currentGame.nonstopWinners = (currentGame.nonstopWinners || []).filter(w => w?.id !== playerId && w?.username !== username);
            if (currentGame.firstWinner?.id === playerId || currentGame.firstWinner?.username === username) {
                currentGame.firstWinner = null;
            }
            if (currentGame.syncWinner?.id === playerId || currentGame.syncWinner?.username === username) {
                currentGame.syncWinner = null;
                currentGame.syncWinnerFound = false;
            }
            currentGame.guesses = (currentGame.guesses || []).filter(history => history?.username !== username);
            [currentGame.tagBanState, currentGame.tagBanStatePending].forEach(list => {
                if (!Array.isArray(list)) return;
                list.forEach(entry => {
                    if (entry && Array.isArray(entry.revealer)) {
                        entry.revealer = entry.revealer.filter(id => id !== playerId);
                    }
                });
            });
            rebuildGlobalPickState(currentGame);
        };

        const settleNonstopCorrectGuess = (room, roomId, player) => {
            if (!room?.currentGame || !player) return null;
            room.currentGame.nonstopWinners = room.currentGame.nonstopWinners || [];
            if (room.currentGame.nonstopWinners.some(w => w.id === player.id || w.username === player.username)) {
                return { alreadySettled: true };
            }

            const rawGuessCount = countAttemptMarks(player.guesses);
            const answerId = room.currentGame.answerCharacterId || normalizeCharacterId(decryptCharacter(room.currentGame.character)?.id);
            const isBigWin = rawGuessCount === 1 || (answerId && normalizeCharacterId(player.avatarId) === answerId);
            player.guesses = stripEndMarks(player.guesses || '') + (isBigWin ? '👑' : '✌');

            if (player.team && player.team !== '0') {
                markTeamVictory(room, roomId, player, io);
                const teamMark = isBigWin ? '👑' : '✌';
                if (!String(room.currentGame.teamGuesses?.[player.team] || '').includes(teamMark)) {
                    room.currentGame.teamGuesses[player.team] = (room.currentGame.teamGuesses[player.team] || '') + teamMark;
                }
                syncTeamGuesses(room, player.team);
            }
            markSyncCompletedForPlayer(room, player);

            const initialTotalPlayers = room.currentGame?.nonstopTotalPlayers || 1;
            const winnersCount = room.currentGame?.nonstopWinners?.length || 0;
            const winnerRank = winnersCount + 1;
            const rankScore = Math.max(1, initialTotalPlayers - winnersCount);
            const totalRounds = room.currentGame?.settings?.maxAttempts || 10;
            const scoreResult = calculateWinnerScore({ guesses: player.guesses, baseScore: rankScore, totalRounds });
            const score = scoreResult.totalScore;
            player.score += score;
            room.currentGame.nonstopWinners.push({
                id: player.id,
                username: player.username,
                isBigWin,
                team: player.team,
                score,
                bonuses: scoreResult.bonuses
            });

            return { isBigWin, score, rank: winnerRank };
        };

        const settleStandardCorrectGuess = (room, roomId, player) => {
            if (!room?.currentGame || !player) return null;
            const rawGuessCount = countAttemptMarks(player.guesses);
            const answerId = room.currentGame.answerCharacterId || normalizeCharacterId(decryptCharacter(room.currentGame.character)?.id);
            const isBigWin = rawGuessCount === 1 || (answerId && normalizeCharacterId(player.avatarId) === answerId);
            const finalResult = isBigWin ? 'bigwin' : 'win';

            player.guesses = stripEndMarks(player.guesses || '') + (isBigWin ? '👑' : '✌');
            if (isBigWin) {
                if (!room.currentGame.firstWinner || !room.currentGame.firstWinner.isBigWin) {
                    room.currentGame.firstWinner = { id: player.id, username: player.username, isBigWin: true, timestamp: Date.now() };
                }
            } else if (!room.currentGame.firstWinner) {
                room.currentGame.firstWinner = { id: player.id, username: player.username, isBigWin: false, timestamp: Date.now() };
            }

            if (player.team && player.team !== '0') {
                markTeamVictory(room, roomId, player, io);
                const teamMark = isBigWin ? '👑' : '✌';
                if (!String(room.currentGame.teamGuesses?.[player.team] || '').includes(teamMark)) {
                    room.currentGame.teamGuesses[player.team] = (room.currentGame.teamGuesses[player.team] || '') + teamMark;
                }
                syncTeamGuesses(room, player.team);
            }

            if (room.currentGame?.settings?.syncMode) {
                room.currentGame.syncWinnerFound = true;
                room.currentGame.syncWinner = { id: player.id, username: player.username, isBigWin };
            }
            markSyncCompletedForPlayer(room, player);

            return { finalResult, isBigWin };
        };

        const isSocketStillInRoom = (socketId, roomId) => {
            if (!socketId || !roomId) return false;
            const targetSocket = io.sockets.sockets.get(socketId);
            if (!targetSocket) return false;
            const roomSet = io.sockets.adapter.rooms.get(roomId);
            return !!roomSet && roomSet.has(socketId);
        };

        const emitError = (code, message) => {
            log.warn(`${code}: ${message}`);
            socket.emit('error', { message: `${code}: ${message}` });
        };

        /**
         * 获取房间对象，不存在时发送错误消息
         * @param {string} roomId - 房间 ID
         * @param {string} code - 错误代码标签
         * @returns {Object|null} - 房间对象或 null
         */
        const getRoom = (roomId, code) => {
            const room = rooms.get(roomId);
            if (!room) {
                emitError(code, '房间不存在');
                return null;
            }
            return room;
        };

        const PLAYER_BROADCAST_COOLDOWN = 120; // ms，合并短时间内的玩家列表广播
        const broadcastPlayers = (roomId, room, extra = {}) => {
            if (!room) return;
            const now = Date.now();
            const forceImmediate = !!extra.forceImmediate;
            const sanitizedExtra = { ...extra };
            delete sanitizedExtra.forceImmediate;

            const buildPayload = (extraPayload = {}) => ({
                players: room.players,
                isPublic: room.isPublic,
                answerSetterId: room.answerSetterId,
                ...extraPayload
            });

            const emitPayload = (payload) => {
                room._lastPlayersBroadcastAt = Date.now();
                room._pendingPlayerBroadcastExtra = null;
                if (room._playerBroadcastTimer) {
                    clearTimeout(room._playerBroadcastTimer);
                    room._playerBroadcastTimer = null;
                }
                io.to(roomId).emit('updatePlayers', payload);
            };

            const mergedExtra = { ...(room._pendingPlayerBroadcastExtra || {}), ...sanitizedExtra };
            const lastAt = room._lastPlayersBroadcastAt || 0;
            const elapsed = now - lastAt;

            if (forceImmediate || elapsed >= PLAYER_BROADCAST_COOLDOWN) {
                emitPayload(buildPayload(mergedExtra));
                return;
            }

            room._pendingPlayerBroadcastExtra = mergedExtra;
            if (!room._playerBroadcastTimer) {
                const delay = Math.max(10, PLAYER_BROADCAST_COOLDOWN - elapsed);
                room._playerBroadcastTimer = setTimeout(() => {
                    room._playerBroadcastTimer = null;
                    const pendingExtra = room._pendingPlayerBroadcastExtra || {};
                    room._pendingPlayerBroadcastExtra = null;
                    emitPayload(buildPayload(pendingExtra));
                }, delay);
            }
        };

        /**
         * 广播房间的同步/血战状态
         * @param {string} roomId - 房间 ID
         * @param {Object} room - 房间对象
         */
        const broadcastState = (roomId, room) => {
            getSyncAndNonstopState(room, (eventName, data) => io.to(roomId).emit(eventName, data));
        };

/**
 * 发送当前对局快照（用于重连/旁观加入）。
 * 会将 gameStart、猜测历史、tagBan 状态按需推送给目标 socket，避免重复广播全房间。
 * @param {Object} options - 快照选项
 * @param {string} options.roomId - 房间 ID
 * @param {Object} options.room - 房间对象
 * @param {Object} options.targetSocket - 目标 socket 对象
 * @param {Object} options.playerContext - 玩家上下文（包含 isAnswerSetter 等）
 * @param {boolean} options.broadcastState - 是否广播状态给全房间
 */
        const emitGameSnapshot = ({ roomId, room, targetSocket, playerContext, broadcastState: shouldBroadcastState = false }) => {
            if (!room?.currentGame || !room.currentGame.character || !targetSocket) return;
            const isAnswerSetter = playerContext ? !!playerContext.isAnswerSetter : false;
            targetSocket.emit('updatePlayers', {
                players: room.players,
                isPublic: room.isPublic,
                answerSetterId: room.answerSetterId
            });
            targetSocket.emit('gameStart', {
                character: room.currentGame.character,
                settings: room.currentGame?.settings,
                players: room.players,
                isPublic: room.isPublic,
                hints: room.currentGame?.hints || null,
                isAnswerSetter
            });
            if (room.currentGame) {
                targetSocket.emit('guessHistoryUpdate', buildGuessHistoryPayload(room.currentGame));
            }
            targetSocket.emit('tagBanStateUpdate', {
                tagBanState: Array.isArray(room.currentGame.tagBanState) ? room.currentGame.tagBanState : []
            });
            if (shouldBroadcastState) broadcastState(roomId, room);
        };

        const buildGuessHistoryPayload = (currentGame) => ({
            guesses: Array.isArray(currentGame?.guesses) ? currentGame.guesses : [],
            teamGuesses: currentGame?.teamGuesses || {}
        });

        const getTimeoutLimitMs = (currentGame) => {
            const seconds = Number(currentGame?.settings?.timeLimit);
            if (!Number.isFinite(seconds) || seconds <= 0) return 0;
            return Math.max(10, Math.round(seconds * 1000));
        };

        const getSyncCompleted = (currentGame, player) => {
            if (!currentGame?.settings?.syncMode || !player) return false;
            const round = currentGame.syncRound || 1;
            return player.syncCompletedRound === round || currentGame.syncPlayersCompleted?.has(player.id);
        };

        const getTeamTimeoutMembers = (room, teamId) => getActiveTeamMembers(room, teamId)
            .filter(p => !p._tempObserver && p.team !== '0');

        const getTimeoutEntityForPlayer = (room, player) => {
            const currentGame = room?.currentGame;
            if (!currentGame || !player) return null;
            if (player.isAnswerSetter || player.team === '0' || player.disconnected || player._tempObserver) return null;

            const settings = currentGame.settings || {};
            const maxAttempts = Number(settings.maxAttempts) || 10;

            if (player.team && player.team !== '0') {
                const members = getTeamTimeoutMembers(room, player.team);
                if (!members.length) return null;
                const source = String(currentGame.teamGuesses?.[player.team] || '');
                if (hasEndMark(source) || countAttemptMarks(source) >= maxAttempts) return null;
                if (settings.syncMode && members.every(member => getSyncCompleted(currentGame, member))) return null;
                return {
                    key: `team:${player.team}`,
                    player: members[0],
                    players: members,
                    source
                };
            }

            const source = String(player.guesses || '');
            if (hasEndMark(source) || countAttemptMarks(source) >= maxAttempts) return null;
            if (getSyncCompleted(currentGame, player)) return null;
            return {
                key: `player:${player.id}`,
                player,
                players: [player],
                source
            };
        };

        const getTimeoutEntityByKey = (room, key) => {
            if (!room?.currentGame || !key) return null;
            if (key.startsWith('team:')) {
                const teamId = key.slice('team:'.length);
                const player = getTeamTimeoutMembers(room, teamId)[0];
                return player ? getTimeoutEntityForPlayer(room, player) : null;
            }
            if (key.startsWith('player:')) {
                const playerId = key.slice('player:'.length);
                const player = room.players.find(p => p.id === playerId);
                return player ? getTimeoutEntityForPlayer(room, player) : null;
            }
            return null;
        };

        const listActiveTimeoutEntities = (room) => {
            const seen = new Set();
            const entities = [];
            (room?.players || []).forEach(player => {
                const entity = getTimeoutEntityForPlayer(room, player);
                if (!entity || seen.has(entity.key)) return;
                seen.add(entity.key);
                entities.push(entity);
            });
            return entities;
        };

        const ensureTimeoutTimers = (currentGame) => {
            if (!currentGame._timeoutTimers) currentGame._timeoutTimers = new Map();
            if (!(currentGame._timeoutTimers instanceof Map)) currentGame._timeoutTimers = new Map();
            if (!Number.isFinite(currentGame._timeoutSeq)) currentGame._timeoutSeq = 0;
            return currentGame._timeoutTimers;
        };

        const clearTimeoutRecord = (timers, key) => {
            timers?.delete(key);
        };

        const emitTimerResetForEntity = (entity, deadlineAt) => {
            (entity?.players || []).forEach(player => {
                if (player?.id) io.to(player.id).emit('resetTimer', { deadlineAt });
            });
        };

        const clearRoomTimeoutTick = (room) => {
            const currentGame = room?.currentGame;
            if (!currentGame) return;
            if (currentGame._timeoutTick) {
                clearTimeout(currentGame._timeoutTick);
                currentGame._timeoutTick = null;
            }
            currentGame._timeoutNextAt = null;
        };

        const processDueTimeouts = (roomId) => {
            const room = rooms.get(roomId);
            const currentGame = room?.currentGame;
            const timers = currentGame?._timeoutTimers;
            if (!room || !currentGame || !(timers instanceof Map)) return;

            currentGame._timeoutTick = null;
            currentGame._timeoutNextAt = null;

            const now = Date.now();
            const due = [];
            timers.forEach((record, key) => {
                if (!record) return;
                if (record.deadlineAt <= now + 5) {
                    due.push({ key, token: record.token });
                }
            });

            due.forEach(({ key, token }) => {
                processServerTimeout(roomId, key, token, { requireDue: false });
            });

            rescheduleRoomTimeoutTick(roomId, room);
        };

        const rescheduleRoomTimeoutTick = (roomId, room) => {
            const currentGame = room?.currentGame;
            const timers = currentGame?._timeoutTimers;
            if (!currentGame || !(timers instanceof Map) || timers.size === 0) {
                clearRoomTimeoutTick(room);
                return;
            }

            let nextAt = null;
            for (const record of timers.values()) {
                if (!record) continue;
                if (nextAt === null || record.deadlineAt < nextAt) {
                    nextAt = record.deadlineAt;
                }
            }

            if (!Number.isFinite(nextAt)) {
                clearRoomTimeoutTick(room);
                return;
            }

            if (currentGame._timeoutTick && Number.isFinite(currentGame._timeoutNextAt)) {
                if (Math.abs(currentGame._timeoutNextAt - nextAt) < 5) {
                    return;
                }
            }

            clearRoomTimeoutTick(room);
            currentGame._timeoutNextAt = nextAt;
            currentGame._timeoutTick = setTimeout(() => {
                processDueTimeouts(roomId);
            }, Math.max(0, nextAt - Date.now()));
        };

        const processServerTimeout = (roomId, entityKey, token, { requireDue = true } = {}) => {
            const room = rooms.get(roomId);
            const currentGame = room?.currentGame;
            const timers = currentGame?._timeoutTimers;
            const record = timers instanceof Map ? timers.get(entityKey) : null;
            if (!room || !currentGame || !record || record.token !== token) {
                return { applied: false, reason: 'stale' };
            }
            if (requireDue && Date.now() + 5 < record.deadlineAt) {
                return { applied: false, reason: 'not_due' };
            }

            clearTimeoutRecord(timers, entityKey);
            const entity = getTimeoutEntityByKey(room, entityKey);
            if (!entity) {
                return { applied: false, reason: 'inactive' };
            }

            handlePlayerTimeout(room, entity.player, io, roomId);
            if (room.currentGame) {
                io.to(roomId).emit('guessHistoryUpdate', buildGuessHistoryPayload(room.currentGame));
            }
            const finalized = runFlowAndRefresh(roomId, room);
            if (!finalized && room.currentGame) {
                scheduleActiveTimeouts(roomId, room, { resetExisting: false });
            }
            rescheduleRoomTimeoutTick(roomId, room);
            return { applied: true };
        };

        const scheduleTimeoutForEntity = (roomId, room, entity, { deadlineAt = null, emitReset = true } = {}) => {
            const currentGame = room?.currentGame;
            const limitMs = getTimeoutLimitMs(currentGame);
            if (!currentGame || !entity || limitMs <= 0) return;

            const timers = ensureTimeoutTimers(currentGame);
            clearTimeoutRecord(timers, entity.key);

            currentGame._timeoutSeq += 1;
            const now = Date.now();
            const targetDeadline = deadlineAt && deadlineAt > now ? deadlineAt : now + limitMs;
            const token = `${now}:${currentGame._timeoutSeq}:${entity.key}`;
            const record = {
                key: entity.key,
                token,
                deadlineAt: targetDeadline,
                round: currentGame.syncRound || 1
            };
            timers.set(entity.key, record);
            if (emitReset) emitTimerResetForEntity(entity, targetDeadline);
            rescheduleRoomTimeoutTick(roomId, room);
        };

        const cleanupTimeoutTimers = (room) => {
            const currentGame = room?.currentGame;
            const timers = currentGame?._timeoutTimers;
            if (!(timers instanceof Map)) return;
            const limitMs = getTimeoutLimitMs(currentGame);
            for (const [key, record] of timers.entries()) {
                const entity = getTimeoutEntityByKey(room, key);
                const staleRound = currentGame?.settings?.syncMode && record.round !== (currentGame.syncRound || 1);
                if (limitMs <= 0 || !entity || staleRound) {
                    clearTimeoutRecord(timers, key);
                }
            }
        };

        const scheduleActiveTimeouts = (roomId, room, { resetExisting = false } = {}) => {
            const currentGame = room?.currentGame;
            const limitMs = getTimeoutLimitMs(currentGame);
            if (!currentGame || limitMs <= 0) {
                clearGameTimeoutTimers(currentGame);
                return;
            }
            cleanupTimeoutTimers(room);
            const timers = ensureTimeoutTimers(currentGame);
            listActiveTimeoutEntities(room).forEach(entity => {
                if (resetExisting || !timers.has(entity.key)) {
                    scheduleTimeoutForEntity(roomId, room, entity);
                }
            });
            rescheduleRoomTimeoutTick(roomId, room);
        };

        const resetTimeoutForPlayer = (roomId, room, player) => {
            cleanupTimeoutTimers(room);
            const entity = getTimeoutEntityForPlayer(room, player);
            if (entity) scheduleTimeoutForEntity(roomId, room, entity);
        };

        const applyDueTimeoutForPlayer = (roomId, room, player) => {
            const entity = getTimeoutEntityForPlayer(room, player);
            const timers = room?.currentGame?._timeoutTimers;
            const record = entity && timers instanceof Map ? timers.get(entity.key) : null;
            if (!record) return { applied: false, reason: 'not_scheduled' };
            return processServerTimeout(roomId, entity.key, record.token);
        };

        const rebindTimeoutTimer = (roomId, room, previousSocketId, nextSocketId) => {
            const currentGame = room?.currentGame;
            const timers = currentGame?._timeoutTimers;
            if (!(timers instanceof Map)) return;
            const oldKey = `player:${previousSocketId}`;
            const record = timers.get(oldKey);
            if (!record) return;
            const deadlineAt = record.deadlineAt;
            clearTimeoutRecord(timers, oldKey);
            const entity = getTimeoutEntityByKey(room, `player:${nextSocketId}`);
            if (entity) scheduleTimeoutForEntity(roomId, room, entity, { deadlineAt });
        };

        /**
         * 统一的标准流程入口，自动在未结算时补充玩家广播。
         * @param {string} roomId - 房间 ID
         * @param {Object} room - 房间对象
         * @param {Object} options - 流程选项（broadcastState、broadcastPlayers 等）
         * @returns {boolean} - 是否已完成结算
         */
        const runFlowAndRefresh = (roomId, room, options = {}) => {
            const { finalized } = runStandardFlow(room, roomId, io, options);
            if (!finalized && room?.currentGame && options.scheduleTimeouts !== false) {
                scheduleActiveTimeouts(roomId, room, { resetExisting: false });
            }
            if (!finalized && options.broadcastPlayers !== false) {
                broadcastPlayers(roomId, room);
            }
            return finalized;
        };

        log.info('connected');

        /**
         * 创建房间事件处理
         * @event createRoom
         * @param {string} roomId - 新房间 ID
         * @param {string} username - 创建者用户名
         * @param {number} [avatarId] - 头像 ID
         * @param {string} [avatarImage] - 头像图片 URL
         */
        socket.on('createRoom', ({ roomId, username, avatarId, avatarImage }) => {
            if (!username || !username.trim()) return emitError('createRoom', '用户名呢');
            if (rooms.has(roomId)) return emitError('createRoom', '房间已存在');
            if (rooms.size >= 259) return emitError('createRoom', '服务器已满，请稍后再试');

            rooms.set(roomId, {
                host: socket.id,
                isPublic: true,
                players: [{
                    id: socket.id,
                    username,
                    isHost: true,
                    score: 0,
                    ready: false,
                    guesses: '',
                    message: '',
                    team: null,
                    disconnected: false,
                    ...(avatarId !== undefined && { avatarId }),
                    ...(avatarImage !== undefined && { avatarImage })
                }],
                roomName: '',
                lastActive: Date.now()
            });

            socket.join(roomId);
            broadcastPlayers(roomId, rooms.get(roomId));
            socket.emit('roomNameUpdated', { roomName: rooms.get(roomId).roomName || '' });
            log.info(`room ${roomId} created by ${username}`);
        });

        /**
         * 加入房间事件处理
         * 若房间不存在则创建；若正在游戏中作为旁观者加入；若重连则恢复状态
         * @event joinRoom
         * @param {string} roomId - 房间 ID
         * @param {string} username - 玩家用户名
         * @param {number} [avatarId] - 头像 ID
         * @param {string} [avatarImage] - 头像图片 URL
         */
        socket.on('joinRoom', ({ roomId, username, avatarId, avatarImage }) => {
            if (!username || !username.trim()) return emitError('joinRoom', '用户名呢');
            let room = rooms.get(roomId);

            if (!room) {
                rooms.set(roomId, {
                    host: socket.id,
                    isPublic: true,
                    players: [{
                        id: socket.id,
                        username,
                        isHost: true,
                        score: 0,
                        ready: false,
                        guesses: '',
                        message: '',
                        team: null,
                        disconnected: false,
                        ...(avatarId !== undefined && { avatarId }),
                        ...(avatarImage !== undefined && { avatarImage })
                    }],
                    roomName: '',
                    lastActive: Date.now()
                });
                socket.join(roomId);
                broadcastPlayers(roomId, rooms.get(roomId));
                socket.emit('roomNameUpdated', { roomName: rooms.get(roomId).roomName || '' });
                log.info(`room ${roomId} created by ${username}`);
                return;
            }

            // if game in progress new player observer
            if (room.currentGame) {
                log.info(`[join observer] room ${roomId} in progress`);
            }

            const existingPlayerIndex = room.players.findIndex(p => p.username.toLowerCase() === username.toLowerCase());
            if (existingPlayerIndex !== -1) {
                const existingPlayer = room.players[existingPlayerIndex];
                if (existingPlayer.disconnected) {
                    const normalizeAvatarId = (id) => (id === undefined || id === null) ? '' : String(id);
                    const prevAvatarId = normalizeAvatarId(existingPlayer.avatarId);
                    const incomingAvatarId = normalizeAvatarId(avatarId);
                    if (prevAvatarId !== incomingAvatarId) {
                        log.warn(`avatar mismatch for ${username} during reconnect: expected ${prevAvatarId || '<empty>'} got ${incomingAvatarId || '<empty>'}`);
                        return emitError('joinRoom', '头像信息不一致，无法重连');
                    }
                    const previousSocketId = existingPlayer.id;
                    existingPlayer.id = socket.id;
                    existingPlayer.disconnected = false;
                    if (avatarId !== undefined) existingPlayer.avatarId = avatarId;
                    if (avatarImage !== undefined) existingPlayer.avatarImage = avatarImage;

                    migrateSocketReferences(roomId, room, previousSocketId, socket.id, existingPlayer);

                    socket.join(roomId);
                    broadcastPlayers(roomId, room, { forceImmediate: true });
                    socket.emit('roomNameUpdated', { roomName: room.roomName || '' });

                    if (room.currentGame && room.currentGame.character) {
                        emitGameSnapshot({ roomId, room, targetSocket: socket, playerContext: existingPlayer, broadcastState: true });
                    }
                    log.info(`${username} reconnected to room ${roomId}`);
                    return;
                }
                const staleSocket = !isSocketStillInRoom(existingPlayer.id, roomId);
                if (staleSocket) {
                    log.warn(`stale socket detected for ${username}; forcing reconnect bind`);
                    existingPlayer.disconnected = true;
                    const previousSocketId = existingPlayer.id;
                    existingPlayer.id = socket.id;
                    existingPlayer.disconnected = false;
                    if (avatarId !== undefined) existingPlayer.avatarId = avatarId;
                    if (avatarImage !== undefined) existingPlayer.avatarImage = avatarImage;

                    migrateSocketReferences(roomId, room, previousSocketId, socket.id, existingPlayer);

                    socket.join(roomId);
                    broadcastPlayers(roomId, room, { forceImmediate: true });
                    socket.emit('roomNameUpdated', { roomName: room.roomName || '' });
                    if (room.currentGame && room.currentGame.character) {
                        emitGameSnapshot({ roomId, room, targetSocket: socket, playerContext: existingPlayer, broadcastState: true });
                    }
                    log.info(`${username} rebound to room ${roomId} from stale socket`);
                    return;
                }
                return emitError('joinRoom', '换个名字吧');
            }

            if (avatarId !== undefined) {
                const isAvatarTaken = room.players.some(player => !player.disconnected && player.avatarId !== undefined && String(player.avatarId) !== '0' && String(player.avatarId) === String(avatarId));
                if (isAvatarTaken) {
                    return emitError('joinRoom', '头像已被选用');
                }
            }

            room.players.push({
                id: socket.id,
                username,
                isHost: false,
                score: 0,
                ready: false,
                guesses: '',
                message: '',
                team: room.currentGame ? '0' : null,
                joinedDuringGame: !!room.currentGame,
                disconnected: false,
                ...(avatarId !== undefined && { avatarId }),
                ...(avatarImage !== undefined && { avatarImage })
            });

            socket.join(roomId);
            broadcastPlayers(roomId, room);
            socket.emit('roomNameUpdated', { roomName: room.roomName || '' });

            if (room.currentGame && room.currentGame.character) {
                emitGameSnapshot({ roomId, room, targetSocket: socket, playerContext: { isAnswerSetter: false }, broadcastState: true });
            }

            log.info(`${username} joined room ${roomId}`);
        });

        /**
         * 准备就绪状态切换事件
         * @event toggleReady
         * @param {string} roomId - 房间 ID
         */
        socket.on('toggleReady', ({ roomId }) => {
            const room = getRoom(roomId, 'toggleReady');
            if (!room) return;
            const player = room.players.find(p => p.id === socket.id);
            if (!player) return emitError('toggleReady', '连接中断了');
            if (player.isHost) return emitError('toggleReady', '房主不需要准备');
            if (room.currentGame) return emitError('toggleReady', '游戏进行中不能更改准备状态');
            player.ready = !player.ready;
            broadcastPlayers(roomId, room, { answerSetterId: room.answerSetterId });
            log.info(`player ${player.username} ready=${player.ready}`);
        });

        /**
         * 更新游戏设置事件（仅房主可用）
         * @event updateGameSettings
         * @param {string} roomId - 房间 ID
         * @param {Object} settings - 游戏设置对象
         */
        socket.on('updateGameSettings', ({ roomId, settings }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectUpdate = (message) => {
                emitError('updateGameSettings', message);
                respond({ ok: false, message: `updateGameSettings: ${message}` });
            };
            const room = getRoom(roomId, 'updateGameSettings');
            if (!room) return respond({ ok: false, message: 'updateGameSettings: 房间不存在' });
            const player = room.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return rejectUpdate('只有房主可以更改设置');
            if (room.currentGame) return rejectUpdate('游戏进行中不能更改设置');
            room.settings = settings;
            io.to(roomId).emit('updateGameSettings', { settings });
            room.lastActive = Date.now();
            log.info(`settings updated in ${roomId}`);
            respond({ ok: true, settings });
        });

        /**
         * 游戏状态初始化（内部 helper）
         * @param {Object} room - 房间对象
         * @param {Object} character - 对局角色对象
         * @param {Object} settings - 游戏设置
         * @param {Array} hints - 提示列表
         * @param {string} answerSetterId - 出题人的 socket ID
         */
        const initGameState = (room, character, settings, hints, answerSetterId) => {
            const answerCharacter = decryptCharacter(character);
            const answerCharacterId = normalizeCharacterId(answerCharacter?.id);
            // 计算初始的活跃玩家数（用于血战模式基础分计算）：仅统计“能猜测”的玩家
            // - 排除出题人
            // - 排除旁观者队伍（team==='0'）
            // - 排除临时旁观（_tempObserver）
            // - 排除断线玩家
            const initialActivePlayers = room.players.filter(p => {
                if (!p || p.disconnected) return false;
                if (p.team === '0') return false;
                if (p._tempObserver) return false;
                if (answerSetterId && p.id === answerSetterId) return false;
                return true;
            }).length;
            
            room.currentGame = {
                character,
                answerCharacterId,
                settings,
                guesses: [],
                teamGuesses: {},
                hints: hints || null,
                syncRound: 1,
                syncPlayersCompleted: new Set(),
                syncWinnerFound: false,
                syncWinner: null,
                syncReadyToEnd: false,
                syncRoundStartRank: 1,
                nonstopWinners: [],
                firstWinner: null,
                tagBanState: [],
                tagBanStatePending: [],
                nonstopTotalPlayers: initialActivePlayers,  // 记录初始玩家数，用于基础分计算
                _lastSyncWaitingKey: null,
                _lastSyncWaitingAt: 0,
                _timeoutTimers: new Map(),
                _timeoutSeq: 0,
                _timeoutTick: null,
                _timeoutNextAt: null,
                globalPickState: {
                    firstGuessByCharacter: new Map(),
                    firstRoundByCharacter: new Map(),
                    byPlayer: new Map()
                }
            };

            room.players.forEach(p => {
                p.guesses = '';
                // 清理上一局的临时观战/同步完成标记，避免新一局直接处于观战或死亡视角
                if (p._tempObserver) delete p._tempObserver;
                if (typeof p.syncCompletedRound === 'number') delete p.syncCompletedRound;
                p.isAnswerSetter = (p.id === answerSetterId);
                if (!p.isAnswerSetter && p.team !== '0') {
                    room.currentGame.guesses.push({ username: p.username, guesses: [] });
                }
            });
            room.players.forEach(p => {
                if (p.team && p.team !== '0' && !(p.team in room.currentGame.teamGuesses)) {
                    room.currentGame.teamGuesses[p.team] = '';
                }
            });
        };

        /**
         * 开始游戏事件处理
         * @event gameStart
         * @param {string} roomId - 房间 ID
         * @param {Object} character - 对局角色对象
         * @param {Object} settings - 游戏设置
         */
        socket.on('gameStart', ({ roomId, character, settings }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectStart = (message) => {
                emitError('gameStart', message);
                respond({ ok: false, message: `gameStart: ${message}` });
            };

            const room = getRoom(roomId, 'gameStart');
            if (!room) return respond({ ok: false, message: 'gameStart: 房间不存在' });
            const player = room.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return rejectStart('只有房主可以开始游戏');
            if (room.currentGame) return rejectStart('游戏已经在进行中');
            if (!normalizeCharacterId(decryptCharacter(character)?.id)) return rejectStart('答案数据无效');
            const allReady = room.players.every(p => p.isHost || p.ready || p.disconnected);
            if (!allReady) return rejectStart('所有玩家必须准备好才能开始游戏');
            room.players = room.players.filter(p => !p.disconnected || p.score > 0);
            initGameState(room, character, settings || room.settings, null, null);
            io.to(roomId).emit('gameStart', { character, settings: room.currentGame.settings, players: room.players, isPublic: room.isPublic, isGameStarted: true });
            io.to(roomId).emit('tagBanStateUpdate', { tagBanState: [] });
            // 游戏开始时发送初始进度（同步模式和血战模式）
            getSyncAndNonstopState(room, (eventName, data) => {
                io.to(roomId).emit(eventName, data);
            });
            scheduleActiveTimeouts(roomId, room, { resetExisting: true });
            room.lastActive = Date.now();
            log.info(`game started in ${roomId}`);
            respond({ ok: true });
        });

        /**
         * 玩家猜测事件处理
         * 处理单个猜测、队伍得分、同步进度、自动淘汰等逻辑
         * @event playerGuess
         * @param {string} roomId - 房间 ID
         * @param {Object} guessResult - 猜测结果对象 { guessData, isCorrect, isPartialCorrect }
         */
        socket.on('playerGuess', ({ roomId, guessResult }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectGuess = (code, message) => {
                emitError(code, message);
                respond({ ok: false, message: `${code}: ${message}` });
            };

            const room = getRoom(roomId, 'playerGuess');
            if (!room) return respond({ ok: false, message: 'playerGuess: 房间不存在' });
            room.lastActive = Date.now();
            const player = room.players.find(p => p.id === socket.id);
            if (!player) return rejectGuess('playerGuess', '连接中断了');
            if (!room.currentGame) return rejectGuess('playerGuess', '游戏未开始或已结束');

            const dueTimeoutResult = applyDueTimeoutForPlayer(roomId, room, player);
            if (dueTimeoutResult.applied) {
                return rejectGuess('playerGuess', '已超时，请重新等待本轮状态');
            }
            if (!room.currentGame) return rejectGuess('playerGuess', '游戏未开始或已结束');

            const hasEnded = ['✌','👑','💀','🏳️','🏆'].some(mark => player.guesses.includes(mark));
            // 检查是否为旁观者：team='0' 或被标记为临时观战者
            if (player.isAnswerSetter) return rejectGuess('playerGuess', '出题人不能猜测');
            if (player.team === '0' || player._tempObserver) return rejectGuess('playerGuess', '观战中不能猜测');
            if (hasEnded) return rejectGuess('playerGuess', '游戏已结束，不能继续猜测');

            const guessData = guessResult?.guessData;
            if (!guessData || guessData.id === undefined || guessData.id === null) {
                return rejectGuess('playerGuess', '猜测数据无效');
            }
            const characterId = normalizeCharacterId(guessData.id);
            const answerId = room.currentGame.answerCharacterId || normalizeCharacterId(decryptCharacter(room.currentGame.character)?.id);
            if (!answerId) return rejectGuess('playerGuess', '答案数据无效');
            const isCorrect = characterId === answerId;
            const isPartialCorrect = !isCorrect && !!guessResult?.isPartialCorrect;

            const settings = room.currentGame.settings || {};
            if (settings.syncMode && getSyncCompleted(room.currentGame, player)) {
                return rejectGuess('playerGuess', '本轮已经完成，请等待下一轮');
            }

            // 统一在写入猜测前检查次数上限（个人/团队/同步模式均适用）
            const preLimit = enforceAttemptLimit(room, player, io, roomId, { isCorrect: false });
            if (preLimit.exhausted) {
                socket.emit('updatePlayers', {
                    players: room.players,
                    isPublic: room.isPublic,
                    answerSetterId: room.answerSetterId
                });
                io.to(roomId).emit('guessHistoryUpdate', {
                    guesses: room.currentGame?.guesses,
                    teamGuesses: room.currentGame?.teamGuesses
                });
                broadcastPlayers(roomId, room);
                runFlowAndRefresh(roomId, room);
                return rejectGuess('playerGuess', '已用尽可用次数');
            }

            const globalPickResult = validateGlobalPick(room.currentGame, player, guessData, isCorrect);
            if (!globalPickResult.allowed) {
                return rejectGuess('playerGuess', globalPickResult.message || '【全局BP】该角色已经被其他玩家猜过了');
            }

            const playerGuesses = room.currentGame.guesses.find(g => g.username === player.username);
            if (!playerGuesses) {
                return rejectGuess('playerGuess', '当前玩家不能猜测');
            }
            if (playerGuesses) {
                const entry = {
                    playerId: socket.id,
                    playerName: player.username,
                    isCorrect,
                    isPartialCorrect,
                    guessData,
                    round: room.currentGame?.settings?.syncMode ? (room.currentGame.syncRound || 1) : null
                };
                playerGuesses.guesses.push(entry);
                if (settings.globalPick) {
                    recordGlobalPick(room.currentGame, player, characterId, entry.round);
                }
                room.players.forEach(target => {
                    if (target.id === socket.id || target.isAnswerSetter || target.team === '0' || target.team === player.team || target._tempObserver) {
                        io.to(target.id).emit('guessHistoryUpdate', { guesses: room.currentGame?.guesses, teamGuesses: room.currentGame?.teamGuesses });
                    }
                });
            }

            if (guessData) {
                const serialized = { ...guessData };
                if (serialized.rawTags instanceof Map) serialized.rawTags = Array.from(serialized.rawTags.entries());
                room.players.filter(p => p.id !== socket.id && ((p.team !== null && p.team === player.team && !p.isAnswerSetter) || p.team === '0' || p.isAnswerSetter)).forEach(recipient => {
                    io.to(recipient.id).emit('boardcastTeamGuess', { guessData: { ...serialized, guessrName: player.username }, playerId: socket.id, playerName: player.username });
                });
            }

            const mark = (!isCorrect && isPartialCorrect) ? '💡' : (isCorrect ? '✔' : '❌');
            if (player.team && player.team !== '0') {
                if (room.currentGame && !room.currentGame.teamGuesses) room.currentGame.teamGuesses = {};
                if (room.currentGame?.teamGuesses) {
                    room.currentGame.teamGuesses[player.team] = (room.currentGame.teamGuesses[player.team] || '') + mark;
                    room.players.filter(p => p.team === player.team && !p.isAnswerSetter && !p.disconnected).forEach(teammate => {
                        teammate.guesses = room.currentGame.teamGuesses[player.team];
                    });
                }
            } else {
                player.guesses += mark;
            }

            let settlement = null;
            if (isCorrect) {
                settlement = room.currentGame?.settings?.nonstopMode
                    ? settleNonstopCorrectGuess(room, roomId, player)
                    : settleStandardCorrectGuess(room, roomId, player);
            } else {
                markSyncCompletedForPlayer(room, player);
                enforceAttemptLimit(room, player, io, roomId, { isCorrect: false });
            }

            broadcastPlayers(roomId, room);
            if (guessData && guessData.name) {
                log.info(`guess ${guessData.name} ${isCorrect ? 'correct' : 'incorrect'}`);
            }

            // 标准流程统一判定
            const finalized = runFlowAndRefresh(roomId, room);
            if (!finalized && room.currentGame) {
                if (!settings.syncMode && !isCorrect) {
                    resetTimeoutForPlayer(roomId, room, player);
                } else {
                    scheduleActiveTimeouts(roomId, room, { resetExisting: false });
                }
            }
            respond({ ok: true, isCorrect, isPartialCorrect, settlement });
        });

        /**
         * 标签禁用共享事件处理（tagBan 模式）
         * @event tagBanSharedMetaTags
         * @param {string} roomId - 房间 ID
         * @param {Array<string>} tags - 禁用标签列表
         */
        socket.on('tagBanSharedMetaTags', ({ roomId, tags }) => {
            const room = getRoom(roomId, 'tagBanSharedMetaTags');
            if (!room || !room.currentGame || !room.currentGame.settings?.tagBan) return;
            const player = room.players.find(p => p.id === socket.id);
            if (!player) return;
            if (!Array.isArray(tags) || !tags.length) return;

            room.currentGame.tagBanState = Array.isArray(room.currentGame.tagBanState) ? room.currentGame.tagBanState : [];
            room.currentGame.tagBanStatePending = Array.isArray(room.currentGame.tagBanStatePending) ? room.currentGame.tagBanStatePending : [];
            const targetList = room.currentGame?.settings?.syncMode ? room.currentGame.tagBanStatePending : room.currentGame.tagBanState;
            let changed = false;
            tags.forEach(tagName => {
                const normalized = typeof tagName === 'string' ? tagName.trim() : '';
                if (!normalized) return;
                if (room.currentGame.tagBanState.find(entry => entry && typeof entry.tag === 'string' && entry.tag.trim() === normalized)) return;
                let entry = targetList.find(item => item && typeof item.tag === 'string' && item.tag.trim() === normalized);
                if (!entry) {
                    entry = { tag: normalized, revealer: [] };
                    targetList.push(entry);
                    changed = true;
                }
                const existing = Array.isArray(entry.revealer) ? entry.revealer : [];
                if (!existing.length || !existing.includes(player.id)) {
                    if (!existing.length) {
                        entry.revealer = [player.id];
                        changed = true;
                    } else {
                        entry.revealer = [...existing, player.id];
                        if (room.currentGame?.settings?.syncMode) {
                            // sync mode: revealers accumulate silently (broadcast deferred)
                        } else {
                            changed = true;
                        }
                    }
                }
            });
            if (!changed || room.currentGame?.settings?.syncMode) return;
            io.to(roomId).emit('tagBanStateUpdate', { tagBanState: Array.isArray(room.currentGame.tagBanState) ? room.currentGame.tagBanState : [] });
        });

        /**
         * 血战模式胜利事件处理
         * @event nonstopWin
         * @param {string} roomId - 房间 ID
         * @param {boolean} isBigWin - 是否为大赢家（一猜即中）
         */
        socket.on('nonstopWin', ({ roomId, isBigWin }) => {
            const room = getRoom(roomId, 'nonstopWin');
            if (!room || !room.currentGame) return emitError('nonstopWin', '房间不存在或游戏未开始');
            room.lastActive = Date.now();
            const player = room.players.find(p => p.id === socket.id);
            if (!player) return emitError('nonstopWin', '连接中断了');
            if (!room.currentGame?.settings?.nonstopMode) return emitError('nonstopWin', '当前不是血战模式');
            if (player.isAnswerSetter || player.team === '0') return emitError('nonstopWin', '观战中不能猜测');
            if (room.currentGame.nonstopWinners?.some(w => w.id === player.id || w.username === player.username)) return;
            if (hasEndMark(player.guesses)) return;
            if (!hasAcceptedCorrectGuess(room.currentGame, player)) return emitError('nonstopWin', '没有有效的正确猜测');

            // 检查是否为旁观者或临时观战者
            if (player._tempObserver) return emitError('nonstopWin', '旁观者无法猜测');
            if (player.team && player.team !== '0') {
                const teammateWon = room.currentGame.nonstopWinners.some(w => {
                    const wPlayer = room.players.find(p => p.id === w.id);
                    return wPlayer && wPlayer.team === player.team;
                });
                if (teammateWon) return emitError('nonstopWin', '你的队友已经猜对了，你无法继续猜测');
            }

            const settlement = settleNonstopCorrectGuess(room, roomId, player);

            broadcastState(roomId, room);
            broadcastPlayers(roomId, room);
            log.info(`[nonstop] ${player.username} rank=${settlement?.rank} score=${settlement?.score}`);

            runFlowAndRefresh(roomId, room);
        });

        /**
         * 游戏结束事件处理
         * 处理投降、胜利、失败、本命胜利等情况
         * @event gameEnd
         * @param {string} roomId - 房间 ID
         * @param {string} result - 结果状态（'surrender'|'win'|'bigwin'|'lose'）
         */
        socket.on('gameEnd', ({ roomId, result }) => {
            const room = getRoom(roomId, 'gameEnd');
            if (!room) return;
            room.lastActive = Date.now();
            const player = room.players.find(p => p.id === socket.id);
            if (!player) return emitError('gameEnd', '连接中断了');
            if (!room.currentGame) return;

            const rawGuessCount = countAttemptMarks(player.guesses);
            const wantsWin = result === 'win' || result === 'bigwin';
            if (wantsWin) {
                if (hasEndMark(player.guesses) && hasAcceptedCorrectGuess(room.currentGame, player)) {
                    return;
                }
                if (player.isAnswerSetter || player.team === '0' || player._tempObserver || hasEndMark(player.guesses)) {
                    return emitError('gameEnd', '游戏已结束，不能改写为胜利');
                }
                if (!hasAcceptedCorrectGuess(room.currentGame, player)) {
                    return emitError('gameEnd', '没有有效的正确猜测');
                }
            } else if (hasEndMark(player.guesses)) {
                return;
            }

            const answerId = room.currentGame.answerCharacterId || normalizeCharacterId(decryptCharacter(room.currentGame.character)?.id);
            const isAvatarBigWin = answerId && normalizeCharacterId(player.avatarId) === answerId;
            const finalResult = wantsWin
                ? ((rawGuessCount === 1 || isAvatarBigWin) ? 'bigwin' : 'win')
                : result;

            switch (finalResult) {
                case 'surrender':
                    appendEndMarkForPlayerOrTeam(room, player, '🏳️', { temporaryObserver: true });
                    break;
                case 'win':
                    settleStandardCorrectGuess(room, roomId, player);
                    break;
                case 'bigwin':
                    settleStandardCorrectGuess(room, roomId, player);
                    break;
                default:
                    appendEndMarkForPlayerOrTeam(room, player, '💀', { temporaryObserver: true });
            }

            runFlowAndRefresh(roomId, room);
            log.info(`gameEnd ${player.username} result=${result}`);
        });

        /**
         * 进入旁观模式事件处理
         * @event enterObserverMode
         * @param {string} roomId - 房间 ID
         */
        socket.on('enterObserverMode', ({ roomId }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectObserver = (message) => {
                emitError('enterObserverMode', message);
                respond({ ok: false, message: `enterObserverMode: ${message}` });
            };

            const room = getRoom(roomId, 'enterObserverMode');
            if (!room) return respond({ ok: false, message: 'enterObserverMode: 房间不存在' });
            room.lastActive = Date.now();
            const player = room.players.find(p => p.id === socket.id);
            if (!player) return rejectObserver('连接中断了');

            // 仅允许在游戏进行中进入观战；避免跨局/延迟事件污染当前局状态
            if (!room.currentGame) return rejectObserver('游戏未开始或已结束');

            const currentMarkSource = (player.team && player.team !== '0')
                ? String(room.currentGame?.teamGuesses?.[player.team] || player.guesses || '')
                : String(player.guesses || '');
            const hasEndedMark = ['✌','👑','💀','🏳️','🏆'].some(m => currentMarkSource.includes(m));

            // 若已耗尽尝试次数，则应判定为死亡（💀），而不是投降（🏳️）。
            // 这可以覆盖“最后一次猜测为同作品(💡)导致 left==0 后误触发 enterObserverMode”一类边界情况。
            const maxAttempts = room.currentGame?.settings?.maxAttempts || 10;
            const countSource = (player.team && player.team !== '0')
                ? String(room.currentGame?.teamGuesses?.[player.team] || '')
                : String(player.guesses || '');
            const attemptCount = countAttemptMarks(countSource);

            if (!hasEndedMark) {
                const endMark = attemptCount >= maxAttempts ? '💀' : '🏳️';
                appendEndMarkForPlayerOrTeam(room, player, endMark, { temporaryObserver: true });
            }

            if (!player.team || player.team === '0') {
                player._tempObserver = true;
            }

            broadcastPlayers(roomId, room);
            runFlowAndRefresh(roomId, room);
            respond({ ok: true });
        });

        /**
         * 请求游戏设置事件处理
         * @event requestGameSettings
         * @param {string} roomId - 房间 ID
         */
        socket.on('requestGameSettings', ({ roomId }) => {
            const room = getRoom(roomId, 'requestGameSettings');
            if (!room) return;
            const settings = room.currentGame?.settings || room.settings;
            if (settings) socket.emit('updateGameSettings', { settings });
        });

        /**
         * 旧客户端超时事件兼容。
         * 是否真正超时以服务端计时器为准，到期前的客户端事件不会扣次数。
         * @event timeOut
         * @param {string} roomId - 房间 ID
         */
        socket.on('timeOut', ({ roomId }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const room = getRoom(roomId, 'timeOut');
            if (!room) return respond({ ok: false, message: 'timeOut: 房间不存在' });
            const player = room.players.find(p => p.id === socket.id);
            if (!player) {
                emitError('timeOut', '连接中断了');
                return respond({ ok: false, message: 'timeOut: 连接中断了' });
            }
            if (!room.currentGame) {
                emitError('timeOut', '游戏未开始或已结束');
                return respond({ ok: false, message: 'timeOut: 游戏未开始或已结束' });
            }

            const result = applyDueTimeoutForPlayer(roomId, room, player);
            if (!result.applied) {
                return respond({ ok: false, message: 'timeOut: 服务端计时尚未到期' });
            }
            respond({ ok: true });
        });

        /**
         * 断连事件处理
         * 处理房主转移、临时观战恢复、同步清理等
         * @event disconnect
         */
        socket.on('disconnect', () => {
            for (const [roomId, room] of rooms.entries()) {
                const idx = room.players.findIndex(p => p.id === socket.id);
                if (idx === -1) continue;
                const disconnectedPlayer = room.players[idx];

                // If the disconnected player was the designated answer setter, clean up and cancel the wait
                if (room.answerSetterId && room.answerSetterId === disconnectedPlayer.id) {
                    room.answerSetterId = null;
                    room.waitingForAnswer = false;
                    revertSetterObservers(room, roomId, io);
                    io.to(roomId).emit('waitForAnswerCanceled', { message: `指定的出题人 ${disconnectedPlayer.username} 已离开，等待被取消` });
                }

                if (room.host === socket.id) {
                    const newHost = room.players.find(p => !p.disconnected && p.id !== socket.id);
                    if (newHost) {
                        room.host = newHost.id;
                        const newHostIndex = room.players.findIndex(p => p.id === newHost.id);
                        if (newHostIndex !== -1) {
                            room.players[newHostIndex].isHost = true;
                            room.players[newHostIndex].ready = false;
                        }
                        disconnectedPlayer.isHost = false;
                        disconnectedPlayer.disconnected = true;
                        io.to(roomId).emit('hostTransferred', { oldHostName: disconnectedPlayer.username, newHostId: newHost.id, newHostName: newHost.username });
                        broadcastPlayers(roomId, room, { isPublic: room.isPublic, answerSetterId: room.answerSetterId });
                    } else {
                        clearGameTimeoutTimers(room.currentGame);
                        rooms.delete(roomId);
                        io.to(roomId).emit('roomClosed', { message: '房主已断开连接，房间已关闭' });
                    }
                } else {
                    disconnectedPlayer.disconnected = true;
                    broadcastPlayers(roomId, room, { isPublic: room.isPublic, answerSetterId: room.answerSetterId });
                    if (room.currentGame && room.currentGame.settings?.syncMode && room.currentGame.syncPlayersCompleted) {
                        updateSyncProgress(room, roomId, io);
                    }
                }

                if (room.currentGame) {
                    runFlowAndRefresh(roomId, room, { broadcastState: true });
                }
                break;
            }
            log.info('disconnected');
        });

        /**
         * 房间可见性切换事件处理（仅房主可用）
         * @event toggleRoomVisibility
         * @param {string} roomId - 房间 ID
         */
        socket.on('toggleRoomVisibility', ({ roomId }) => {
            const room = getRoom(roomId, 'toggleRoomVisibility');
            if (!room) return;
            const player = room.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return emitError('toggleRoomVisibility', '只有房主可以更改房间状态');
            room.isPublic = !room.isPublic;
            broadcastPlayers(roomId, room);
        });

        /**
         * 更新房间名称事件处理（仅房主可用）
         * @event updateRoomName
         * @param {string} roomId - 房间 ID
         * @param {string} roomName - 新房间名称
         */
        socket.on('updateRoomName', ({ roomId, roomName }) => {
            const room = getRoom(roomId, 'updateRoomName');
            if (!room) return;
            const player = room.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return emitError('updateRoomName', '只有房主可以修改房名');
            let normalizedName = '';
            if (typeof roomName === 'string') normalizedName = roomName.trim().slice(0, 30);
            room.roomName = normalizedName;
            io.to(roomId).emit('roomNameUpdated', { roomName: normalizedName });
        });

        /**
         * 进入手动出题模式事件处理（仅房主可用）
         * @event enterManualMode
         * @param {string} roomId - 房间 ID
         */
        socket.on('enterManualMode', ({ roomId }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectManual = (message) => {
                emitError('enterManualMode', message);
                respond({ ok: false, message: `enterManualMode: ${message}` });
            };
            const room = getRoom(roomId, 'enterManualMode');
            if (!room) return respond({ ok: false, message: 'enterManualMode: 房间不存在' });
            const player = room.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return rejectManual('只有房主可以进入出题模式');
            if (room.currentGame) return rejectManual('游戏进行中不能进入出题模式');
            room.players.forEach(p => { if (!p.isHost) p.ready = true; });
            broadcastPlayers(roomId, room, { isPublic: room.isPublic });
            respond({ ok: true });
        });

        /**
         * 设置出题人事件处理（仅房主可用）
         * @event setAnswerSetter
         * @param {string} roomId - 房间 ID
         * @param {string} setterId - 出题人的 socket ID
         */
        socket.on('setAnswerSetter', ({ roomId, setterId }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectSetter = (message) => {
                emitError('setAnswerSetter', message);
                respond({ ok: false, message: `setAnswerSetter: ${message}` });
            };
            const room = getRoom(roomId, 'setAnswerSetter');
            if (!room) return respond({ ok: false, message: 'setAnswerSetter: 房间不存在' });
            const player = room.players.find(p => p.id === socket.id);
            if (!player || !player.isHost) return rejectSetter('只有房主可以选择出题人');
            if (room.currentGame) return rejectSetter('游戏进行中不能选择出题人');
            const setter = room.players.find(p => p.id === setterId);
            if (!setter) return rejectSetter('找不到选中的玩家');
            revertSetterObservers(room, roomId, io);
            room.answerSetterId = setterId;
            room.waitingForAnswer = true;
            applySetterObservers(room, roomId, setterId, io);
            io.to(roomId).emit('waitForAnswer', { answerSetterId: setterId, setterUsername: setter.username });
            broadcastPlayers(roomId, room, { answerSetterId: setterId });
            log.info(`answer setter ${setter.username}`);
            respond({ ok: true });
        });

        /**
         * 踢出玩家事件处理（仅房主可用）
         * @event kickPlayer
         * @param {string} roomId - 房间 ID
         * @param {string} playerId - 被踢出玩家的 socket ID
         */
        socket.on('kickPlayer', ({ roomId, playerId }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectKick = (message) => {
                emitError('kickPlayer', message);
                respond({ ok: false, message: `kickPlayer: ${message}` });
            };
            const room = getRoom(roomId, 'kickPlayer');
            if (!room) return respond({ ok: false, message: 'kickPlayer: 房间不存在' });
            const host = room.players.find(p => p.id === socket.id);
            if (!host || !host.isHost) return rejectKick('只有房主可以踢出玩家');
            const playerIndex = room.players.findIndex(p => p.id === playerId);
            if (playerIndex === -1) return rejectKick('找不到要踢出的玩家');
            const playerToKick = room.players[playerIndex];
            if (playerToKick.id === socket.id) return rejectKick('无法踢出自己');

            if (room.answerSetterId && room.answerSetterId === playerToKick.id) {
                room.answerSetterId = null;
                room.waitingForAnswer = false;
                revertSetterObservers(room, roomId, io);
                io.to(roomId).emit('waitForAnswerCanceled', { message: `指定的出题人 ${playerToKick.username} 已被踢出，等待已取消` });
            }

            io.to(playerId).emit('playerKicked', { playerId, username: playerToKick.username });
            if (room.currentGame) {
                removePlayerRoundReferences(room, playerToKick);
            }
            room.players.splice(playerIndex, 1);
            socket.to(roomId).emit('playerKicked', { playerId, username: playerToKick.username });
            broadcastPlayers(roomId, room, { answerSetterId: room.answerSetterId });

            if (room.currentGame && room.currentGame.settings?.syncMode && room.currentGame.syncPlayersCompleted) {
                room.currentGame.syncPlayersCompleted.delete(playerId);
                updateSyncProgress(room, roomId, io);
            }
            if (room.currentGame) runFlowAndRefresh(roomId, room);

            const kickedSocket = io.sockets.sockets.get(playerId);
            if (kickedSocket) kickedSocket.leave(roomId);
            log.info(`kicked ${playerToKick.username}`);
            respond({ ok: true });
        });

        /**
         * 设置答案事件处理（手动出题模式，仅被指定出题人可用）
         * @event setAnswer
         * @param {string} roomId - 房间 ID
         * @param {Object} character - 对局角色对象
         * @param {Array} hints - 提示列表
         */
        socket.on('setAnswer', ({ roomId, character, hints }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectAnswer = (message) => {
                emitError('setAnswer', message);
                respond({ ok: false, message: `setAnswer: ${message}` });
            };
            const room = getRoom(roomId, 'setAnswer');
            if (!room) return respond({ ok: false, message: 'setAnswer: 房间不存在' });
            if (room.currentGame) return rejectAnswer('游戏已经在进行中');
            if (socket.id !== room.answerSetterId) return rejectAnswer('你不是指定的出题人');
            if (!normalizeCharacterId(decryptCharacter(character)?.id)) return rejectAnswer('答案数据无效');
            room.players = room.players.filter(p => !p.disconnected || p.score > 0);
            applySetterObservers(room, roomId, room.answerSetterId, io);
            initGameState(room, character, room.settings, hints, socket.id);
            room.waitingForAnswer = false;
            room.answerSetterId = null;
            if (room.currentGame) {
                socket.emit('guessHistoryUpdate', buildGuessHistoryPayload(room.currentGame));
            }
            broadcastState(roomId, room);
            broadcastPlayers(roomId, room, { answerSetterId: null });
            io.to(roomId).emit('gameStart', { character, settings: room.settings, players: room.players, isPublic: room.isPublic, isGameStarted: true, hints, isAnswerSetter: false });
            io.to(roomId).emit('tagBanStateUpdate', { tagBanState: [] });
            socket.emit('gameStart', { character, settings: room.settings, players: room.players, isPublic: room.isPublic, isGameStarted: true, hints, isAnswerSetter: true });
            if (room.currentGame.settings?.syncMode) updateSyncProgress(room, roomId, io);
            scheduleActiveTimeouts(roomId, room, { resetExisting: true });
            log.info(`custom answer started ${roomId}`);
            respond({ ok: true });
        });

        /**
         * 房主转移事件处理（仅现任房主可用）
         * @event transferHost
         * @param {string} roomId - 房间 ID
         * @param {string} newHostId - 新房主的 socket ID
         */
        socket.on('transferHost', ({ roomId, newHostId }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectTransfer = (message) => {
                emitError('transferHost', message);
                respond({ ok: false, message: `transferHost: ${message}` });
            };
            const room = getRoom(roomId, 'transferHost');
            if (!room) return respond({ ok: false, message: 'transferHost: 房间不存在' });
            if (socket.id !== room.host) return rejectTransfer('只有房主可以转移权限');
            const newHost = room.players.find(p => p.id === newHostId);
            if (!newHost || newHost.disconnected) return rejectTransfer('无法将房主转移给该玩家');
            const currentHost = room.players.find(p => p.id === socket.id);
            room.host = newHostId;
            room.players.forEach(p => { p.isHost = p.id === newHostId; });
            newHost.ready = false;
            io.to(roomId).emit('hostTransferred', { oldHostName: currentHost.username, newHostId: newHost.id, newHostName: newHost.username });
            broadcastPlayers(roomId, room, { answerSetterId: room.answerSetterId });
            respond({ ok: true });
        });

        /**
         * 更新玩家消息事件处理
         * @event updatePlayerMessage
         * @param {string} roomId - 房间 ID
         * @param {string} message - 玩家消息内容
         */
        socket.on('updatePlayerMessage', ({ roomId, message }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const room = getRoom(roomId, 'updatePlayerMessage');
            if (!room) return respond({ ok: false, message: 'updatePlayerMessage: 房间不存在' });
            const player = room.players.find(p => p.id === socket.id);
            if (!player) {
                emitError('updatePlayerMessage', '连接中断了');
                return respond({ ok: false, message: 'updatePlayerMessage: 连接中断了' });
            }
            player.message = message;
            broadcastPlayers(roomId, room, { isPublic: room.isPublic });
            respond({ ok: true });
        });

        /**
         * 更新玩家队伍事件处理
         * @event updatePlayerTeam
         * @param {string} roomId - 房间 ID
         * @param {string} team - 队伍 ID（'0'-'8' 或 null）
         */
        socket.on('updatePlayerTeam', ({ roomId, team }, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') ack(payload);
            };
            const rejectTeam = (message) => {
                emitError('updatePlayerTeam', message);
                respond({ ok: false, message: `updatePlayerTeam: ${message}` });
            };
            const room = getRoom(roomId, 'updatePlayerTeam');
            if (!room) return respond({ ok: false, message: 'updatePlayerTeam: 房间不存在' });
            const player = room.players.find(p => p.id === socket.id);
            if (!player) return rejectTeam('连接中断了');
            if (room.currentGame) return rejectTeam('游戏进行中不能更改队伍');
            if (team !== null && !(typeof team === 'string' && /^[0-8]$/.test(team))) return rejectTeam('Invalid team value');
            player.team = team === '' ? null : team;
            broadcastPlayers(roomId, room, { isPublic: room.isPublic });
            respond({ ok: true, team: player.team });
        });
    });
}

module.exports = setupSocket;
