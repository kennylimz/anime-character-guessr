// ===== Guess mark helpers (shared by socket/gameplay) =====
// Attempt marks: count towards maxAttempts
const ATTEMPT_MARK_RE = /(?:⏱️?|💡|✔|❌)/g;
// End marks: indicate the player/team has ended the round
const END_MARKS = ['✌', '👑', '💀', '🏆', '🏳️'];
const END_MARK_RE = /(?:✌|👑|💀|🏆|🏳️?)/g;

function countAttemptMarks(marks) {
    const s = String(marks || '');
    const m = s.match(ATTEMPT_MARK_RE);
    return m ? m.length : 0;
}

function hasEndMark(marks) {
    const s = String(marks || '');
    return END_MARKS.some(mark => s.includes(mark));
}

function stripEndMarks(marks) {
    return String(marks || '').replace(END_MARK_RE, '');
}

function appendEndMarkOnce(marks, endMark) {
    // Ensure we don't accumulate conflicting end marks (e.g. 💀 + ✌)
    return stripEndMarks(marks) + endMark;
}

function getEndResultFromMarks(marks) {
    const s = String(marks || '');
    if (s.includes('🏆')) return 'teamwin';
    if (s.includes('💀')) return 'lose';
    if (s.includes('🏳️') || s.includes('🏳')) return 'surrender';
    return '';
}

function clearGameTimeoutTimers(currentGame) {
    if (!currentGame) return;
    if (currentGame._timeoutTick) {
        clearTimeout(currentGame._timeoutTick);
        currentGame._timeoutTick = null;
    }
    currentGame._timeoutNextAt = null;
    const timers = currentGame._timeoutTimers;
    if (timers instanceof Map) {
        timers.clear();
    }
}

/**
 * 在服务端统一强制执行“次数耗尽 => 结束(💀)”规则。
 * - 只统计尝试标记（⏱️/💡/✔/❌）
 * - 若已存在结束标记（✌/👑/💀/🏆/🏳️），不重复处理
 * - 若 isCorrect=true，则不自动判死（等待客户端 gameEnd(win/bigwin)）
 */
function enforceAttemptLimit(room, player, io, roomId, { isCorrect = false } = {}) {
    if (!room?.currentGame || !player) return { exhausted: false };

    // 出题人/旁观者/临时观战者不参与次数判定
    if (player.isAnswerSetter || player.team === '0' || player._tempObserver) {
        return { exhausted: false };
    }

    const settings = room.currentGame.settings || {};
    const maxAttempts = settings.maxAttempts || 10;
    const isTeamMode = player.team && player.team !== '0';
    const source = isTeamMode
        ? String(room.currentGame?.teamGuesses?.[player.team] || '')
        : String(player.guesses || '');

    const attemptCount = countAttemptMarks(source);
    if (attemptCount < maxAttempts) {
        return { exhausted: false, attemptCount, maxAttempts };
    }

    // 已结束则不再追加
    if (hasEndMark(source)) {
        return { exhausted: true, alreadyEnded: true, attemptCount, maxAttempts };
    }

    // 最后一发猜中：不要在 gameEnd 之前误判死亡
    if (isCorrect) {
        return { exhausted: true, pendingWin: true, attemptCount, maxAttempts };
    }

    if (isTeamMode) {
        room.currentGame.teamGuesses = room.currentGame.teamGuesses || {};
        room.currentGame.teamGuesses[player.team] = appendEndMarkOnce(room.currentGame.teamGuesses[player.team] || '', '💀');
        const updated = room.currentGame.teamGuesses[player.team];

        room.players
            .filter(p => p.team === player.team && !p.isAnswerSetter && !p.disconnected)
            .forEach(teammate => {
                teammate.guesses = updated;
                if (room.currentGame?.settings?.syncMode && room.currentGame?.syncPlayersCompleted) {
                    room.currentGame.syncPlayersCompleted.add(teammate.id);
                    teammate.syncCompletedRound = room.currentGame.syncRound;
                }
            });
    } else {
        player.guesses = appendEndMarkOnce(player.guesses || '', '💀');
        if (room.currentGame?.settings?.syncMode && room.currentGame?.syncPlayersCompleted) {
            room.currentGame.syncPlayersCompleted.add(player.id);
            player.syncCompletedRound = room.currentGame.syncRound;
        }
    }

    return { exhausted: true, appliedDeath: true, attemptCount, maxAttempts };
}

/**
 * 处理玩家超时事件
 * 标记超时、检查次数耗尽、判定死亡
 * @param {Object} room - 房间对象
 * @param {Object} player - 超时的玩家对象
 * @param {Object} io - Socket.io 实例
 * @param {string} roomId - 房间 ID
 * @returns {Object} - { needsSyncUpdate: boolean, affectedPlayers: Array }
 */
