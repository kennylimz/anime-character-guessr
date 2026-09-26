const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const setupSocket = require('../utils/socket');

async function waitUntil(predicate) {
    const deadline = Date.now() + 3000;
    while (!predicate()) {
        if (Date.now() >= deadline) assert.fail('Room state did not update');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

async function createScoringRoom(t, { syncMode, nonstopMode = true, playerOptions = [{}, {}, {}], settingsOverride = {} }) {
    const rooms = new Map();
    const httpServer = http.createServer();
    const io = new Server(httpServer, { path: '/api/ws' });
    setupSocket(io, rooms);
    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const sockets = [];
    t.after(async () => {
        sockets.forEach(socket => socket.disconnect());
        await new Promise(resolve => io.close(resolve));
        await new Promise(resolve => httpServer.close(resolve));
    });

    const roomId = 'scoring-room';
    for (const [index, options] of [{}, ...playerOptions].entries()) {
        const socket = Client(`http://127.0.0.1:${httpServer.address().port}`, {
            path: '/api/ws', transports: ['websocket'], reconnection: false, forceNew: true
        });
        sockets.push(socket);
        await once(socket, 'connect');
        socket.emit(index === 0 ? 'createRoom' : 'joinRoom', {
            roomId, username: `player-${index}`, ...options
        });
        await waitUntil(() => rooms.get(roomId)?.players.length === index + 1);
    }

    const [host, ...players] = sockets;
    const command = (socket, event, payload = {}) => socket.timeout(3000).emitWithAck(event, { roomId, ...payload });
    assert.equal((await command(host, 'updatePlayerTeam', { team: '0' })).ok, true);
    for (const [index, player] of players.entries()) {
        if (playerOptions[index].team) {
            assert.equal((await command(player, 'updatePlayerTeam', { team: playerOptions[index].team })).ok, true);
        }
        player.emit('toggleReady', { roomId });
    }
    await waitUntil(() => rooms.get(roomId).players.slice(1).every(player => player.ready));

    const settings = { maxAttempts: 10, syncMode, nonstopMode, timeLimit: 0, globalPick: false, tagBan: false, ...settingsOverride };
    const answerId = 900;
    assert.equal((await command(host, 'gameStart', { settings, character: { id: answerId } })).ok, true);
    return {
        room: rooms.get(roomId), host, players, answerId, command,
        guess: (socket, id = answerId) => command(socket, 'playerGuess', {
            guessResult: { guessData: { id, name: `character-${id}` } }
        })
    };
}

for (const syncMode of [true, false]) {
    test(`nonstop scores and broadcasts ${syncMode ? 'tied round ranks' : 'arrival ranks'}`, { timeout: 10000 }, async t => {
        const { room, host, players, guess, answerId } = await createScoringRoom(t, { syncMode });
        const progress = [];
        host.on('nonstopProgress', payload => progress.push(payload));
        const first = await guess(players[0]);
        const second = await guess(players[1]);
        const expectedRanks = syncMode ? [1, 1, 3] : [1, 2, 3];
        assert.equal(first.settlement.rank, expectedRanks[0]);
        assert.equal(second.settlement.rank, expectedRanks[1]);
        assert.equal(second.settlement.score, syncMode ? 15 : 14);

        if (syncMode) {
            assert.equal((await guess(players[2], answerId + 1)).ok, true);
            assert.equal(room.currentGame.syncRound, 2);
            assert.equal(room.currentGame.syncRoundStartRank, 3);
        }

        const ended = once(host, 'gameEnded');
        const third = await guess(players[2]);
        assert.equal(third.settlement.rank, 3);
        const [result] = await ended;
        assert.equal(room.currentGame, null);
        assert.deepEqual(result.scoreDetails.map(detail => detail.breakdown.rank), expectedRanks);
        assert.deepEqual(result.scoreDetails.map(detail => detail.breakdown.base), syncMode ? [3, 3, 1] : [3, 2, 1]);
        assert.deepEqual(result.scoreDetails.map(detail => detail.score), syncMode ? [15, 15, 3] : [15, 14, 13]);
        assert.deepEqual(progress.at(-1).winners.map(winner => winner.rank), expectedRanks);
    });
}

test('standard sync winners retain their own avatar and quick-guess bonuses', { timeout: 10000 }, async t => {
    const { room, host, players, guess, answerId } = await createScoringRoom(t, {
        syncMode: true, nonstopMode: false, playerOptions: [{}, { avatarId: 900 }, {}]
    });
    for (const player of players) assert.equal((await guess(player, answerId + 1)).ok, true);
    assert.equal(room.currentGame.syncRound, 2);

    const ended = once(host, 'gameEnded');
    for (const player of players) assert.equal((await guess(player)).ok, true);
    const [result] = await ended;
    assert.deepEqual(result.scoreDetails.map(detail => detail.score), [4, 14, 4]);
    assert.deepEqual(result.scoreDetails.map(detail => detail.breakdown.bigWin), [0, 12, 0]);
    assert.deepEqual(result.scoreDetails.map(detail => detail.breakdown.quickGuess), [2, 0, 2]);
    assert.deepEqual(room.players.slice(1).map(player => player.score), [4, 14, 4]);
});

test('standard sync team victory rewards only the accepted correct guesser', { timeout: 10000 }, async t => {
    const { room, host, players, guess, answerId } = await createScoringRoom(t, {
        syncMode: true, nonstopMode: false,
        playerOptions: [{ team: '1', avatarId: 900 }, { team: '1' }, {}]
    });
    assert.equal((await guess(players[0], answerId + 1)).ok, true);
    assert.equal((await guess(players[2], answerId + 1)).ok, true);
    assert.equal(room.currentGame.syncRound, 2);

    const ended = once(host, 'gameEnded');
    assert.equal((await guess(players[1])).ok, true);
    assert.equal((await guess(players[2])).ok, true);
    const [result] = await ended;
    const team = result.scoreDetails.find(detail => detail.type === 'team');
    assert.equal(team.teamScore, 4);
    assert.deepEqual(team.members.map(member => member.score), [0, 4]);
    assert.equal(team.members[0].result, 'teamwin');
    assert.equal(team.members[1].breakdown.bigWin, 0, 'a teammate avatar must not grant the guesser a bonus');
    assert.equal(team.members[1].breakdown.quickGuess, 2, 'team attempts remain shared');
    assert.deepEqual(room.players.slice(1).map(player => player.score), [0, 4, 4]);
});

test('accepted guesses register tags before sync advances and rejected guesses cannot register tags', { timeout: 10000 }, async t => {
    const { room, players, command } = await createScoringRoom(t, {
        syncMode: true, nonstopMode: false, settingsOverride: { globalPick: true, tagBan: true }
    });
    const submit = (player, id, tags) => command(player, 'playerGuess', {
        guessResult: { guessData: { id, name: `character-${id}` } }, sharedMetaTags: tags
    });
    assert.equal((await submit(players[0], 800, ['首位标签'])).tagBanApplied, true);
    const rejected = await submit(players[0], 801, ['拒绝的标签']);
    assert.equal(rejected.ok, false, 'a second guess in the same sync round must fail');
    assert.equal(room.currentGame.tagBanStatePending.some(entry => entry.tag === '拒绝的标签'), false);
    assert.equal((await submit(players[1], 802, [])).tagBanApplied, true);
    assert.equal((await submit(players[2], 803, ['最后标签'])).tagBanApplied, true);
    assert.equal(room.currentGame.syncRound, 2);
    assert.deepEqual(room.currentGame.tagBanState.map(entry => entry.tag), ['首位标签', '最后标签']);
    assert.deepEqual(room.currentGame.tagBanStatePending, []);
    assert.equal(room.currentGame.tagBanState.every(entry => players.every(player => entry.revealer.includes(player.id))), true);

    const duplicate = await submit(players[1], 800, ['重复拒绝标签']);
    assert.equal(duplicate.ok, false);
    assert.equal(room.currentGame.tagBanStatePending.length, 0);
    players[0].emit('tagBanSharedMetaTags', { roomId: 'scoring-room', tags: ['旧客户端标签'] });
    await waitUntil(() => room.currentGame.tagBanStatePending.some(entry => entry.tag === '旧客户端标签'));
});
