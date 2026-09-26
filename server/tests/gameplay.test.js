const test = require('node:test');
const assert = require('node:assert/strict');

const {
    enforceAttemptLimit,
    handlePlayerTimeout,
    countAttemptMarks,
    buildScoreChanges,
    finalizeStandardGame
} = require('../utils/gameplay');

function createMockIo() {
    return {
        events: [],
        to(target) {
            return {
                emit: (eventName, payload) => {
                    this.events.push({ target, eventName, payload });
                }
            };
        }
    };
}

test('countAttemptMarks should count only attempt marks', () => {
    const marks = '✔❌💡⏱️✌🏳️';
    assert.equal(countAttemptMarks(marks), 4);
});

test('enforceAttemptLimit should apply death when solo player reaches max attempts', () => {
    const io = createMockIo();
    const room = {
        currentGame: {
            settings: { maxAttempts: 3, syncMode: false }
        },
        players: []
    };
    const player = {
        id: 'p1',
        username: 'solo',
        guesses: '✔❌❌',
        team: null,
        isAnswerSetter: false,
        disconnected: false
    };
    room.players = [player];

    const result = enforceAttemptLimit(room, player, io, 'room-a', { isCorrect: false });

    assert.equal(result.exhausted, true);
    assert.equal(result.appliedDeath, true);
    assert.ok(player.guesses.includes('💀'));
    assert.equal(countAttemptMarks(player.guesses), 3);
});

test('enforceAttemptLimit should sync death mark to all active teammates', () => {
    const io = createMockIo();
    const room = {
        currentGame: {
            settings: { maxAttempts: 2, syncMode: false },
            teamGuesses: { '1': '✔❌' }
        },
        players: [
            { id: 'a', username: 'a', team: '1', guesses: '✔❌', isAnswerSetter: false, disconnected: false },
            { id: 'b', username: 'b', team: '1', guesses: '✔❌', isAnswerSetter: false, disconnected: false }
        ]
    };

    const result = enforceAttemptLimit(room, room.players[0], io, 'room-a', { isCorrect: false });

    assert.equal(result.exhausted, true);
    assert.equal(room.currentGame.teamGuesses['1'], '✔❌💀');
    assert.equal(room.players[0].guesses, '✔❌💀');
    assert.equal(room.players[1].guesses, '✔❌💀');
});

test('handlePlayerTimeout should append timeout and then apply death at max', () => {
    const io = createMockIo();
    const room = {
        currentGame: {
            settings: { maxAttempts: 2, syncMode: false }
        },
        players: []
    };
    const player = {
        id: 'p1',
        username: 'solo',
        guesses: '✔',
        team: null,
        isAnswerSetter: false,
        disconnected: false
    };
    room.players = [player];

    const result = handlePlayerTimeout(room, player, io, 'room-timeout');

    assert.equal(result.needsSyncUpdate, false);
    assert.ok(player.guesses.includes('💀'));
    assert.equal(countAttemptMarks(player.guesses), 2);
    assert.ok(io.events.some(e => e.eventName === 'resetTimer') === false);
});

test('handlePlayerTimeout should consume one timeout attempt per active teammate', () => {
    const io = createMockIo();
    const room = {
        currentGame: {
            settings: { maxAttempts: 2, syncMode: false },
            teamGuesses: { '1': '' }
        },
        players: [
            { id: 'a', username: 'a', team: '1', guesses: '', isAnswerSetter: false, disconnected: false },
            { id: 'b', username: 'b', team: '1', guesses: '', isAnswerSetter: false, disconnected: false }
        ]
    };

    const result = handlePlayerTimeout(room, room.players[0], io, 'room-team-timeout');

    assert.equal(result.needsSyncUpdate, false);
    assert.equal(countAttemptMarks(room.currentGame.teamGuesses['1']), 2);
    assert.equal(room.currentGame.teamGuesses['1'], '⏱️⏱️💀');
    assert.equal(room.players[0].guesses, '⏱️⏱️💀');
    assert.equal(room.players[1].guesses, '⏱️⏱️💀');
});

test('buildScoreChanges should keep partial score and classify surrender after emoji marks', () => {
    const scoreChanges = buildScoreChanges({
        players: [
            { id: 'p1', username: 'partial-surrender', guesses: '💡🏳️', team: null, isAnswerSetter: false }
        ],
        partialAwardees: new Set(['p1']),
        isNonstopMode: false
    });

    assert.equal(scoreChanges.p1.score, 1);
    assert.deepEqual(scoreChanges.p1.breakdown, { partial: 1 });
    assert.equal(scoreChanges.p1.result, 'surrender');
});

test('standard sync settlement calculates first-guess and speed bonuses per winner', () => {
    const io = createMockIo();
    const players = ['✔👑', '❌✔✌', '❌❌❌✔✌', '❌❌❌❌❌✔✌'].map((guesses, index) => ({
        id: `p${index}`, username: `player-${index}`, guesses, score: 0, team: null
    }));
    const room = {
        players,
        currentGame: {
            settings: { syncMode: true, nonstopMode: false, maxAttempts: 10 },
            firstWinner: { id: 'p0', isBigWin: true },
            guesses: players.map(player => ({
                username: player.username,
                guesses: [{ playerId: player.id, isCorrect: true }]
            }))
        }
    };

    assert.equal(finalizeStandardGame(room, 'room-sync-score', io), true);
    assert.deepEqual(players.map(player => player.score), [14, 4, 3, 2]);
    const details = io.events.find(event => event.eventName === 'gameEnded').payload.scoreDetails;
    assert.deepEqual(details.map(detail => detail.breakdown.bigWin), [12, 0, 0, 0]);
    assert.deepEqual(details.map(detail => detail.breakdown.quickGuess), [0, 2, 1, 0]);
});