function handlePlayerTimeout(room, player, io, roomId) {
    if (!room?.currentGame || !player) {
        return { needsSyncUpdate: false, affectedPlayers: [] };
    }

    // 出题人/旁观者不处理超时
    if (player.isAnswerSetter || player.team === '0' || player._tempObserver) {
        return { needsSyncUpdate: false, affectedPlayers: [] };
    }

    const timeoutMark = '⏱️';
    const affectedPlayers = [];
    const isTeamMode = player.team && player.team !== '0';

    // 已结束则忽略（避免重复 timeout 污染次数）
    const current = isTeamMode
        ? String(room.currentGame?.teamGuesses?.[player.team] || '')
        : String(player.guesses || '');
    if (hasEndMark(current)) {
        return { needsSyncUpdate: false, affectedPlayers: [] };
    }

    if (isTeamMode) {
        room.currentGame.teamGuesses = room.currentGame.teamGuesses || {};
        const teammates = room.players.filter(p => p.team === player.team && !p.isAnswerSetter && !p.disconnected);
        const timeoutMarks = timeoutMark.repeat(Math.max(1, teammates.length));
        room.currentGame.teamGuesses[player.team] = (room.currentGame.teamGuesses[player.team] || '') + timeoutMarks;
        const updated = room.currentGame.teamGuesses[player.team];

        teammates.forEach(teammate => {
            teammate.guesses = updated;
            affectedPlayers.push(teammate);
            io.to(teammate.id).emit('resetTimer');
        });
    } else {
        player.guesses += timeoutMark;
        affectedPlayers.push(player);
    }

    // 超时后统一执行次数耗尽判定
    enforceAttemptLimit(room, player, io, roomId, { isCorrect: false });

    // 同步模式：超时视为本轮完成
    let needsSyncUpdate = false;
    if (room.currentGame?.settings?.syncMode && room.currentGame?.syncPlayersCompleted) {
        room.currentGame.syncPlayersCompleted.add(player.id);
        player.syncCompletedRound = room.currentGame.syncRound;
        if (isTeamMode) {
            room.players
                .filter(p => p.team === player.team && !p.isAnswerSetter && !p.disconnected)
                .forEach(teammate => {
                    room.currentGame.syncPlayersCompleted.add(teammate.id);
                    teammate.syncCompletedRound = room.currentGame.syncRound;
                });
        }
        needsSyncUpdate = true;
    }

    return { needsSyncUpdate, affectedPlayers };
}

const SYNC_WAITING_MIN_INTERVAL = 150; // ms，限制同步进度广播频率

function buildSyncWaitingKey(round, syncStatus = []) {
    const normalized = [...(syncStatus || [])]
        .map(s => ({ id: String(s.id || ''), completed: !!s.completed }))
        .sort((a, b) => a.id.localeCompare(b.id));
    return `r:${round}|${normalized.map(s => `${s.id}:${s.completed ? 1 : 0}`).join('|')}`;
}

function shouldSkipSyncWaiting(room, payload, { force = false } = {}) {
    if (!room?.currentGame) return true;
    const key = buildSyncWaitingKey(payload.round, payload.syncStatus);
    const now = Date.now();
    const lastKey = room.currentGame._lastSyncWaitingKey;
    const lastAt = room.currentGame._lastSyncWaitingAt || 0;

    if (!force && key === lastKey && now - lastAt < SYNC_WAITING_MIN_INTERVAL) {
        return true;
    }

    room.currentGame._lastSyncWaitingKey = key;
    room.currentGame._lastSyncWaitingAt = now;
    return false;
}

/**
 * 获取同步模式和血战模式状态
 * @param {Object} room - 房间对象，包含 currentGame 和 players
 * @param {Function} emitCallback - 事件发送回调 (eventName, data) => void
 */
function getSyncAndNonstopState(room, emitCallback) {
    if (!room?.currentGame) return;

    const isEnded = p => (
        p.guesses.includes('✌') ||
        p.guesses.includes('💀') ||
        p.guesses.includes('🏳️') ||
        p.guesses.includes('👑') ||
        p.guesses.includes('🏆')
    );

    if (room.currentGame?.settings?.syncMode) {
        const syncPlayers = room.players.filter(p => !p.isAnswerSetter && p.team !== '0' && !p.disconnected && !isEnded(p));
        const syncStatus = syncPlayers.map(p => ({
            id: p.id,
            username: p.username,
            completed: room.currentGame?.syncPlayersCompleted ? room.currentGame.syncPlayersCompleted.has(p.id) : false
        }));
        
        if (emitCallback) {
            const payload = {
                round: room.currentGame?.syncRound,
                syncStatus,
                completedCount: syncStatus.filter(s => s.completed).length,
                totalCount: syncStatus.length
            };
            if (!shouldSkipSyncWaiting(room, payload)) {
                emitCallback('syncWaiting', payload);
            }

            if (room.currentGame?.syncWinnerFound && !room.currentGame?.settings?.nonstopMode) {
                emitCallback('syncGameEnding', {
                    winnerUsername: room.currentGame?.syncWinner?.username,
                    message: `${room.currentGame?.syncWinner?.username} 已猜对！等待本轮结束...`
                });
            }
        }
    }

    if (room.currentGame?.settings?.nonstopMode) {
        const activePlayers = room.players.filter(p => !p.isAnswerSetter && p.team !== '0' && !p.disconnected);
        const remainingPlayers = activePlayers.filter(p => 
            !p.guesses.includes('✌') &&
            !p.guesses.includes('💀') &&
            !p.guesses.includes('🏳️') &&
            !p.guesses.includes('👑') &&
            !p.guesses.includes('🏆')
        );
        
        if (emitCallback) {
            emitCallback('nonstopProgress', {
                winners: (room.currentGame?.nonstopWinners || []).map(w => ({ username: w.username, rank: w.rank, score: w.score })),
                remainingCount: remainingPlayers.length,
                totalCount: activePlayers.length
            });
        }
    }
}

/**
 * 计算玩家胜利得分
 * @param {Object} options - 计算选项
 * @param {string} options.guesses - 玩家的猜测记录字符串
 * @param {number} options.baseScore - 基础得分（普通/同步模式为 2，血战模式根据排名计算）
 * @param {number} options.totalRounds - 总猜测轮数上限（用于计算快速猜对奖励，默认10）
 * @returns {Object} - { totalScore, guessCount, isBigWin, bonuses: { bigWin, quickGuess } }
 */
function calculateWinnerScore({ guesses, baseScore = 0, totalRounds = 10 }) {
    const isBigWin = guesses.includes('👑');

    const cleaned = guesses.replace(/[✌👑💀🏳️🏆]/g, '');
    const guessCount = Array.from(cleaned).length;
    
    let totalScore = baseScore;
    const bonuses = { bigWin: 0, quickGuess: 0 };
    
    if (isBigWin) {
        bonuses.bigWin = 12;
        totalScore += bonuses.bigWin;
    }
    
    if (!isBigWin) {
        if (guessCount >= 2 && guessCount <= 3) {
            bonuses.quickGuess = 2;
        } else {
            const halfRounds = Math.ceil(totalRounds / 2);
            if (guessCount >= 4 && guessCount <= halfRounds) {
                bonuses.quickGuess = 1;
            }
        }
    }
    totalScore += bonuses.quickGuess;
    
    return { totalScore, guessCount, isBigWin, bonuses };
}

