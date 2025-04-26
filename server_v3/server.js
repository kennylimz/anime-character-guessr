const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const cors = require('cors');
const {startSelfPing} = require('./utils/selfPing');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const cors_options = {
    origin: [CLIENT_URL, SERVER_URL],
    methods: ['GET', 'POST'],
    credentials: true
}

const io = new Server(server, {
    cors: cors_options
});

app.use(cors(cors_options));

// Store room data
const rooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle room creation
    socket.on('createRoom', ({roomId, username}) => {
        // Basic validation
        if (!username || username.trim().length === 0) {
            socket.emit('error', {message: '用户名呢'});
            return;
        }

        if (rooms.has(roomId)) {
            socket.emit('error', {message: '房间已存在？但为什么？'});
            return;
        }

        if (rooms.size >= 259) {
            socket.emit('error', {message: '服务器已满，请稍后再试'});
            return;
        }

        rooms.set(roomId, {
            host: socket.id,
            isPublic: true, // Default to public
            players: [{
                id: socket.id,
                username,
                isHost: true,
                score: 0,
                ready: false,
                guesses: ''
            }]
        });

        // Join socket to room
        socket.join(roomId);

        // Send room data back to host
        io.to(roomId).emit('updatePlayers', {
            players: rooms.get(roomId).players,
            isPublic: rooms.get(roomId).isPublic
        });

        console.log(`Room ${roomId} created by ${username}`);
    });

    // Handle room joining
    socket.on('joinRoom', ({roomId, username}) => {
        // Basic validation
        if (!username || username.trim().length === 0) {
            socket.emit('error', {message: '用户名呢'});
            return;
        }

        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Check if room is private
        if (!room.isPublic) {
            socket.emit('error', {message: '房间已锁定，无法加入'});
            return;
        }

        // Check if game is in progress
        if (room.currentGame) {
            socket.emit('error', {message: '游戏正在进行中，无法加入'});
            return;
        }

        // Check for duplicate username (case-insensitive)
        const isUsernameTaken = room.players.some(
            player => player.username.toLowerCase() === username.toLowerCase()
        );

        if (isUsernameTaken) {
            socket.emit('error', {message: '换个名字吧'});
            return;
        }

        // Add player to room
        room.players.push({
            id: socket.id,
            username,
            isHost: false,
            score: 0,
            ready: false,
            guesses: ''
        });

        // Join socket to room
        socket.join(roomId);

        // Send updated player list to all clients in room
        io.to(roomId).emit('updatePlayers', {
            players: room.players,
            isPublic: room.isPublic
        });

        console.log(`${username} joined room ${roomId}`);
    });

    // Handle ready status toggle
    socket.on('toggleReady', ({roomId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Find the player
        const player = room.players.find(p => p.id === socket.id);

        if (!player) {
            socket.emit('error', {message: 'Player not found in room'});
            return;
        }

        // Don't allow host to toggle ready status
        if (player.isHost) {
            socket.emit('error', {message: '房主不需要准备'});
            return;
        }

        // Toggle ready status
        player.ready = !player.ready;

        // Notify all players in the room about the update
        io.to(roomId).emit('updatePlayers', {
            players: room.players
        });

        console.log(`Player ${player.username} ${player.ready ? 'is now ready' : 'is no longer ready'} in room ${roomId}`);
    });

    // Handle game settings update
    socket.on('updateGameSettings', ({roomId, settings}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Only allow host to update settings
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', {message: '只有房主可以更改设置'});
            return;
        }

        // Store settings in room data
        room.settings = settings;

        // Broadcast settings to all clients in the room
        io.to(roomId).emit('updateGameSettings', {settings});

        console.log(`Game settings updated in room ${roomId}`);
    });

    // Handle game start
    socket.on('gameStart', ({roomId, character, settings}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Set room to private when game starts
        room.isPublic = false;

        // Only allow host to start game
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', {message: '只有房主可以开始游戏'});
            return;
        }

        // Check if all non-disconnected players are ready
        const allReady = room.players.every(p => p.isHost || p.ready || p.disconnected);
        if (!allReady) {
            socket.emit('error', {message: '所有玩家必须准备好才能开始游戏'});
            return;
        }

        // Remove disconnected players with 0 score
        room.players = room.players.filter(p => !p.disconnected || p.score > 0);

        // Store current game state in room data
        room.currentGame = {
            settings,
            guesses: [] // Initialize guesses as an array of objects
        };

        // Reset all players' game state
        room.players.forEach(p => {
            p.guesses = '';
            // Initialize each player's guesses array using their username
            room.currentGame.guesses.push({username: p.username, guesses: []});
        });

        // Broadcast game start and updated players to all clients in the room in a single event
        io.to(roomId).emit('gameStart', {
            character,
            settings,
            players: room.players,
            isPublic: false
        });

        console.log(`Game started in room ${roomId}`);
    });

    // Handle player guesses
    socket.on('playerGuess', ({roomId, guessResult}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', {message: 'Player not found in room'});
            return;
        }

        // Store guess in the player's guesses array using their username
        if (room.currentGame) {
            const playerGuesses = room.currentGame.guesses.find(g => g.username === player.username);
            if (playerGuesses) {
                playerGuesses.guesses.push({
                    playerId: socket.id,
                    playerName: player.username,
                    ...guessResult
                });

                // Send real-time guess history update to the original answer setter
                const originalAnswerSetter = room.players.find(p => p.isAnswerSetter);
                if (originalAnswerSetter) {
                    io.to(originalAnswerSetter.id).emit('guessHistoryUpdate', {
                        guesses: room.currentGame.guesses
                    });
                }
            }
        }

        // Update player's guesses string
        player.guesses += guessResult.isCorrect ? '✔' : '❌';

        // Broadcast updated players to all clients in the room
        io.to(roomId).emit('updatePlayers', {
            players: room.players
        });

        console.log(`Player ${player.username} made a guess in room ${roomId}: ${guessResult.name} (${guessResult.isCorrect ? 'correct' : 'incorrect'})`);
    });

    // Handle game end
    socket.on('gameEnd', ({roomId, result}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', {message: 'Player not found in room'});
            return;
        }

        // Update player's guesses string
        switch (result) {
            case 'surrender':
                player.guesses += '🏳️';
                break;
            case 'win':
                player.guesses += '✌';
                break;
            default:
                player.guesses += '💀';
        }

        // Check if all non-answer-setter players have ended their game or disconnected
        const activePlayers = room.players.filter(p => !p.isAnswerSetter);
        const allEnded = activePlayers.every(p => 
            p.guesses.includes('✌') || 
            p.guesses.includes('💀') || 
            p.guesses.includes('🏳️') || 
            p.disconnected
        );
        const winner = activePlayers.find(p => p.guesses.includes('✌'));

        const handleGameEnd = () => {
            // Get the answer setter before resetting status
            const answerSetter = room.players.find(p => p.isAnswerSetter);

            // If there was an answer setter (manual mode)
            if (answerSetter) {
                if (winner) {
                    // If winner took many guesses
                    if (winner.guesses.length > 5) {
                        answerSetter.score += 1;
                        io.to(roomId).emit('gameEnded', {
                            message: `赢家是: ${winner.username}！出题人 ${answerSetter.username} 获得1分！`,
                            guesses: room.currentGame?.guesses || []
                        });
                    } else {
                        io.to(roomId).emit('gameEnded', {
                            message: `赢家是: ${winner.username}！`,
                            guesses: room.currentGame?.guesses || []
                        });
                    }
                } else {
                    // Deduct point from answer setter for no winner
                    answerSetter.score--;
                    io.to(roomId).emit('gameEnded', {
                        message: `已经结束咧🙄！没人猜中，出题人 ${answerSetter.username} 扣1分！`,
                        guesses: room.currentGame?.guesses || []
                    });
                }
            } else {
                // Normal mode end messages
                io.to(roomId).emit('gameEnded', {
                    message: winner ? `赢家是: ${winner.username}` : '已经结束咧🙄！没人猜中',
                    guesses: room.currentGame?.guesses || []
                });
            }

            // Reset answer setter status for all players
            room.players.forEach(p => {
                p.isAnswerSetter = false;
            });

            // Reset ready status
            io.to(roomId).emit('resetReadyStatus');

            // Clear current game state
            room.currentGame = null;

            // Broadcast updated players to ensure answer setter status is reset
            io.to(roomId).emit('updatePlayers', {
                players: room.players,
                isPublic: room.isPublic,
                answerSetterId: null
            });
        };

        if (winner) {
            // Increment winner's score by 1
            winner.score += 1;
            handleGameEnd();
        } else if (allEnded) {
            handleGameEnd();
        } else {
            // Just broadcast updated players for this individual player's end
            io.to(roomId).emit('updatePlayers', {
                players: room.players
            });
        }

        console.log(`Player ${player.username} ended their game in room ${roomId} with result: ${result}`);
    });

    // Handle game settings request
    socket.on('requestGameSettings', ({roomId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Send current settings to the requesting client
        if (room.settings) {
            socket.emit('updateGameSettings', {settings: room.settings});
            console.log(`Game settings sent to new player in room ${roomId}`);
        }
    });

    // Handle surrender event
    socket.on('surrender', ({roomId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', {message: 'Player not found in room'});
            return;
        }

        // Append 🏳️ to player's guesses
        player.guesses += '🏳️';

        // Broadcast updated players to all clients in the room
        io.to(roomId).emit('updatePlayers', {
            players: room.players
        });

        console.log(`Player ${player.username} surrendered in room ${roomId}`);
    });

    // Handle timeout event
    socket.on('timeOut', ({roomId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', {message: 'Player not found in room'});
            return;
        }

        // Append ⏱️ to player's guesses
        player.guesses += '⏱️';

        // Broadcast updated players to all clients in the room
        io.to(roomId).emit('updatePlayers', {
            players: room.players
        });

        console.log(`Player ${player.username} timed out in room ${roomId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        // Find and remove player from their room
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);

            if (playerIndex !== -1) {
                const disconnectedPlayer = room.players[playerIndex];

                if (room.host === socket.id) {
                    rooms.delete(roomId);
                    // Notify remaining players the room is closed
                    io.to(roomId).emit('roomClosed', {message: 'Host disconnected'});
                    console.log(`Host ${disconnectedPlayer.username} disconnected. Room ${roomId} closed and disbanded.`);
                } else {
                    // Remove player if score is 0, otherwise mark as disconnected
                    if (disconnectedPlayer.score === 0) {
                        room.players.splice(playerIndex, 1);
                    } else {
                        disconnectedPlayer.disconnected = true;
                    }
                    // Update player list for remaining players
                    io.to(roomId).emit('updatePlayers', {
                        players: room.players
                    });
                    console.log(`Player ${disconnectedPlayer.username} ${disconnectedPlayer.score === 0 ? 'removed from' : 'disconnected from'} room ${roomId}.`);
                }
                break; // Exit loop once player is found and handled
            }
        }

        console.log(`User ${socket.id} disconnected`); // General disconnect log
    });

    // Handle room visibility toggle
    socket.on('toggleRoomVisibility', ({roomId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Only allow host to toggle visibility
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', {message: '只有房主可以更改房间状态'});
            return;
        }

        // Toggle visibility
        room.isPublic = !room.isPublic;

        // Notify all players in the room about the update
        io.to(roomId).emit('updatePlayers', {
            players: room.players,
            isPublic: room.isPublic
        });

        console.log(`Room ${roomId} visibility changed to ${room.isPublic ? 'public' : 'private'}`);
    });

    // Handle entering manual mode
    socket.on('enterManualMode', ({roomId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Only allow host to enter manual mode
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', {message: '只有房主可以进入出题模式'});
            return;
        }

        // Set all non-host players as ready
        room.players.forEach(p => {
            if (!p.isHost) {
                p.ready = true;
            }
        });

        // Notify all players in the room about the update
        io.to(roomId).emit('updatePlayers', {
            players: room.players,
            isPublic: room.isPublic
        });

        console.log(`Room ${roomId} entered manual mode`);
    });

    // Handle setting answer setter
    socket.on('setAnswerSetter', ({roomId, setterId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Only allow host to set answer setter
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', {message: '只有房主可以选择出题人'});
            return;
        }

        // Find the selected player
        const setter = room.players.find(p => p.id === setterId);
        if (!setter) {
            socket.emit('error', {message: '找不到选中的玩家'});
            return;
        }

        // Update room state
        room.isPublic = false;
        room.answerSetterId = setterId;
        room.waitingForAnswer = true;

        // Notify all players in the room about the update
        io.to(roomId).emit('updatePlayers', {
            players: room.players,
            isPublic: room.isPublic,
            answerSetterId: setterId
        });

        // Emit waitForAnswer event
        io.to(roomId).emit('waitForAnswer', {
            answerSetterId: setterId,
            setterUsername: setter.username
        });

        console.log(`Answer setter set to ${setter.username} in room ${roomId}`);
    });

    // Handle kicking disconnected players
    socket.on('kickPlayer', ({roomId, playerId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: '房间不存在'});
            return;
        }

        // 只允许房主踢出玩家
        const host = room.players.find(p => p.id === socket.id);
        if (!host || !host.isHost) {
            socket.emit('error', {message: '只有房主可以踢出玩家'});
            return;
        }

        // 找到要踢出的玩家
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) {
            socket.emit('error', {message: '找不到要踢出的玩家'});
            return;
        }

        const playerToKick = room.players[playerIndex];
        
        // 验证玩家是否断开连接
        if (!playerToKick.disconnected) {
            socket.emit('error', {message: '只能踢出已断开连接的玩家'});
            return;
        }

        // 保存玩家信息用于通知
        const kickedPlayerUsername = playerToKick.username;
        
        // 从房间中移除玩家
        room.players.splice(playerIndex, 1);
        
        // 通知所有玩家
        io.to(roomId).emit('playerKicked', {
            playerId: playerId,
            username: kickedPlayerUsername
        });
        
        // 更新玩家列表
        io.to(roomId).emit('updatePlayers', {
            players: room.players,
            isPublic: room.isPublic
        });
        
        console.log(`Player ${kickedPlayerUsername} kicked from room ${roomId}`);
    });

    // Handle answer setting from designated player
    socket.on('setAnswer', ({roomId, character, hints}) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', {message: 'Room not found'});
            return;
        }

        // Only allow designated answer setter to set answer
        if (socket.id !== room.answerSetterId) {
            socket.emit('error', {message: '你不是指定的出题人'});
            return;
        }

        // Remove disconnected players with 0 score
        room.players = room.players.filter(p => !p.disconnected || p.score > 0);

        // Store current game state in room data
        room.currentGame = {
            settings: room.settings,
            guesses: [] // Initialize guesses as an array of objects
        };

        // Reset all players' game state and mark the answer setter
        room.players.forEach(p => {
            p.guesses = '';
            p.isAnswerSetter = (p.id === socket.id); // Mark the answer setter
            // Initialize each player's guesses array using their username
            if (!p.isAnswerSetter) { // Only initialize guesses for non-answer setters
                room.currentGame.guesses.push({username: p.username, guesses: []});
            }
        });

        // Reset room state
        room.waitingForAnswer = false;
        room.answerSetterId = null;

        // Send initial empty guess history to answer setter
        socket.emit('guessHistoryUpdate', {
            guesses: room.currentGame.guesses
        });

        // Broadcast game start to all clients in the room
        io.to(roomId).emit('gameStart', {
            character,
            settings: room.settings,
            players: room.players,
            isPublic: false,
            hints: hints,
            isAnswerSetter: false
        });

        // Send special game start event to answer setter
        socket.emit('gameStart', {
            character,
            settings: room.settings,
            players: room.players,
            isPublic: false,
            hints: hints,
            isAnswerSetter: true
        });

        console.log(`Game started in room ${roomId} with custom answer`);
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('Server is active');
});

startSelfPing();

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get('/', (req, res) => {
    res.send(`Hello from the server!`);
});

app.get('/room-count', (req, res) => {
    res.json({count: rooms.size});
});
