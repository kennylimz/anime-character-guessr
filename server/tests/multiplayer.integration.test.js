const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const CryptoJS = require('crypto-js');

const setupSocket = require('../utils/socket');

const AES_SECRET = process.env.AES_SECRET || 'My-Secret-Key';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForEvent(socket, eventName, predicate = null, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(eventName, handler);
            reject(new Error(`Timeout waiting for event: ${eventName}`));
        }, timeout);

        const handler = (payload) => {
            if (!predicate || predicate(payload)) {
                clearTimeout(timer);
                socket.off(eventName, handler);
                resolve(payload);
            }
        };

        socket.on(eventName, handler);
    });
}

async function waitUntil(fn, timeout = 8000, interval = 25) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (fn()) return;
        await sleep(interval);
    }
    throw new Error('waitUntil timeout');
}

function emitWithAck(socket, eventName, payload, timeout = 3000) {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve({ ok: false, timeout: true }), timeout);
        socket.emit(eventName, payload, (response) => {
            clearTimeout(timer);
            resolve(response || { ok: true });
        });
    });
}

function encryptedCharacter(id) {
    const payload = {
        id,
        name: `char-${id}`,
        nameCn: `角色-${id}`,
        appearanceIds: [1, 2, 3]
    };
    return CryptoJS.AES.encrypt(JSON.stringify(payload), AES_SECRET).toString();
}