/**
 * 计算出题人得分（普通/同步模式）
 * @param {Object} options - 计算选项
 * @param {string} options.winnerGuesses - 胜者的猜测记录字符串
 * @param {number} options.winnerGuessCount - 胜者的猜测次数
 * @param {number} options.bigWinnerScore - 大赢家得分（若有）
 * @param {number} options.totalRounds - 总猜测轮数上限
 * @returns {Object} - { score, reason }
 */
function calculateSetterScore({ winnerGuesses = '', winnerGuessCount = 0, bigWinnerScore = 0, totalRounds = 10 }) {
    const hasWinner = winnerGuessCount > 0;
    const hasBigWinner = winnerGuesses.includes('👑');
    
    if (hasBigWinner) {
        const penalty = Math.max(1, Math.floor(bigWinnerScore / 2));
        return { score: -penalty, reason: '纯在送分' };
    }
    
    if (hasWinner) {
        if (winnerGuessCount <= 3) {
            return { score: -1, reason: '太简单了' };
        } else if (winnerGuessCount > totalRounds / 2) {
            return { score: 1, reason: '难度适中' };
        }
        return { score: 0, reason: '' };
    }
    
    return { score: -1, reason: '没人猜中' };
}

/**
 * 计算血战模式出题人得分
 * @param {Object} options - 计算选项
 * @param {boolean} options.hasBigWinner - 是否存在大赢家
 * @param {number} options.bigWinnerScore - 大赢家得分
 * @param {number} options.winnersCount - 胜者数量
 * @param {number} options.totalPlayersCount - 总玩家数量
 * @returns {Object} - { score, reason }
 */
function calculateNonstopSetterScore({ hasBigWinner = false, bigWinnerScore = 0, winnersCount = 0, totalPlayersCount = 1 }) {
    const TotalPlayers = Math.max(1, totalPlayersCount);
    const playerMultiplier = Math.max(1, Math.ceil(TotalPlayers / 2));
    
    if (hasBigWinner) {
        const penalty = Math.max(1, Math.floor(bigWinnerScore / 2));
        return { score: -penalty, reason: '纯在送分' };
    }
    
    if (winnersCount === 0) {
        const penalty = 2 * playerMultiplier;
        return { score: -penalty, reason: '无人猜中' };
    }
    
    const winRate = winnersCount / TotalPlayers;
    let baseScore = 0;
    let reason = '';
    
    if (winRate <= 0.25) {
        baseScore = 1;
        reason = '难度偏高';
    } else if (winRate >= 0.75) {
        baseScore = 1;
        reason = '难度偏低';
    } else {
        baseScore = 2;
        reason = '难度适中';
    }
    
    const score = baseScore * playerMultiplier;
    return { score, reason };
}

/**
 * 结算阶段：根据猜测历史计算"作品分(💡)"应归属给谁。
 * @param {Object} room - 房间对象
 * @returns {Set} - 作品分获奖者的玩家 ID 集合
 */
function computePartialAwardeesFromGuessHistory(room) {
    const awardees = new Set();
    if (!room?.currentGame || !Array.isArray(room.currentGame.guesses)) {
        return awardees;
    }

    const playersById = new Map((room.players || []).map(p => [p.id, p]));
    const firstPartialIndexByPlayer = new Map();

    room.currentGame.guesses.forEach(playerGuesses => {
        const list = Array.isArray(playerGuesses?.guesses) ? playerGuesses.guesses : [];
        list.forEach((g, idx) => {
            if (!g || !g.playerId) return;
            if (g.isPartialCorrect && !g.isCorrect) {
                if (!firstPartialIndexByPlayer.has(g.playerId)) {
                    firstPartialIndexByPlayer.set(g.playerId, idx);
                }
            }
        });
    });

    const bestByGroup = new Map();
    firstPartialIndexByPlayer.forEach((idx, playerId) => {
        const p = playersById.get(playerId);
        if (!p) return;
        if (p.isAnswerSetter) return;
        if (p.team === '0') return;

        const groupKey = p.team ? `team:${p.team}` : `solo:${playerId}`;
        const current = bestByGroup.get(groupKey);
        const username = String(p.username || '');
        if (!current || idx < current.idx || (idx === current.idx && username.localeCompare(current.username) < 0)) {
            bestByGroup.set(groupKey, { playerId, idx, username });
        }
    });

    bestByGroup.forEach(v => awardees.add(v.playerId));
    return awardees;
}

/**
 * 为队伍成员追加标记（内部 helper）
 * @param {Object} room - 房间对象
 * @param {string} teamId - 队伍 ID
 * @param {string} mark - 标记字符串（如 '✔' 或 '❌'）
 */
function appendMarkToTeam(room, teamId, mark) {
    if (!room || !room.currentGame) return;
    room.players
        .filter(p => p.team === teamId && p.team !== '0' && !p.isAnswerSetter && !p.disconnected)
        .forEach(teammate => {
            teammate.guesses += mark;
        });
}

/**
 * 在出题人指定场景下，将其队友临时转为旁观者
 * @param {Object} room - 房间对象
 * @param {string} roomId - 房间 ID
 * @param {string} setterId - 出题人的 socket ID
 * @param {Object} io - Socket.io 实例
 */
function applySetterObservers(room, roomId, setterId, io) {
    if (!room) return;
    const setter = room.players.find(p => p.id === setterId);
    if (!setter || !setter.team || setter.team === '0') return;

    room.players.forEach(p => {
        if (p.team === setter.team && p.id !== setterId && !p.isAnswerSetter && !p.disconnected) {
            // 只设置临时观战标记，不改变队伍
            p._tempObserver = true;
        }
    });

    io.to(roomId).emit('updatePlayers', { players: room.players,
                    answerSetterId: room.answerSetterId });
}

