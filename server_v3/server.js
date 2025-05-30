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
    console.log(`A user connected: ${socket.id}`);

    // Handle room creation
    socket.on('createRoom', ({roomId, username}) => {
        // Basic validation
        if (!username || username.trim().length === 0) {
            console.log(`[ERROR][createRoom][${socket.id}] 用户名呢`);
            socket.emit('error', {message: 'createRoom: 用户名呢'});
            return;
        }

        if (rooms.has(roomId)) {
            console.log(`[ERROR][createRoom][${socket.id}] 房间已存在？但为什么？`);
            socket.emit('error', {message: 'createRoom: 房间已存在？但为什么？'});
            return;
        }

        if (rooms.size >= 259) {
            console.log(`[ERROR][createRoom][${socket.id}] 服务器已满，请稍后再试`);
            socket.emit('error', {message: 'createRoom: 服务器已满，请稍后再试'});
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
                guesses: '',
                message: '',
                team: null
            }],
            lastActive: Date.now()
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
            console.log(`[ERROR][joinRoom][${socket.id}] 用户名呢`);
            socket.emit('error', {message: 'joinRoom: 用户名呢'});
            return;
        }

        const room = rooms.get(roomId);

        if (!room) {
            rooms.set(roomId, {
                host: socket.id,
                isPublic: true, // Default to public
                players: [{
                    id: socket.id,
                    username,
                    isHost: true,
                    score: 0,
                    ready: false,
                    guesses: '',
                    message: '',
                    team: null
                }],
                lastActive: Date.now()
            });
    
            // Join socket to room
            socket.join(roomId);
    
            io.to(roomId).emit('hostTransferred', {
                oldHostName: username,
                newHostId: socket.id,
                newHostName: username
            });

            io.to(roomId).emit('updatePlayers', {
                players: rooms.get(roomId).players,
                isPublic: rooms.get(roomId).isPublic
            });
            
            console.log(`Room ${roomId} created by ${username}`);
            return;
        }

        // Check if room is private
        if (!room.isPublic) {
            console.log(`[ERROR][joinRoom][${socket.id}] 房间已锁定，无法加入`);
            socket.emit('error', {message: 'joinRoom: 房间已锁定，无法加入'});
            return;
        }

        // Check if game is in progress
        if (room.currentGame) {
            console.log(`[ERROR][joinRoom][${socket.id}] 游戏正在进行中，无法加入`);
            socket.emit('error', {message: 'joinRoom: 游戏正在进行中，无法加入'});
            return;
        }

        // Check for duplicate username (case-insensitive)
        const isUsernameTaken = room.players.some(
            player => player.username.toLowerCase() === username.toLowerCase()
        );

        if (isUsernameTaken) {
            console.log(`[ERROR][joinRoom][${socket.id}] 换个名字吧`);
            socket.emit('error', {message: 'joinRoom: 换个名字吧'});
            return;
        }

        // Add player to room
        room.players.push({
            id: socket.id,
            username,
            isHost: false,
            score: 0,
            ready: false,
            guesses: '',
            message: '',
            team: null
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
            console.log(`[ERROR][toggleReady][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'toggleReady: 房间不存在'});
            return;
        }

        // Find the player
        const player = room.players.find(p => p.id === socket.id);

        if (!player) {
            console.log(`[ERROR][toggleReady][${socket.id}] 连接中断了`);
            socket.emit('error', {message: 'toggleReady: 连接中断了'});
            return;
        }

        // Don't allow host to toggle ready status
        if (player.isHost) {
            console.log(`[ERROR][toggleReady][${socket.id}] 房主不需要准备`);
            socket.emit('error', {message: 'toggleReady: 房主不需要准备'});
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
        if (room) room.lastActive = Date.now();

        if (!room) {
            console.log(`[ERROR][updateGameSettings][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'updateGameSettings: 房间不存在'});
            return;
        }

        // Only allow host to update settings
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            console.log(`[ERROR][updateGameSettings][${socket.id}] 只有房主可以更改设置`);
            socket.emit('error', {message: 'updateGameSettings: 只有房主可以更改设置'});
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
        if (room) room.lastActive = Date.now();

        if (!room) {
            console.log(`[ERROR][gameStart][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'gameStart: 房间不存在'});
            return;
        }

        // Set room to private when game starts
        room.isPublic = false;

        // Only allow host to start game
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            console.log(`[ERROR][gameStart][${socket.id}] 只有房主可以开始游戏`);
            socket.emit('error', {message: 'gameStart: 只有房主可以开始游戏'});
            return;
        }

        // Check if all non-disconnected players are ready
        const allReady = room.players.every(p => p.isHost || p.ready || p.disconnected);
        if (!allReady) {
            console.log(`[ERROR][gameStart][${socket.id}] 所有玩家必须准备好才能开始游戏`);
            socket.emit('error', {message: 'gameStart: 所有玩家必须准备好才能开始游戏'});
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
        if (room) room.lastActive = Date.now();

        if (!room) {
            console.log(`[ERROR][playerGuess][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'playerGuess: 房间不存在'});
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            console.log(`[ERROR][playerGuess][${socket.id}] 连接中断了`);
            socket.emit('error', {message: 'playerGuess: 连接中断了'});
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

        // Team guess sharing: broadcast guessData to teammates (not self, only for teams 1-8)
        if (player.team && /^[1-8]$/.test(player.team) && guessResult.guessData && !guessResult.isCorrect) {
            room.players
                .filter(p => p.team === player.team && p.id !== socket.id && !p.isAnswerSetter)
                .forEach(teammate => {
                    io.to(teammate.id).emit('boardcastTeamGuess', {
                        guessData: { ...guessResult.guessData, guessrName: player.username },
                        playerId: socket.id,
                        playerName: player.username
                    });
                });
        }

        // Update player's guesses string
        player.guesses += guessResult.isCorrect ? '✔' : '❌';

        // Broadcast updated players to all clients in the room
        io.to(roomId).emit('updatePlayers', {
            players: room.players
        });

        if (guessResult.guessData && guessResult.guessData.name) {
            console.log(`Player ${player.username} made a guess in room ${roomId}: ${guessResult.guessData.name} (${guessResult.isCorrect ? 'correct' : 'incorrect'})`);
        } else {
            console.log(`Player ${player.username} made a guess in room ${roomId} with no valid guessData.`, guessResult);
        }
    });

    // Handle game end
    socket.on('gameEnd', ({roomId, result}) => {
        const room = rooms.get(roomId);
        if (room) room.lastActive = Date.now();

        if (!room) {
            console.log(`[ERROR][gameEnd][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'gameEnd: 房间不存在'});
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            console.log(`[ERROR][gameEnd][${socket.id}] 连接中断了`);
            socket.emit('error', {message: 'gameEnd: 连接中断了'});
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
                    if (winner.guesses.length > 6) {
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
            console.log(`[ERROR][requestGameSettings][${socket.id}] 房间不存在`);
            socket.emit('error', {message: '房间不存在'});
            return;
        }

        // Send current settings to the requesting client
        if (room.settings) {
            socket.emit('updateGameSettings', {settings: room.settings});
            console.log(`Game settings sent to new player in room ${roomId}`);
        }
    });

    // Handle surrender event
    // socket.on('surrender', ({roomId}) => {
    //     const room = rooms.get(roomId);

    //     if (!room) {
    //         console.log(`[ERROR][surrender][${socket.id}] 房间不存在`);
    //         socket.emit('error', {message: 'surrender: 房间不存在'});
    //         return;
    //     }

    //     const player = room.players.find(p => p.id === socket.id);
    //     if (!player) {
    //         console.log(`[ERROR][surrender][${socket.id}] 连接中断了`);
    //         socket.emit('error', {message: 'surrender: 连接中断了'});
    //         return;
    //     }

    //     // Append 🏳️ to player's guesses
    //     player.guesses += '🏳️';

    //     // Broadcast updated players to all clients in the room
    //     io.to(roomId).emit('updatePlayers', {
    //         players: room.players
    //     });

    //     console.log(`Player ${player.username} surrendered in room ${roomId}`);
    // });

    // Handle timeout event
    socket.on('timeOut', ({roomId}) => {
        const room = rooms.get(roomId);

        if (!room) {
            console.log(`[ERROR][timeOut][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'timeOut: 房间不存在'});
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            console.log(`[ERROR][timeOut][${socket.id}] 连接中断了`);
            socket.emit('error', {message: 'timeOut: 连接中断了'});
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
                disconnectedPlayer.guesses += '💀';

                if (room.host === socket.id) {
                    // 找出一个新的房主（第一个没有断开连接的玩家）
                    const newHost = room.players.find(p => !p.disconnected && p.id !== socket.id);
                    
                    if (newHost) {
                        // 将房主权限转移给新玩家
                        room.host = newHost.id;
                        // 更新新房主的状态
                        const newHostIndex = room.players.findIndex(p => p.id === newHost.id);
                        if (newHostIndex !== -1) {
                            room.players[newHostIndex].isHost = true;
                        }
                        
                        // 如果原房主分数为0，则移除，否则标记为断开连接
                        if (disconnectedPlayer.score === 0) {
                            room.players.splice(playerIndex, 1);
                        } else {
                            disconnectedPlayer.disconnected = true;
                        }
                        
                        // 通知房间中的所有玩家房主已更换
                        io.to(roomId).emit('hostTransferred', {
                            oldHostName: disconnectedPlayer.username,
                            newHostId: newHost.id,
                            newHostName: newHost.username
                        });
                        
                        // 更新玩家列表
                        io.to(roomId).emit('updatePlayers', {
                            players: room.players,
                            isPublic: room.isPublic
                        });
                        
                        console.log(`Host ${disconnectedPlayer.username} disconnected. New host: ${newHost.username} in room ${roomId}.`);
                    } else {
                        // 如果没有其他玩家可以成为房主，则关闭房间
                        rooms.delete(roomId);
                        io.to(roomId).emit('roomClosed', {message: '房主已断开连接，房间已关闭'});
                        console.log(`Host ${disconnectedPlayer.username} disconnected. Room ${roomId} closed as no available players to transfer ownership.`);
                    }
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

                if (room.currentGame) {
                    // Find all non-disconnected, non-answer-setter players
                    const activePlayers = room.players.filter(p => !p.disconnected && !p.isAnswerSetter);
                    // Check if all such players have ended their game
                    const allEnded = activePlayers.every(p =>
                        p.guesses.includes('✌') ||
                        p.guesses.includes('💀') ||
                        p.guesses.includes('🏳️')
                    );
                    if (allEnded) {
                        // Find answer setter (if any)
                        const answerSetter = room.players.find(p => p.isAnswerSetter);
                        let message = '';
                        if (answerSetter) {
                            answerSetter.score--;
                            message = `已经结束咧🙄！没人猜中，出题人 ${answerSetter.username} 扣1分！`;
                        } else {
                            message = '已经结束咧🙄！没人猜中';
                        }
                        io.to(roomId).emit('gameEnded', {
                            message,
                            guesses: room.currentGame?.guesses || []
                        });
                        room.players.forEach(p => {
                            p.isAnswerSetter = false;
                        });
                        io.to(roomId).emit('resetReadyStatus');
                        room.currentGame = null;
                        io.to(roomId).emit('updatePlayers', {
                            players: room.players,
                            isPublic: room.isPublic,
                            answerSetterId: null
                        });
                        console.log(`Game in room ${roomId} ended because all active players finished their game (by disconnect or surrender, no winner).`);
                    }
                }

                break;
            }
        }

        console.log(`User ${socket.id} disconnected`);
    });

    // Handle room visibility toggle
    socket.on('toggleRoomVisibility', ({roomId}) => {
        const room = rooms.get(roomId);
        if (room) room.lastActive = Date.now();

        if (!room) {
            console.log(`[ERROR][toggleRoomVisibility][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'toggleRoomVisibility: 房间不存在'});
            return;
        }

        // Only allow host to toggle visibility
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            console.log(`[ERROR][toggleRoomVisibility][${socket.id}] 只有房主可以更改房间状态`);
            socket.emit('error', {message: 'toggleRoomVisibility: 只有房主可以更改房间状态'});
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
            console.log(`[ERROR][enterManualMode][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'enterManualMode: 房间不存在'});
            return;
        }

        // Only allow host to enter manual mode
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            console.log(`[ERROR][enterManualMode][${socket.id}] 只有房主可以进入出题模式`);
            socket.emit('error', {message: 'enterManualMode: 只有房主可以进入出题模式'});
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
            console.log(`[ERROR][setAnswerSetter][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'setAnswerSetter: 房间不存在'});
            return;
        }

        // Only allow host to set answer setter
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            console.log(`[ERROR][setAnswerSetter][${socket.id}] 只有房主可以选择出题人`);
            socket.emit('error', {message: 'setAnswerSetter: 只有房主可以选择出题人'});
            return;
        }

        // Find the selected player
        const setter = room.players.find(p => p.id === setterId);
        if (!setter) {
            console.log(`[ERROR][setAnswerSetter][${socket.id}] 找不到选中的玩家`);
            socket.emit('error', {message: 'setAnswerSetter: 找不到选中的玩家'});
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

    // Handle kicking players from room
    socket.on('kickPlayer', ({roomId, playerId}) => {
        const room = rooms.get(roomId);
        if (room) room.lastActive = Date.now();

        if (!room) {
            console.log(`[ERROR][kickPlayer][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'kickPlayer: 房间不存在'});
            return;
        }

        // 只允许房主踢出玩家
        const host = room.players.find(p => p.id === socket.id);
        if (!host || !host.isHost) {
            console.log(`[ERROR][kickPlayer][${socket.id}] 只有房主可以踢出玩家`);
            socket.emit('error', {message: 'kickPlayer: 只有房主可以踢出玩家'});
            return;
        }

        // 找到要踢出的玩家
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) {
            console.log(`[ERROR][kickPlayer][${socket.id}] 找不到要踢出的玩家`);
            socket.emit('error', {message: 'kickPlayer: 找不到要踢出的玩家'});
            return;
        }

        const playerToKick = room.players[playerIndex];
        
        // 防止房主踢出自己
        if (playerToKick.id === socket.id) {
            console.log(`[ERROR][kickPlayer][${socket.id}] 无法踢出自己`);
            socket.emit('error', {message: 'kickPlayer: 无法踢出自己'});
            return;
        }

        // 保存玩家信息用于通知
        const kickedPlayerUsername = playerToKick.username;
        
        // 从房间中移除玩家前先通知被踢玩家
        io.to(playerId).emit('playerKicked', {
            playerId: playerId,
            username: kickedPlayerUsername
        });
        
        // 延迟一小段时间确保通知送达
        setTimeout(() => {
            try {
                // 从房间中移除玩家
                room.players.splice(playerIndex, 1);
                
                // 通知房间内其他玩家
                socket.to(roomId).emit('playerKicked', {
                    playerId: playerId,
                    username: kickedPlayerUsername
                });
                
                // 更新玩家列表
                io.to(roomId).emit('updatePlayers', {
                    players: room.players,
                    isPublic: room.isPublic
                });
                
                // 将被踢玩家从房间中移除
                const kickedSocket = io.sockets.sockets.get(playerId);
                if (kickedSocket) {
                    kickedSocket.leave(roomId);
                }
                
                console.log(`Player ${kickedPlayerUsername} kicked from room ${roomId}`);
            } catch (error) {
                console.error(`Error kicking player ${kickedPlayerUsername}:`, error);
            }
        }, 300);
    });

    // Handle answer setting from designated player
    socket.on('setAnswer', ({roomId, character, hints}) => {
        const room = rooms.get(roomId);
        if (room) room.lastActive = Date.now();

        if (!room) {
            console.log(`[ERROR][setAnswer][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'setAnswer: 房间不存在'});
            return;
        }

        // Only allow designated answer setter to set answer
        if (socket.id !== room.answerSetterId) {
            console.log(`[ERROR][setAnswer][${socket.id}] 你不是指定的出题人`);
            socket.emit('error', {message: 'setAnswer: 你不是指定的出题人'});
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

    // 添加手动转移房主的功能
    socket.on('transferHost', ({roomId, newHostId}) => {
        const room = rooms.get(roomId);
        if (room) room.lastActive = Date.now();

        if (!room) {
            console.log(`[ERROR][transferHost][${socket.id}] 房间不存在`);
            socket.emit('error', {message: 'transferHost: 房间不存在'});
            return;
        }

        // 只允许当前房主转移权限
        if (socket.id !== room.host) {
            console.log(`[ERROR][transferHost][${socket.id}] 只有房主可以转移权限`);
            socket.emit('error', {message: 'transferHost: 只有房主可以转移权限'});
            return;
        }

        // 确认新房主在房间内
        const newHost = room.players.find(p => p.id === newHostId);
        if (!newHost || newHost.disconnected) {
            console.log(`[ERROR][transferHost][${socket.id}] 无法将房主转移给该玩家`);
            socket.emit('error', {message: 'transferHost: 无法将房主转移给该玩家'});
            return;
        }

        // 找到当前房主
        const currentHost = room.players.find(p => p.id === socket.id);

        // 更新房主信息
        room.host = newHostId;

        // 更新玩家状态
        room.players.forEach(p => {
            p.isHost = p.id === newHostId;
        });

        // 通知所有玩家房主已更换
        io.to(roomId).emit('hostTransferred', {
            oldHostName: currentHost.username,
            newHostId: newHost.id,
            newHostName: newHost.username
        });

        // 更新玩家列表
        io.to(roomId).emit('updatePlayers', {
            players: room.players,
            isPublic: room.isPublic
        });

        console.log(`Host transferred from ${currentHost.username} to ${newHost.username} in room ${roomId}.`);
    });

    // Handle player message update
    socket.on('updatePlayerMessage', ({ roomId, message }) => {
        const room = rooms.get(roomId);
        if (!room) {
            console.log(`[ERROR][updatePlayerMessage][${socket.id}] 房间不存在`);
            socket.emit('error', { message: 'updatePlayerMessage: 房间不存在' });
            return;
        }

        // Find the player
        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            console.log(`[ERROR][updatePlayerMessage][${socket.id}] 连接中断了`);
            socket.emit('error', { message: 'updatePlayerMessage: 连接中断了' });
            return;
        }

        // Update the player's message
        player.message = message;

        // Broadcast updated players to all clients in the room
        io.to(roomId).emit('updatePlayers', {
            players: room.players,
            isPublic: room.isPublic
        });

        console.log(`Player ${player.username} updated their message in room ${roomId}: ${message}`);
    });

    // Handle player team update
    socket.on('updatePlayerTeam', ({ roomId, team }) => {
        const room = rooms.get(roomId);
        if (!room) {
            console.log(`[ERROR][updatePlayerTeam][${socket.id}] 房间不存在`);
            socket.emit('error', { message: 'updatePlayerTeam: 房间不存在' });
            return;
        }
        // Only allow the player themselves to update their team
        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            console.log(`[ERROR][updatePlayerTeam][${socket.id}] 连接中断了`);
            socket.emit('error', { message: 'updatePlayerTeam: 连接中断了' });
            return;
        }
        // Accept only null or 1-8 as valid team values
        if (team !== null && !(typeof team === 'string' && /^[1-8]$/.test(team))) {
            console.log(`[ERROR][updatePlayerTeam][${socket.id}] Invalid team value`);
            socket.emit('error', { message: 'updatePlayerTeam: Invalid team value' });
            return;
        }
        player.team = team === '' ? null : team;
        io.to(roomId).emit('updatePlayers', {
            players: room.players,
            isPublic: room.isPublic
        });
        console.log(`Player ${player.username} joined team ${player.team} in room ${roomId}`);
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('Server is active');
});

app.get('/quick-join', (req, res) => {
    // Get all public rooms that are not in progress
    const publicRooms = Array.from(rooms.entries()).filter(([id, room]) => 
        room.isPublic && !room.currentGame
    );

    if (publicRooms.length === 0) {
        return res.status(404).json({ error: '没有可用的公开房间' });
    }

    // Pick a random room
    const [roomId] = publicRooms[Math.floor(Math.random() * publicRooms.length)];

    // Construct the URL for the client to join
    const url = `${CLIENT_URL}/multiplayer/${roomId}`;
    res.json({ url });
});

app.get('/', (req, res) => {
    res.send(`Hello from the server!`);
});

app.get('/room-count', (req, res) => {
    res.json({count: rooms.size});
});

app.get('/clean-rooms', (req, res) => {
    const now = Date.now();
    let cleaned = 0;
    for (const [roomId, room] of rooms.entries()) {
        if (room.lastActive && now - room.lastActive > 300000 && !room.currentGame) {
            // Notify all players in the room
            io.to(roomId).emit('roomClosed', {message: '房间因长时间无活动已关闭'});
            // Delete the room
            rooms.delete(roomId);
            cleaned++;
            console.log(`Room ${roomId} closed due to inactivity.`);
        }
    }
    res.json({message: `已清理${cleaned}个房间`});
});

app.get('/list-rooms', (req, res) => {
    const roomsList = Array.from(rooms.entries()).map(([id, room]) => ({
        id,
        ...room
    }));
    res.json(roomsList);
});

startSelfPing();

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