test('12-player multi-round multiplayer integration across normal/sync/nonstop modes', { timeout: 90000 }, async () => {
    const rooms = new Map();
    const httpServer = http.createServer();
    const io = new Server(httpServer, {
        path: '/api/ws',
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    setupSocket(io, rooms);

    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const port = httpServer.address().port;
    const roomId = 'integration-room';

    const sockets = [];
    const errors = [];
    const players = [];
    let gameEndedCount = 0;

    const connectPlayer = async (username) => {
        const socket = Client(`http://127.0.0.1:${port}`, {
            path: '/api/ws',
            transports: ['websocket'],
            reconnection: false,
            forceNew: true
        });

        await waitForEvent(socket, 'connect');
        socket.on('error', (payload) => {
            errors.push({ username, payload });
        });
        socket.on('gameEnded', () => {
            gameEndedCount += 1;
        });
        sockets.push(socket);
        players.push({ username, socket });
        return socket;
    };

    try {
        const host = await connectPlayer('host');
        host.emit('createRoom', { roomId, username: 'host' });

        for (let i = 1; i <= 11; i += 1) {
            const username = `p${i}`;
            const socket = await connectPlayer(username);
            socket.emit('joinRoom', { roomId, username });
        }

        await waitUntil(() => {
            const room = rooms.get(roomId);
            return !!room && room.players.length === 12;
        });

        const getSocketByName = (name) => players.find(p => p.username === name)?.socket;
        const getPlayerStateByName = (name) => (rooms.get(roomId)?.players || []).find(p => p.username === name);

        const ensureAllReady = async () => {
            const room = rooms.get(roomId);
            assert.ok(room, 'room should exist when checking readiness');
            for (const p of room.players) {
                if (p.username === 'host') continue;
                if (p.disconnected) continue;
                if (!p.ready) {
                    getSocketByName(p.username).emit('toggleReady', { roomId });
                    await sleep(30);
                }
            }
            await waitUntil(() => {
                const latestRoom = rooms.get(roomId);
                if (!latestRoom) return false;
                return latestRoom.players
                    .filter(p => !p.isHost && !p.disconnected)
                    .every(p => p.ready);
            });
        };

        // 设置一个观战者用于覆盖旁观逻辑
        getSocketByName('p11').emit('updatePlayerTeam', { roomId, team: '0' });
        await sleep(120);

        const startRound = async (settings, answerId) => {
            await ensureAllReady();
            host.emit('updateGameSettings', { roomId, settings });
            const startWait = waitForEvent(host, 'gameStart');
            host.emit('gameStart', {
                roomId,
                settings,
                character: encryptedCharacter(answerId)
            });
            await startWait;
            await sleep(150);
        };

        const roundBaseSettings = {
            maxAttempts: 2,
            syncMode: false,
            nonstopMode: false,
            globalPick: false,
            tagBan: false
        };

        // Round 1: 普通模式（正确/错误/超时/同作品）
        await startRound(roundBaseSettings, 101);
        getSocketByName('p1').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: true, guessData: { id: 999, name: 'wrong-partial' } }
        });
        getSocketByName('p2').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: false, guessData: { id: 998, name: 'wrong' } }
        });
        getSocketByName('p3').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: false, guessData: { id: 997, name: 'wrong-before-win' } }
        });
        const end1Baseline = gameEndedCount;
        getSocketByName('p4').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: false, guessData: { id: 101, name: 'correct' } }
        });
        getSocketByName('p4').emit('gameEnd', { roomId, result: 'win' });

        await waitUntil(() => gameEndedCount >= end1Baseline + 1, 12000);

        // Round 2: 同步模式（多人完成后结算）
        await startRound({ ...roundBaseSettings, syncMode: true }, 202);
        getSocketByName('p1').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: true, guessData: { id: 997, name: 'sync-partial' } }
        });
        getSocketByName('p2').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: false, guessData: { id: 996, name: 'sync-wrong-p2' } }
        });
        getSocketByName('p3').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: false, guessData: { id: 202, name: 'sync-correct' } }
        });
        const end2Baseline = gameEndedCount;
        getSocketByName('p3').emit('gameEnd', { roomId, result: 'win' });

        for (const [idx, p] of ['host', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'].entries()) {
            const s = getSocketByName(p);
            if (s) {
                s.emit('playerGuess', {
                    roomId,
                    guessResult: { isPartialCorrect: false, guessData: { id: 800 + idx, name: `sync-filler-${p}` } }
                });
            }
            await sleep(20);
        }

        await waitUntil(() => gameEndedCount >= end2Baseline + 1, 15000);

        // Round 3: 血战模式（赢家 + 其余主动观战结束）
        await startRound({ ...roundBaseSettings, nonstopMode: true, syncMode: false }, 303);
        getSocketByName('p1').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: true, guessData: { id: 996, name: 'nonstop-partial' } }
        });
        getSocketByName('p2').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: false, guessData: { id: 995, name: 'nonstop-wrong-p2' } }
        });
        getSocketByName('p3').emit('playerGuess', {
            roomId,
            guessResult: { isPartialCorrect: false, guessData: { id: 303, name: 'nonstop-correct' } }
        });
        getSocketByName('p3').emit('nonstopWin', { roomId, isBigWin: false });
        const end3Baseline = gameEndedCount;

        for (const p of ['host', 'p1', 'p2', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']) {
            const s = getSocketByName(p);
            if (s) s.emit('enterObserverMode', { roomId });
            await sleep(20);
        }

        await waitUntil(() => gameEndedCount >= end3Baseline + 1, 15000);

        const room = rooms.get(roomId);
        assert.ok(room, 'room should still exist after integration rounds');
        assert.equal(errors.length, 0, `unexpected socket errors: ${JSON.stringify(errors)}`);
        assert.ok(gameEndedCount >= 3, `expected at least 3 gameEnded events, got ${gameEndedCount}`);
        assert.ok(room.players.some(p => (p.score || 0) !== 0), 'at least one player should gain/lose score after multiple rounds');
        assert.equal(getPlayerStateByName('p11')?.team, '0', 'observer team should remain observer');
    } finally {
        for (const socket of sockets) {
            try {
                socket.disconnect();
            } catch (_e) {
                // ignore
            }
        }
        await new Promise(resolve => io.close(resolve));
        await new Promise(resolve => httpServer.close(resolve));
    }
});