/**
 * 恢复被临时设为旁观的队友回到原队伍
 * @param {Object} room - 房间对象
 * @param {string} roomId - 房间 ID
 * @param {Object} io - Socket.io 实例
 */
function revertSetterObservers(room, roomId, io) {
    if (!room) return;
    let changed = false;
    room.players.forEach(p => {
        if (p._tempObserver) {
            // 只删除临时观战标记，队伍保持不变
            delete p._tempObserver;
            changed = true;
        }
    });
    if (changed && io) {
        io.to(roomId).emit('updatePlayers', { players: room.players });
    }
}

/**
 * 标记队伍胜利，更新队友状态为临时观战
 * @param {Object} room - 房间对象
 * @param {string} roomId - 房间 ID
 * @param {Object} player - 获胜的玩家对象
 * @param {Object} io - Socket.io 实例
 */
function markTeamVictory(room, roomId, player, io) {
    if (!room || !room.currentGame || !player) return;
    if (room.currentGame && !room.currentGame.teamGuesses) {
        room.currentGame.teamGuesses = {};
    }
    const teamId = player.team;
    if (teamId && teamId !== '0' && room.currentGame?.teamGuesses) {
        if (!String(room.currentGame.teamGuesses[teamId] || '').includes('🏆')) {
            room.currentGame.teamGuesses[teamId] = (room.currentGame.teamGuesses[teamId] || '') + '🏆';
        }
    }

    const teamMembers = room.players.filter(p => p.team === player.team && p.id !== player.id && !p.isAnswerSetter && !p.disconnected);
    teamMembers.forEach(teammate => {
        if (!teammate.guesses.includes('🏆')) {
            teammate.guesses += '🏆';
        }
        // 只设置临时观战标记，不改变队伍
        teammate._tempObserver = true;
        if (room.currentGame.syncPlayersCompleted) {
            room.currentGame.syncPlayersCompleted.add(teammate.id);
            teammate.syncCompletedRound = room.currentGame.syncRound;
        }
        io.to(teammate.id).emit('teamWin', {
            winnerName: player.username,
            message: `队友 ${player.username} 已猜对！`
        });
        console.log(`[TEAM WIN] ${teammate.username} 的队友 ${player.username} 猜对，标记为临时观战`);
    });

    if (!room.currentGame?.settings?.nonstopMode && room.currentGame?.settings?.syncMode) {
        if (player && (!player.team || player.team !== '0')) {
            // 同步模式下获胜者也只设置临时观战标记
            player._tempObserver = true;
        }
    }

    io.to(roomId).emit('updatePlayers', { players: room.players });
}

/**
 * 同步模式进度推进入口。
 * 负责：
 * 1) 更新本轮已完成列表（含超时/队伍共享），
 * 2) 处理 tagBan 待提交队列，
 * 3) 在全员完成时推进到下一同步轮或触发同步结算，
 * 4) 广播同步等待与轮次开始事件。
 * 仅处理同步相关状态，不做得分结算。
 */
function updateSyncProgress(room, roomId, io) {
    if (!io) return;
    if (!room?.currentGame || !room.currentGame?.settings?.syncMode || !room.currentGame.syncPlayersCompleted) return;

    const isEnded = p => (
        p.guesses.includes('✌') ||
        p.guesses.includes('💀') ||
        p.guesses.includes('🏳️') ||
        p.guesses.includes('👑') ||
        p.guesses.includes('🏆')
    );
    const syncPlayers = room.players.filter(p =>
        !p.isAnswerSetter &&
        p.team !== '0' &&
        !p.disconnected &&
        !isEnded(p)
    );

    if (syncPlayers.length === 0) {
        return;
    }

    syncPlayers.forEach(p => {
        if (typeof p.syncCompletedRound === 'number' && p.syncCompletedRound === room.currentGame.syncRound) {
            room.currentGame.syncPlayersCompleted.add(p.id);
        }
    });

    const syncStatus = syncPlayers.map(p => ({
        id: p.id,
        username: p.username,
        completed: room.currentGame.syncPlayersCompleted.has(p.id)
    }));

    const allCompleted = syncStatus.every(s => s.completed);
    let pendingBanBroadcast = null;

    if (allCompleted) {
        if (room.currentGame?.settings?.syncMode && Array.isArray(room.currentGame.tagBanStatePending) && room.currentGame.tagBanStatePending.length) {
            const currentState = Array.isArray(room.currentGame.tagBanState) ? room.currentGame.tagBanState : [];
            const existingTags = new Set(
                currentState
                    .filter(item => item && typeof item.tag === 'string')
                    .map(item => item.tag)
            );

            const pendingNewEntries = room.currentGame.tagBanStatePending
                .filter(entry => entry && typeof entry.tag === 'string')
                .reduce((merged, entry) => {
                    const tagName = entry.tag.trim();
                    if (!tagName || existingTags.has(tagName)) {
                        // Already committed, but still merge revealers into existing committed entry
                        const committedEntry = currentState.find(item => item && typeof item.tag === 'string' && item.tag === tagName);
                        if (committedEntry && Array.isArray(entry.revealer)) {
                            const currentRevealers = Array.isArray(committedEntry.revealer) ? committedEntry.revealer : [];
                            entry.revealer.forEach(id => {
                                if (id && !currentRevealers.includes(id)) {
                                    currentRevealers.push(id);
                                }
                            });
                            committedEntry.revealer = currentRevealers;
                        }
                        return merged;
                    }
                    existingTags.add(tagName);
                    const existingMerged = merged.find(m => m.tag === tagName);
                    if (existingMerged) {
                        // Merge revealers from duplicate pending entries (tag name collision after trim)
                        if (Array.isArray(entry.revealer)) {
                            entry.revealer.forEach(id => {
                                if (id && !existingMerged.revealer.includes(id)) {
                                    existingMerged.revealer.push(id);
                                }
                            });
                        }
                        return merged;
                    }
                    const revealers = Array.isArray(entry.revealer)
                        ? Array.from(new Set(entry.revealer.filter(Boolean)))
                        : [];
                    merged.push({ tag: tagName, revealer: revealers });
                    return merged;
                }, []);

            // 同步模式：所有同轮猜测视为同时发生，
            // 本轮所有参战玩家均应能透视本轮发现的所有标签
            if (room.currentGame?.settings?.syncMode && pendingNewEntries.length) {
                const roundParticipantIds = room.players
                    .filter(p => !p.isAnswerSetter && p.team !== '0' && !p.disconnected && !p._tempObserver)
                    .map(p => p.id);
                pendingNewEntries.forEach(entry => {
                    const currentSet = new Set(entry.revealer);
                    roundParticipantIds.forEach(id => currentSet.add(id));
                    entry.revealer = Array.from(currentSet);
                });
            }

            if (pendingNewEntries.length) {
                const updatedState = currentState.concat(pendingNewEntries);
                room.currentGame.tagBanState = updatedState;
                pendingBanBroadcast = updatedState;
            } else {
                room.currentGame.tagBanState = currentState;
            }

            room.currentGame.tagBanStatePending = [];
        }

        if (pendingBanBroadcast) {
            io.to(roomId).emit('tagBanStateUpdate', {
                tagBanState: pendingBanBroadcast
            });
            pendingBanBroadcast = null;
        }

        if (!room.currentGame?.settings?.nonstopMode && room.currentGame?.syncWinnerFound) {
            if (pendingBanBroadcast) {
                io.to(roomId).emit('tagBanStateUpdate', { tagBanState: pendingBanBroadcast });
                pendingBanBroadcast = null;
            }
            room.currentGame.syncReadyToEnd = true;
            const payload = {
                round: room.currentGame.syncRound,
                syncStatus,
                completedCount: syncStatus.length,
                totalCount: syncStatus.length
            };
            if (!shouldSkipSyncWaiting(room, payload)) {
                io.to(roomId).emit('syncWaiting', payload);
            }
            io.to(roomId).emit('syncGameEnding', {
                winnerUsername: room.currentGame.syncWinner?.username,
                message: `${room.currentGame.syncWinner?.username} 已猜对！等待本轮结束...`
            });
            finalizeStandardGame(room, roomId, io, { force: true });
            return;
        }

        room.currentGame.syncReadyToEnd = false;
        room.currentGame.syncRound += 1;
        room.currentGame.syncPlayersCompleted.clear();
        room.currentGame._lastSyncWaitingKey = null;
        room.currentGame._lastSyncWaitingAt = 0;
        room.players.forEach(p => {
            if (typeof p.syncCompletedRound === 'number') {
                delete p.syncCompletedRound;
            }
        });

        if (room.currentGame?.settings?.nonstopMode) {
            room.currentGame.syncRoundStartRank = room.currentGame.nonstopWinners.length + 1;
        }

        const nextSyncPlayers = room.players.filter(p =>
            !p.isAnswerSetter &&
            p.team !== '0' &&
            !p.disconnected &&
            !isEnded(p)
        );

        const nextSyncStatus = nextSyncPlayers.map(p => ({
            id: p.id,
            username: p.username,
            completed: room.currentGame.syncPlayersCompleted.has(p.id)
        }));

        io.to(roomId).emit('syncRoundStart', {
            round: room.currentGame.syncRound
        });

        const nextPayload = {
            round: room.currentGame.syncRound,
            syncStatus: nextSyncStatus,
            completedCount: nextSyncStatus.filter(s => s.completed).length,
            totalCount: nextSyncStatus.length
        };
        if (!shouldSkipSyncWaiting(room, nextPayload, { force: true })) {
            io.to(roomId).emit('syncWaiting', nextPayload);
        }
    } else {
        const payload = {
            round: room.currentGame.syncRound,
            syncStatus,
            completedCount: syncStatus.filter(s => s.completed).length,
            totalCount: syncStatus.length
        };

        if (!shouldSkipSyncWaiting(room, payload)) {
            io.to(roomId).emit('syncWaiting', payload);
        }

        if (!room.currentGame?.settings?.nonstopMode && room.currentGame?.syncWinnerFound) {
            io.to(roomId).emit('syncGameEnding', {
                winnerUsername: room.currentGame.syncWinner?.username,
                message: `${room.currentGame.syncWinner?.username} 已猜对！等待本轮结束...`
            });
        }
    }
}

/**
 * 生成游戏结束统计详情
 * @param {Object} options - 生成选项
 * @param {Array} options.players - 房间玩家列表
 * @param {Object} options.scoreChanges - 玩家得分变化映射
 * @param {Object} options.setterInfo - 出题人信息（可空）
 * @param {boolean} options.isNonstopMode - 是否为血战模式
 * @returns {Array} - 详情列表
 */
function generateScoreDetails({ players, scoreChanges, setterInfo, isNonstopMode = false }) {
    const activePlayers = players.filter(p => p.team !== '0');
    
    const teamMap = new Map();
    const noTeamPlayers = [];
    
    activePlayers.forEach(p => {
        if (p.isAnswerSetter) return;
        
        const change = scoreChanges[p.id] || { score: 0, breakdown: {}, result: '' };
        const playerInfo = {
            id: p.id,
            username: p.username,
            team: p.team,
            score: change.score,
            breakdown: change.breakdown,
            result: change.result
        };
        
        if (p.team && p.team !== '' && p.team !== '0') {
            if (!teamMap.has(p.team)) {
                teamMap.set(p.team, []);
            }
            teamMap.get(p.team).push(playerInfo);
        } else {
            noTeamPlayers.push(playerInfo);
        }
    });
    
    const details = [];
    
    teamMap.forEach((members, teamId) => {
        if (members.length > 1) {
            const teamScore = members.reduce((sum, m) => sum + (m.score || 0), 0);
            details.push({
                type: 'team',
                teamId,
                teamScore,
                members
            });
        } else {
            noTeamPlayers.push(members[0]);
        }
    });
    
    noTeamPlayers.forEach(p => {
        details.push({
            type: 'player',
            ...p
        });
    });
    
    if (setterInfo) {
        details.push({
            type: 'setter',
            username: setterInfo.username,
            score: setterInfo.score,
            reason: setterInfo.reason
        });
    }
    
    return details;
}