test('global pick is enforced by server across normal and sync rounds', { timeout: 30000 }, async () => {
    const rooms = new Map();
    const httpServer = http.createServer();
    const io = new Server(httpServer, {
        path: '/api/ws',
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    setupSocket(io, rooms);

    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const port = httpServer.address().port;
    const roomId = 'global-pick-room';
    const sockets = [];
    const errors = [];

    const connectPlayer = async (username) => {
        const socket = Client(`http://127.0.0.1:${port}`, {
            path: '/api/ws',
            transports: ['websocket'],
            reconnection: false,
            forceNew: true
        });
        await waitForEvent(socket, 'connect');
        socket.on('error', payload => errors.push({ username, payload }));
        sockets.push(socket);
        return socket;
    };

    const readyAllExceptHost = async (...players) => {
        for (const socket of players) {
            socket.emit('toggleReady', { roomId });
            await sleep(20);
        }
    };

    try {
        const host = await connectPlayer('host');
        const p1 = await connectPlayer('p1');
        const p2 = await connectPlayer('p2');
        const p3 = await connectPlayer('p3');

        host.emit('createRoom', { roomId, username: 'host' });
        p1.emit('joinRoom', { roomId, username: 'p1' });
        p2.emit('joinRoom', { roomId, username: 'p2' });
        p3.emit('joinRoom', { roomId, username: 'p3' });
        await waitUntil(() => rooms.get(roomId)?.players.length === 4);
        await readyAllExceptHost(p1, p2, p3);

        const baseSettings = {
            maxAttempts: 5,
            syncMode: false,
            nonstopMode: false,
            globalPick: true,
            tagBan: false
        };

        const nonHostStart = await emitWithAck(p1, 'gameStart', {
            roomId,
            character: encryptedCharacter(900),
            settings: { ...baseSettings, globalPick: false }
        });
        assert.equal(nonHostStart.ok, false, 'non-host gameStart should be rejected with ack');
        await sleep(100);
        assert.equal(rooms.get(roomId)?.currentGame, undefined, 'non-host should not be able to start a game');

        host.emit('updateGameSettings', { roomId, settings: baseSettings });
        const normalStart = await emitWithAck(host, 'gameStart', {
            roomId,
            character: encryptedCharacter(900),
            settings: baseSettings
        });
        assert.equal(normalStart.ok, true, 'host gameStart should be confirmed with ack');
        await waitUntil(() => !!rooms.get(roomId)?.currentGame);

        const p1Answer = await emitWithAck(p1, 'playerGuess', {
            roomId,
            guessResult: { isCorrect: false, guessData: { id: 899, name: 'first-pick' } }
        });
        assert.equal(p1Answer.ok, true, 'first global pick guess should be accepted');

        const p2DuplicateAnswer = await emitWithAck(p2, 'playerGuess', {
            roomId,
            guessResult: { isCorrect: false, guessData: { id: '899', name: 'first-pick-as-string' } }
        });
        assert.equal(p2DuplicateAnswer.ok, false, 'normal global pick should reject another player duplicate even with string id');
        assert.equal(rooms.get(roomId).players.find(p => p.username === 'p2').guesses, '', 'rejected duplicate should not consume attempts');

        p2.emit('gameEnd', { roomId, result: 'win' });
        await sleep(100);
        const p2State = rooms.get(roomId).players.find(p => p.username === 'p2');
        assert.equal(p2State.guesses.includes('✌') || p2State.guesses.includes('👑'), false, 'rejected guess must not be convertible into a win');

        const p1Repeat = await emitWithAck(p1, 'playerGuess', {
            roomId,
            guessResult: { isCorrect: false, guessData: { id: '899', name: 'self-repeat' } }
        });
        assert.equal(p1Repeat.ok, true, 'a player may repeat their own guessed character');

        rooms.get(roomId).currentGame = null;
        rooms.get(roomId).players.forEach(p => {
            p.guesses = '';
            p.ready = p.username !== 'host';
        });

        host.emit('updatePlayerTeam', { roomId, team: '0' });
        await sleep(50);
        const syncSettings = { ...baseSettings, syncMode: true };
        host.emit('updateGameSettings', { roomId, settings: syncSettings });
        const syncStart = await emitWithAck(host, 'gameStart', {
            roomId,
            character: encryptedCharacter(901),
            settings: syncSettings
        });
        assert.equal(syncStart.ok, true, 'sync gameStart should be confirmed with ack');
        await waitUntil(() => rooms.get(roomId)?.currentGame?.syncRound === 1);

        const p1Round1 = await emitWithAck(p1, 'playerGuess', {
            roomId,
            guessResult: { isCorrect: false, guessData: { id: 301, name: 'same-round' } }
        });
        const p2Round1 = await emitWithAck(p2, 'playerGuess', {
            roomId,
            guessResult: { isCorrect: false, guessData: { id: '301', name: 'same-round-string' } }
        });
        const p3Round1 = await emitWithAck(p3, 'playerGuess', {
            roomId,
            guessResult: { isCorrect: false, guessData: { id: 302, name: 'complete-round' } }
        });
        assert.equal(p1Round1.ok, true);
        assert.equal(p2Round1.ok, true, 'sync mode should allow same-character guesses in the same round');
        assert.equal(p3Round1.ok, true);
        await waitUntil(() => rooms.get(roomId)?.currentGame?.syncRound === 2);

        const p3BlockedRound2 = await emitWithAck(p3, 'playerGuess', {
            roomId,
            guessResult: { isCorrect: false, guessData: { id: 301, name: 'previous-round-duplicate' } }
        });
        assert.equal(p3BlockedRound2.ok, false, 'sync mode should reject another player duplicate from a previous round');

        const p1SelfRepeatRound2 = await emitWithAck(p1, 'playerGuess', {
            roomId,
            guessResult: { isCorrect: false, guessData: { id: '301', name: 'self-repeat-next-round' } }
        });
        assert.equal(p1SelfRepeatRound2.ok, true, 'sync mode should allow self-repeat in later rounds');
    } finally {
        for (const socket of sockets) {
            try {
                socket.disconnect();
            } catch (_e) {
                // ignore
            }
        }
        await new Promise(resolve => io.close(resolve));
        await new Promise(resolve => httpServer.close(resolve));
    }
});

test('server-owned timers apply solo and team timeouts without client timeOut events', { timeout: 30000 }, async () => {
    const rooms = new Map();
    const httpServer = http.createServer();
    const io = new Server(httpServer, {
        path: '/api/ws',
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    setupSocket(io, rooms);

    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const port = httpServer.address().port;
    const sockets = [];

    const connectPlayer = async (username) => {
        const socket = Client(`http://127.0.0.1:${port}`, {
            path: '/api/ws',
            transports: ['websocket'],
            reconnection: false,
            forceNew: true
        });
        await waitForEvent(socket, 'connect');
        sockets.push(socket);
        return socket;
    };

    const timeoutSettings = {
        maxAttempts: 2,
        timeLimit: 0.05,
        syncMode: false,
        nonstopMode: false,
        globalPick: false,
        tagBan: false
    };

    try {
        const soloRoomId = 'server-timeout-solo';
        const host = await connectPlayer('host');
        const p1 = await connectPlayer('p1');
        host.emit('createRoom', { roomId: soloRoomId, username: 'host' });
        p1.emit('joinRoom', { roomId: soloRoomId, username: 'p1' });
        await waitUntil(() => rooms.get(soloRoomId)?.players.length === 2);
        await emitWithAck(host, 'updatePlayerTeam', { roomId: soloRoomId, team: '0' });
        p1.emit('toggleReady', { roomId: soloRoomId });
        await waitUntil(() => rooms.get(soloRoomId)?.players.find(p => p.username === 'p1')?.ready);

        const soloStart = await emitWithAck(host, 'gameStart', {
            roomId: soloRoomId,
            character: encryptedCharacter(1001),
            settings: timeoutSettings
        });
        assert.equal(soloStart.ok, true);
        await waitUntil(() => !rooms.get(soloRoomId)?.currentGame, 8000, 10);
        assert.equal(rooms.get(soloRoomId).players.find(p => p.username === 'p1').guesses, '⏱️⏱️💀');

        const teamRoomId = 'server-timeout-team';
        const teamHost = await connectPlayer('team-host');
        const t1 = await connectPlayer('t1');
        const t2 = await connectPlayer('t2');
        teamHost.emit('createRoom', { roomId: teamRoomId, username: 'team-host' });
        t1.emit('joinRoom', { roomId: teamRoomId, username: 't1' });
        t2.emit('joinRoom', { roomId: teamRoomId, username: 't2' });
        await waitUntil(() => rooms.get(teamRoomId)?.players.length === 3);
        await emitWithAck(teamHost, 'updatePlayerTeam', { roomId: teamRoomId, team: '0' });
        await emitWithAck(t1, 'updatePlayerTeam', { roomId: teamRoomId, team: '1' });
        await emitWithAck(t2, 'updatePlayerTeam', { roomId: teamRoomId, team: '1' });
        t1.emit('toggleReady', { roomId: teamRoomId });
        t2.emit('toggleReady', { roomId: teamRoomId });
        await waitUntil(() => rooms.get(teamRoomId)?.players.filter(p => p.username !== 'team-host').every(p => p.ready));

        const teamStart = await emitWithAck(teamHost, 'gameStart', {
            roomId: teamRoomId,
            character: encryptedCharacter(1002),
            settings: timeoutSettings
        });
        assert.equal(teamStart.ok, true);
        await waitUntil(() => !rooms.get(teamRoomId)?.currentGame, 8000, 10);
        assert.equal(rooms.get(teamRoomId).players.find(p => p.username === 't1').guesses, '⏱️⏱️💀');
        assert.equal(rooms.get(teamRoomId).players.find(p => p.username === 't2').guesses, '⏱️⏱️💀');
    } finally {
        for (const socket of sockets) {
            try {
                socket.disconnect();
            } catch (_e) {
                // ignore
            }
        }
        await new Promise(resolve => io.close(resolve));
        await new Promise(resolve => httpServer.close(resolve));
    }
});

test('multiplayer server keeps state authoritative during settings, reconnect, and win flows', { timeout: 30000 }, async () => {
    const rooms = new Map();
    const httpServer = http.createServer();
    const io = new Server(httpServer, {
        path: '/api/ws',
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    setupSocket(io, rooms);

    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const port = httpServer.address().port;
    const roomId = 'authoritative-room';
    const sockets = [];

    const connectPlayer = async (username) => {
        const socket = Client(`http://127.0.0.1:${port}`, {
            path: '/api/ws',
            transports: ['websocket'],
            reconnection: false,
            forceNew: true
        });
        await waitForEvent(socket, 'connect');
        sockets.push(socket);
        return socket;
    };

    const startRound = async (host, settings, answerId) => {
        const startAck = await emitWithAck(host, 'gameStart', {
            roomId,
            settings,
            character: encryptedCharacter(answerId)
        });
        assert.equal(startAck.ok, true, `round ${answerId} should start`);
        await waitUntil(() => rooms.get(roomId)?.currentGame?.answerCharacterId === String(answerId));
    };

    try {
        const host = await connectPlayer('host');
        const p1 = await connectPlayer('p1');
        const p2 = await connectPlayer('p2');

        host.emit('createRoom', { roomId, username: 'host' });
        p1.emit('joinRoom', { roomId, username: 'p1' });
        p2.emit('joinRoom', { roomId, username: 'p2' });
        await waitUntil(() => rooms.get(roomId)?.players.length === 3);
        p1.emit('toggleReady', { roomId });
        p2.emit('toggleReady', { roomId });
        await waitUntil(() => rooms.get(roomId)?.players.filter(p => !p.isHost).every(p => p.ready));

        const syncSettings = {
            maxAttempts: 4,
            syncMode: true,
            nonstopMode: false,
            globalPick: false,
            tagBan: false
        };
        host.emit('updateGameSettings', { roomId, settings: syncSettings });
        await startRound(host, syncSettings, 700);

        const settingsDuringGame = await emitWithAck(host, 'updateGameSettings', {
            roomId,
            settings: { ...syncSettings, maxAttempts: 1 }
        });
        assert.equal(settingsDuringGame.ok, false, 'settings updates during a game should be rejected');
        assert.equal(rooms.get(roomId).currentGame.settings.maxAttempts, 4, 'current game settings should not be mutated');

        const teamDuringGame = await emitWithAck(p1, 'updatePlayerTeam', { roomId, team: '1' });
        assert.equal(teamDuringGame.ok, false, 'team changes during a game should be rejected');
        assert.equal(rooms.get(roomId).players.find(p => p.username === 'p1').team, null);

        const manualDuringGame = await emitWithAck(host, 'enterManualMode', { roomId });
        assert.equal(manualDuringGame.ok, false, 'manual mode should be rejected during a game');
        const setterDuringGame = await emitWithAck(host, 'setAnswerSetter', { roomId, setterId: p1.id });
        assert.equal(setterDuringGame.ok, false, 'answer setter selection should be rejected during a game');

        const p1Guess = await emitWithAck(p1, 'playerGuess', {
            roomId,
            guessResult: { guessData: { id: 701, name: 'round-one' } }
        });
        assert.equal(p1Guess.ok, true);
        await waitUntil(() => rooms.get(roomId)?.currentGame?.syncPlayersCompleted?.has(p1.id));
        assert.equal(rooms.get(roomId).players.find(p => p.username === 'p1')?.syncCompletedRound, 1);

        const p1OldId = p1.id;
        p1.disconnect();
        await waitUntil(() => rooms.get(roomId)?.players.find(p => p.username === 'p1')?.disconnected === true);
        assert.equal(rooms.get(roomId).currentGame.syncPlayersCompleted.has(p1OldId), true, 'disconnect should not erase completed sync state');

        const p1Reconnect = await connectPlayer('p1');
        p1Reconnect.emit('joinRoom', { roomId, username: 'p1' });
        await waitUntil(() => rooms.get(roomId)?.players.find(p => p.username === 'p1')?.id === p1Reconnect.id);
        assert.equal(rooms.get(roomId).currentGame.syncPlayersCompleted.has(p1Reconnect.id), true, 'reconnect should migrate completed sync state');
        const migratedEntry = rooms.get(roomId).currentGame.guesses
            .find(g => g.username === 'p1')?.guesses?.[0];
        assert.equal(migratedEntry.playerId, p1Reconnect.id, 'guess history player id should migrate on reconnect');

        const p2Guess = await emitWithAck(p2, 'playerGuess', {
            roomId,
            guessResult: { guessData: { id: 702, name: 'round-one-p2' } }
        });
        assert.equal(p2Guess.ok, true);
        const hostGuess = await emitWithAck(host, 'playerGuess', {
            roomId,
            guessResult: { guessData: { id: 703, name: 'round-one-host' } }
        });
        assert.equal(hostGuess.ok, true);
        await waitUntil(() => rooms.get(roomId)?.currentGame?.syncRound === 2);

        p1Reconnect.emit('enterObserverMode', { roomId });
        p2.emit('enterObserverMode', { roomId });
        host.emit('enterObserverMode', { roomId });
        await waitUntil(() => !rooms.get(roomId)?.currentGame);

        rooms.get(roomId).players.forEach(p => {
            p.guesses = '';
            p.ready = p.username !== 'host';
            p.team = null;
            p.disconnected = false;
            delete p._tempObserver;
            delete p.syncCompletedRound;
        });
        await startRound(host, { ...syncSettings, syncMode: false }, 800);
        const winEnd = waitForEvent(host, 'gameEnded');
        const winGuess = await emitWithAck(p2, 'playerGuess', {
            roomId,
            guessResult: { guessData: { id: 800, name: 'atomic-win' } }
        });
        assert.equal(winGuess.ok, true);
        assert.equal(winGuess.isCorrect, true);
        await winEnd;
        assert.equal(rooms.get(roomId)?.currentGame, null, 'correct guess should end standard game without gameEnd event');

        rooms.get(roomId).players.forEach(p => {
            p.guesses = '';
            p.ready = p.username !== 'host';
            p.team = null;
            p.disconnected = false;
            delete p._tempObserver;
            delete p.syncCompletedRound;
        });
        await startRound(host, { ...syncSettings, syncMode: false, nonstopMode: true }, 900);
        const nonstopWin = await emitWithAck(p2, 'playerGuess', {
            roomId,
            guessResult: { guessData: { id: 900, name: 'nonstop-atomic-win' } }
        });
        assert.equal(nonstopWin.ok, true);
        assert.equal(nonstopWin.isCorrect, true);
        assert.equal(rooms.get(roomId).currentGame.nonstopWinners.some(w => w.id === p2.id), true, 'nonstop winner should be written by playerGuess');
    } finally {
        for (const socket of sockets) {
            try {
                socket.disconnect();
            } catch (_e) {
                // ignore
            }
        }
        await new Promise(resolve => io.close(resolve));
        await new Promise(resolve => httpServer.close(resolve));
    }
});