/**
 * 普通/同步模式结算入口。
 * 触发场景：
 * - 玩家结束/投降/断连/超时后的标准流程；
 * - 同步模式强制结算(force=true)。
 * 关键步骤：
 * 1) 合并待提交的标签禁用状态(tagBanStatePending)。
 * 2) 判定胜者与首胜者、处理本命大赢家优先级。
 * 3) 计算胜者/出题人/作品分，并生成 scoreDetails 广播。
 * 4) 重置房间状态与观战者。
 */
function finalizeStandardGame(room, roomId, io, { force = false } = {}) {
    if (!room?.currentGame || room.currentGame?.settings?.nonstopMode) {
        return false;
    }

    if (room.currentGame?.settings?.syncMode) {
        const pendingList = Array.isArray(room.currentGame.tagBanStatePending)
            ? room.currentGame.tagBanStatePending
            : [];
        let tagBanChanged = false;
        if (pendingList.length) {
            if (!Array.isArray(room.currentGame.tagBanState)) {
                room.currentGame.tagBanState = [];
            }
            pendingList.forEach(entry => {
                if (!entry || typeof entry.tag !== 'string') return;
                const tagName = entry.tag.trim();
                if (!tagName) return;
                const revealerList = Array.isArray(entry.revealer) ? entry.revealer.filter(Boolean) : [];
                let targetEntry = room.currentGame.tagBanState.find(item => item && typeof item.tag === 'string' && item.tag.trim() === tagName);
                if (!targetEntry) {
                    targetEntry = { tag: tagName, revealer: [] };
                    room.currentGame.tagBanState.push(targetEntry);
                    tagBanChanged = true;
                }
                const existingSet = new Set(Array.isArray(targetEntry.revealer) ? targetEntry.revealer : []);
                const initialSize = existingSet.size;
                revealerList.forEach(id => existingSet.add(id));
                const mergedRevealers = Array.from(existingSet);
                if (!Array.isArray(targetEntry.revealer) || mergedRevealers.length !== initialSize) {
                    targetEntry.revealer = mergedRevealers;
                    tagBanChanged = true;
                }
            });

            // 同步模式：本轮所有参战玩家均可透视本轮发现的所有标签
            if (room.currentGame?.settings?.syncMode && room.currentGame.tagBanState.length) {
                const roundParticipantIds = room.players
                    .filter(p => !p.isAnswerSetter && p.team !== '0' && !p.disconnected && !p._tempObserver)
                    .map(p => p.id);
                room.currentGame.tagBanState.forEach(entry => {
                    if (!entry || !Array.isArray(entry.revealer)) return;
                    const currentSet = new Set(entry.revealer);
                    const prevSize = currentSet.size;
                    roundParticipantIds.forEach(id => currentSet.add(id));
                    if (currentSet.size !== prevSize) {
                        entry.revealer = Array.from(currentSet);
                        tagBanChanged = true;
                    }
                });
            }

            room.currentGame.tagBanStatePending = [];
            if (tagBanChanged) {
                io.to(roomId).emit('tagBanStateUpdate', {
                    tagBanState: Array.isArray(room.currentGame.tagBanState) ? room.currentGame.tagBanState : []
                });
            }
        }
    }

    const activePlayers = room.players.filter(p => !p.isAnswerSetter && (p.team !== '0' || p._tempObserver));
    const allEnded = activePlayers.every(p =>
        p.guesses.includes('✌') ||
        p.guesses.includes('💀') ||
        p.guesses.includes('🏳️') ||
        p.guesses.includes('👑') ||
        p.guesses.includes('🏆') ||
        p.disconnected
    );

    if (!room.currentGame) {
        console.log(`[ERROR][finalizeStandardGame][${roomId}] 游戏未开始或已结束`);
        return false;
    }

    const firstWinner = room.currentGame.firstWinner;
    const syncMode = room.currentGame?.settings?.syncMode && !room.currentGame?.settings?.nonstopMode;

    let actualWinners = [];
    if (syncMode) {
        // 队伍共享结束标记，个人胜利只能来自该玩家已被接受的正确猜测。
        const correctGuesserIds = new Set(room.currentGame.guesses.flatMap(history =>
            history.guesses.filter(guess => guess.isCorrect).map(guess => guess.playerId)
        ));
        actualWinners = activePlayers.filter(p => correctGuesserIds.has(p.id));
    } else {
        const answerId = room.currentGame?.answerCharacterId;
        let bigwinner = firstWinner?.isBigWin
            ? activePlayers.find(p => p.id === firstWinner.id) || activePlayers.find(p => p.guesses.includes('👑'))
            : activePlayers.find(p => p.guesses.includes('👑'));
        if (!bigwinner && answerId) {
            const avatarBigWinner = activePlayers.find(p => (p.guesses.includes('✌') || p.guesses.includes('👑')) && String(p.avatarId) === String(answerId));
            if (avatarBigWinner) {
                bigwinner = avatarBigWinner;
                if (!avatarBigWinner.guesses.includes('👑')) avatarBigWinner.guesses = avatarBigWinner.guesses.replace('✌','') + '👑';
            }
        }
        let winner = !bigwinner && firstWinner && !firstWinner.isBigWin
            ? activePlayers.find(p => p.id === firstWinner.id) || activePlayers.find(p => p.guesses.includes('✌'))
            : (!bigwinner ? activePlayers.find(p => p.guesses.includes('✌')) : null);
        const actualWinner = bigwinner || winner;
        if (actualWinner) actualWinners = [actualWinner];
    }

    const actualWinner = actualWinners[0] || null;
    const totalRounds = room.currentGame?.settings?.maxAttempts || 10;
    const shouldWaitForSyncRound = syncMode && actualWinner && !allEnded && !room.currentGame.syncReadyToEnd && !force;

    if (actualWinner && shouldWaitForSyncRound) {
        io.to(roomId).emit('updatePlayers', {
            players: room.players
        });
        return false;
    }

    if (!actualWinner && !allEnded) {
        return false;
    }

    const answerSetter = room.players.find(p => p.isAnswerSetter);
    const partialAwardees = computePartialAwardeesFromGuessHistory(room);

    const winnerScoreResults = {};
    const primaryWinner = actualWinners.find(p => p.id === firstWinner?.id) || actualWinners[0] || null;
    actualWinners.forEach(w => {
        const scoreResult = calculateWinnerScore({ guesses: w.guesses, baseScore: 2, totalRounds });
        w.score += scoreResult.totalScore;
        winnerScoreResults[w.id] = scoreResult;
    });

    const winnerIdSet = new Set((actualWinners || []).map(w => w.id));
    (room.players || []).forEach(p => {
        if (!p || p.isAnswerSetter) return;
        if (p.team === '0') return;
        if (winnerIdSet.has(p.id)) return;
        if (partialAwardees.has(p.id)) {
            p.score += 1;
        }
    });

    const winnerGuessCount = winnerScoreResults[primaryWinner?.id]?.guessCount || 0;
    let bigWinnerActualScore = 0;
    actualWinners.filter(p => p.guesses.includes('👑')).forEach(p => {
        bigWinnerActualScore = Math.max(bigWinnerActualScore, winnerScoreResults[p.id].totalScore);
    });

    const scoreChanges = buildScoreChanges({
        players: room.players,
        actualWinners,
        winnerScoreResults,
        partialAwardees,
        isNonstopMode: false
    });

    if (answerSetter) {
        const setterResult = calculateSetterScore({
            winnerGuesses: primaryWinner?.guesses || '',
            winnerGuessCount,
            bigWinnerScore: bigWinnerActualScore,
            totalRounds
        });

        answerSetter.score += setterResult.score;

        const scoreDetails = generateScoreDetails({
            players: room.players,
            scoreChanges,
            setterInfo: { username: answerSetter.username, score: setterResult.score, reason: setterResult.reason },
            isNonstopMode: false
        });

        io.to(roomId).emit('gameEnded', {
            guesses: room.currentGame?.guesses || [],
            scoreDetails
        });
    } else {
        const scoreDetails = generateScoreDetails({
            players: room.players,
            scoreChanges,
            setterInfo: null,
            isNonstopMode: false
        });

        io.to(roomId).emit('gameEnded', {
            guesses: room.currentGame?.guesses || [],
            scoreDetails
        });
    }

    revertSetterObservers(room, roomId, io);

    room.players.forEach(p => {
        p.isAnswerSetter = false;
    });

    room.players.forEach(p => {
        if (p.joinedDuringGame) {
            p.team = null;
            p.joinedDuringGame = false;
            p.ready = false;
        }
    });

    clearGameTimeoutTimers(room.currentGame);
    room.currentGame = null;
    io.to(roomId).emit('updatePlayers', {
        players: room.players,
        isPublic: room.isPublic,
        answerSetterId: null
    });

    console.log(`[普通模式] 房间 ${roomId} 游戏结束${force ? '（同步强制结算）' : ''}`);
    return true;
}

/**
 * 生成玩家得分变化详情（统一处理血战模式和普通模式）
 * @param {Object} options - 生成选项
 * @param {Array} options.players - 房间玩家列表
 * @param {Object} options.actualWinner - 单个胜者（普通模式）
 * @param {Array} options.actualWinners - 胜者列表
 * @param {Object} options.winnerScoreResult - 胜者得分结果
 * @param {Object} options.winnerScoreResults - 胜者得分结果映射
 * @param {Array} options.nonstopWinners - 血战模式胜者列表
 * @param {Set} options.partialAwardees - 作品分获奖者集合
 * @param {boolean} options.isNonstopMode - 是否为血战模式
 * @returns {Object} - 得分变化映射
 */
function buildScoreChanges({ players, actualWinner, actualWinners, winnerScoreResult, winnerScoreResults, nonstopWinners, partialAwardees, isNonstopMode }) {
    const scoreChanges = {};
    const activePlayers = players.filter(p => !p.isAnswerSetter && (p.team !== '0' || p._tempObserver));
    
    if (isNonstopMode) {
        const winners = nonstopWinners || [];
        const winnerIds = new Set(winners.map(w => w.id));
        
        winners.forEach(w => {
            const winnerPlayer = players.find(p => p.id === w.id);
            const isBigWin = winnerPlayer && winnerPlayer.guesses.includes('👑');

            const bonuses = w.bonuses || {};
            const bigWinBonus = bonuses.bigWin || (isBigWin ? 12 : 0);
            const quickGuessBonus = bonuses.quickGuess || 0;
            const baseScore = Math.max(0, (w.score ?? 0) - bigWinBonus - quickGuessBonus);

            scoreChanges[w.id] = {
                score: w.score,
                breakdown: {
                    rank: w.rank,
                    base: baseScore,
                    ...(bigWinBonus ? { bigWin: bigWinBonus } : {}),
                    ...(quickGuessBonus ? { quickGuess: quickGuessBonus } : {})
                },
                result: isBigWin ? 'bigwin' : 'win'
            };
        });
        
        activePlayers.filter(p => !winnerIds.has(p.id)).forEach(p => {
            const hasPartial = !!partialAwardees && partialAwardees.has(p.id);
            scoreChanges[p.id] = {
                score: hasPartial ? 1 : 0,
                breakdown: hasPartial ? { partial: 1 } : {},
                result: getEndResultFromMarks(p.guesses)
            };
        });
    } else {
        const winnerList = actualWinners && actualWinners.length ? actualWinners : (actualWinner ? [actualWinner] : []);
        const winnerIdSet = new Set(winnerList.map(w => w.id));

        activePlayers.forEach(p => {
            if (winnerIdSet.has(p.id)) {
                const res = (winnerScoreResults && winnerScoreResults[p.id]) || winnerScoreResult;
                scoreChanges[p.id] = {
                    score: res?.totalScore || 0,
                    breakdown: {
                        base: 2,
                        ...res?.bonuses
                    },
                    result: p.guesses.includes('👑') ? 'bigwin' : 'win'
                };
            } else {
                const hasPartial = !!partialAwardees && partialAwardees.has(p.id);
                scoreChanges[p.id] = {
                    score: hasPartial ? 1 : 0,
                    breakdown: hasPartial ? { partial: 1 } : {},
                    result: getEndResultFromMarks(p.guesses)
                };
            }
        });
    }
    
    return scoreChanges;
}

/**
 * 标准流程调度器（所有影响游戏状态的动作后调用）。
 * 责任：
 * - 同步模式：推进同步轮次。
 * - 广播当前同步/血战进度。
 * - 根据模式选择对应结算：非血战走 finalizeStandardGame，血战走 finalizeNonstopGame。
 * 返回 finalized 表示是否已完成结算。
 */
function runStandardFlow(room, roomId, io, { forceFinalize = false, broadcastState = true } = {}) {
    if (!room?.currentGame) return { finalized: false };

    if (room.currentGame?.settings?.syncMode) {
        updateSyncProgress(room, roomId, io);
    }

    if (broadcastState) {
        getSyncAndNonstopState(room, (eventName, data) => {
            io.to(roomId).emit(eventName, data);
        });
    }

    // 血战模式：由统一流程判定结算；普通/同步模式走 finalizeStandardGame
    if (room.currentGame?.settings?.nonstopMode) {
        const finalized = finalizeNonstopGame(room, roomId, io);
        return { finalized: !!finalized };
    }

    const finalized = finalizeStandardGame(room, roomId, io, { force: forceFinalize });
    return { finalized: !!finalized };
}

/**
 * 血战模式结算入口。
 * 触发场景：
 * - 剩余可行动玩家为 0（胜出/失败/投降/断连/被踢等）。
 * 关键步骤：
 * 1) 识别作品分获奖者并加分。
 * 2) 计算出题人分数与胜者分解，生成 scoreDetails。
 * 3) 重置房间状态、恢复临时观战队友并广播 gameEnded。
 */
function finalizeNonstopGame(room, roomId, io) {
    if (!room?.currentGame || !room.currentGame?.settings?.nonstopMode) {
        return false;
    }

    const activePlayers = room.players.filter(p => !p.isAnswerSetter && p.team !== '0' && !p.disconnected);
    const remainingPlayers = activePlayers.filter(p =>
        !p.guesses.includes('✌') &&
        !p.guesses.includes('💀') &&
        !p.guesses.includes('🏳️') &&
        !p.guesses.includes('👑') &&
        !p.guesses.includes('🏆')
    );

    if (remainingPlayers.length > 0) {
        return false;
    }

    const answerSetter = room.players.find(p => p.isAnswerSetter);
    const winnersCount = (room.currentGame.nonstopWinners || []).length;
    const totalPlayersCount = activePlayers.length;

    const partialAwardees = computePartialAwardeesFromGuessHistory(room);
    const winnerIds = new Set((room.currentGame.nonstopWinners || []).map(w => w.id));
    (room.players || []).forEach(p => {
        if (!p || p.isAnswerSetter) return;
        if (p.team === '0') return;
        if (winnerIds.has(p.id)) return;
        if (partialAwardees.has(p.id)) {
            p.score += 1;
        }
    });

    const bigWinnerData = (room.currentGame.nonstopWinners || []).find(w => {
        const winnerPlayer = room.players.find(p => p.id === w.id);
        return winnerPlayer && winnerPlayer.guesses.includes('👑');
    });
    const hasBigWinner = !!bigWinnerData;
    const bigWinnerScore = bigWinnerData?.score || 0;

    const scoreChanges = buildScoreChanges({
        isNonstopMode: true,
        nonstopWinners: room.currentGame.nonstopWinners || [],
        partialAwardees,
        players: room.players
    });

    let scoreDetails;
    if (answerSetter) {
        const setterResult = calculateNonstopSetterScore({
            hasBigWinner,
            bigWinnerScore,
            winnersCount,
            totalPlayersCount
        });

        answerSetter.score += setterResult.score;

        scoreDetails = generateScoreDetails({
            players: room.players,
            scoreChanges,
            setterInfo: { username: answerSetter.username, score: setterResult.score, reason: setterResult.reason },
            isNonstopMode: true
        });
    } else {
        scoreDetails = generateScoreDetails({
            players: room.players,
            scoreChanges,
            setterInfo: null,
            isNonstopMode: true
        });
    }

    io.to(roomId).emit('gameEnded', {
        guesses: room.currentGame?.guesses || [],
        scoreDetails
    });

    revertSetterObservers(room, roomId, io);
    room.players.forEach(p => {
        p.isAnswerSetter = false;
    });
    io.to(roomId).emit('resetReadyStatus');
    clearGameTimeoutTimers(room.currentGame);
    room.currentGame = null;
    io.to(roomId).emit('updatePlayers', {
        players: room.players,
        isPublic: room.isPublic,
        answerSetterId: null
    });

    console.log(`[血战模式] 房间 ${roomId} 游戏结束（标准流程）`);
    return true;
}

module.exports = {
    handlePlayerTimeout,
    countAttemptMarks,
    hasEndMark,
    stripEndMarks,
    enforceAttemptLimit,
    getSyncAndNonstopState,
    calculateWinnerScore,
    calculateSetterScore,
    calculateNonstopSetterScore,
    computePartialAwardeesFromGuessHistory,
    appendMarkToTeam,
    applySetterObservers,
    revertSetterObservers,
    markTeamVictory,
    updateSyncProgress,
    generateScoreDetails,
    finalizeStandardGame,
    finalizeNonstopGame,
    buildScoreChanges,
    runStandardFlow,
    clearGameTimeoutTimers
};
