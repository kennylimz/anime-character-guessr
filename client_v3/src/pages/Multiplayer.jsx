import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getRandomCharacter, getCharacterAppearances, generateFeedback } from '../utils/bangumi';
import SettingsPopup from '../components/SettingsPopup';
import SearchBar from '../components/SearchBar';
import GuessesTable from '../components/GuessesTable';
import Timer from '../components/Timer';
import PlayerList from '../components/PlayerList';
import GameEndPopup from '../components/GameEndPopup';
import SetAnswerPopup from '../components/SetAnswerPopup';
import GameSettingsDisplay from '../components/GameSettingsDisplay';
import Leaderboard from '../components/Leaderboard';
import '../styles/Multiplayer.css';
import '../styles/game.css';
import CryptoJS from 'crypto-js';

const secret = import.meta.env.VITE_AES_SECRET || 'My-Secret-Key';
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const Multiplayer = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isManualMode, setIsManualMode] = useState(false);
  const [answerSetterId, setAnswerSetterId] = useState(null);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  
  // 创建房间相关状态
  const [customRoomId, setCustomRoomId] = useState('');
  
  // 加入房间相关状态
  const [joinRoomId, setJoinRoomId] = useState('');
  
  // 游戏设置状态
  const [gameSettings, setGameSettings] = useState({
    startYear: new Date().getFullYear()-5,
    endYear: new Date().getFullYear(),
    topNSubjects: 20,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    useIndex: false,
    indexId: null,
    addedSubjects: [],
    mainCharacterOnly: true,
    characterNum: 6,
    maxAttempts: 10,
    enableHints: false,
    includeGame: false,
    timeLimit: 60,
    subjectSearch: true,
    characterTagNum: 6,
    subjectTagNum: 6,
    enableTagCensor: false,
    commonTags: true,
    externalTagMode: false
  });

  // Game state
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [guesses, setGuesses] = useState([]);
  const [guessesLeft, setGuessesLeft] = useState(10);
  const [isGuessing, setIsGuessing] = useState(false);
  const [answerCharacter, setAnswerCharacter] = useState(null);
  const [hints, setHints] = useState({
    first: null,
    second: null
  });
  const [shouldResetTimer, setShouldResetTimer] = useState(false);
  const [gameEnd, setGameEnd] = useState(false);
  const timeUpRef = useRef(false);
  const gameEndedRef = useRef(false);
  const [winner, setWinner] = useState(null);
  const [globalGameEnd, setGlobalGameEnd] = useState(false);
  const [guessesHistory, setGuessesHistory] = useState([]);
  const [showNames, setShowNames] = useState(true);
  const [showCharacterPopup, setShowCharacterPopup] = useState(false);
  const [showSetAnswerPopup, setShowSetAnswerPopup] = useState(false);
  const [isAnswerSetter, setIsAnswerSetter] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('updatePlayers', ({ players, isPublic, answerSetterId }) => {
      setPlayers(players);
      if (isPublic !== undefined) {
        setIsPublic(isPublic);
      }
      if (answerSetterId !== undefined) {
        setAnswerSetterId(answerSetterId);
      }
    });

    newSocket.on('waitForAnswer', ({ answerSetterId }) => {
      setWaitingForAnswer(true);
      setIsManualMode(false);
      // Show popup if current user is the answer setter
      if (answerSetterId === newSocket.id) {
        setShowSetAnswerPopup(true);
      }
    });

    newSocket.on('gameStart', ({ character, settings, players, isPublic, hints = null, isAnswerSetter: isAnswerSetterFlag }) => {
      gameEndedRef.current = false;
      const decryptedCharacter = JSON.parse(CryptoJS.AES.decrypt(character, secret).toString(CryptoJS.enc.Utf8));
      decryptedCharacter.rawTags = new Map(decryptedCharacter.rawTags);
      setAnswerCharacter(decryptedCharacter);
      setGameSettings(settings);
      setGuessesLeft(settings.maxAttempts);
      setIsAnswerSetter(isAnswerSetterFlag);
      if (players) {
        setPlayers(players);
      }
      if (isPublic !== undefined) {
        setIsPublic(isPublic);
      }

      setGuessesHistory([]);

      // Prepare hints if enabled
      let hintTexts = ['🚫提示未启用', '🚫提示未启用'];
      if (settings.enableHints && hints) {
        hintTexts = hints;
      } 
      else if (settings.enableHints && decryptedCharacter && decryptedCharacter.summary) {
        // Automatic mode - generate hints from summary
        const sentences = decryptedCharacter.summary.replace('[mask]', '').replace('[/mask]','')
          .split(/[。、，。！？ ""]/).filter(s => s.trim());
        if (sentences.length > 0) {
          const selectedIndices = new Set();
          while (selectedIndices.size < Math.min(2, sentences.length)) {
            selectedIndices.add(Math.floor(Math.random() * sentences.length));
          }
          hintTexts = Array.from(selectedIndices).map(i => "……"+sentences[i].trim()+"……");
        }
      }
      setHints({
        first: hintTexts[0],
        second: hintTexts[1]
      });
      setGlobalGameEnd(false);
      setIsGameStarted(true);
      setGameEnd(false);
      setGuesses([]);
    });

    // Add new event listener for guess history updates
    newSocket.on('guessHistoryUpdate', ({ guesses }) => {
      setGuessesHistory(guesses);
    });

    newSocket.on('roomClosed', ({ message }) => {
      alert(message || '房主已断开连接，房间已关闭。');
      setError('房间已关闭');
      navigate('/multiplayer');
    });

    newSocket.on('hostTransferred', ({ oldHostName, newHostId, newHostName }) => {
      // 如果当前用户是新房主，则更新状态
      if (newHostId === newSocket.id) {
        setIsHost(true);
        if (oldHostName === newHostName) {
          alert(`原房主已断开连接，你已成为新房主！`);
        } else {
          alert(`房主 ${oldHostName} 已断开连接，你已成为新房主！`);
        }
      } else {
        alert(`房主 ${oldHostName} 已断开连接，${newHostName} 已成为新房主。`);
      }
    });

    newSocket.on('error', ({ message }) => {
      alert(`错误: ${message}`);
      setError(message);
      setIsJoined(false);
    });

    newSocket.on('updateGameSettings', ({ settings }) => {
      console.log('Received game settings:', settings);
      setGameSettings(settings);
    });

    newSocket.on('gameEnded', ({ message, guesses }) => {
      setWinner(message);
      setGlobalGameEnd(true);
      setGuessesHistory(guesses);
      setIsGameStarted(false);
    });

    newSocket.on('resetReadyStatus', () => {
      setPlayers(prevPlayers => prevPlayers.map(player => ({
        ...player,
        ready: player.isHost ? player.ready : false
      })));
    });

    newSocket.on('playerKicked', ({ playerId, username }) => {
      if (playerId === newSocket.id) {
        alert(`你已被房主踢出房间。`);
        navigate('/multiplayer');
      } else {
        alert(`玩家 ${username} 已被踢出房间。`);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    if (!roomId) {
      // Create new room if no roomId in URL
      // 不再自动创建房间，让用户在大厅选择或创建
    } else {
      // Set room URL for sharing - 不再需要设置roomUrl
    }
  }, [roomId]);

  useEffect(() => {
    console.log('Game Settings:', gameSettings);
    if (isHost && isJoined) {
      socket.emit('updateGameSettings', { roomId, settings: gameSettings });
    }
  }, [showSettings]);

  const handleJoinRoom = () => {
    if (!username.trim()) {
      alert('请输入用户名');
      setError('请输入用户名');
      return;
    }

    setError('');
    if (isHost) {
      socket.emit('createRoom', { 
        roomId, 
        username,
        roomName: `房间 ${roomId}` // 使用默认名称
      });
      socket.emit('updateGameSettings', { roomId, settings: gameSettings });
    } else {
      socket.emit('joinRoom', { roomId, username });
      socket.emit('requestGameSettings', { roomId });
    }
    setIsJoined(true);
  };

  const handleReadyToggle = () => {
    socket.emit('toggleReady', { roomId });
  };

  const handleSettingsChange = (key, value) => {
    setGameSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
  };

  const handleGameEnd = (isWin) => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGameEnd(true);

    // Emit game end event to server
    socket.emit('gameEnd', {
      roomId,
      result: isWin ? 'win' : 'lose'
    });

    // Update player score
    if (isWin) {
      const updatedPlayers = players.map(p => {
        if (p.id === socket.id) {
          return { ...p, score: p.score + 1 };
        }
        return p;
      });
      setPlayers(updatedPlayers);
      socket.emit('updateScore', { roomId, score: updatedPlayers.find(p => p.id === socket.id).score });
    }
  };

  const handleCharacterSelect = async (character) => {
    if (isGuessing || !answerCharacter || gameEnd) return;

    setIsGuessing(true);
    setShouldResetTimer(true);

    try {
      const appearances = await getCharacterAppearances(character.id, gameSettings);

      const guessData = {
        ...character,
        ...appearances
      };

      const isCorrect = guessData.id === answerCharacter.id;
      setGuessesLeft(prev => prev - 1);
      // Send guess result to server
      socket.emit('playerGuess', {
        roomId,
        guessResult: {
          isCorrect,
          icon: guessData.image,
          name: guessData.name,
          nameCn: guessData.nameCn
        }
      });

      if (isCorrect) {
        setGuesses(prevGuesses => [...prevGuesses, {
          id: guessData.id,
          icon: guessData.image,
          name: guessData.name,
          nameCn: guessData.nameCn,
          gender: guessData.gender,
          genderFeedback: 'yes',
          latestAppearance: guessData.latestAppearance,
          latestAppearanceFeedback: '=',
          earliestAppearance: guessData.earliestAppearance,
          earliestAppearanceFeedback: '=',
          highestRating: guessData.highestRating,
          ratingFeedback: '=',
          appearancesCount: guessData.appearances.length,
          appearancesCountFeedback: '=',
          popularity: guessData.popularity,
          popularityFeedback: '=',
          appearanceIds: guessData.appearanceIds,
          sharedAppearances: {
            first: appearances.appearances[0] || '',
            count: appearances.appearances.length
          },
          metaTags: guessData.metaTags,
          sharedMetaTags: guessData.metaTags,
          isAnswer: true
        }]);

        handleGameEnd(true);
      } else if (guessesLeft <= 1) {
        const feedback = generateFeedback(guessData, answerCharacter, gameSettings);
        setGuesses(prevGuesses => [...prevGuesses, {
          id: guessData.id,
          icon: guessData.image,
          name: guessData.name,
          nameCn: guessData.nameCn,
          gender: guessData.gender,
          genderFeedback: feedback.gender.feedback,
          latestAppearance: guessData.latestAppearance,
          latestAppearanceFeedback: feedback.latestAppearance.feedback,
          earliestAppearance: guessData.earliestAppearance,
          earliestAppearanceFeedback: feedback.earliestAppearance.feedback,
          highestRating: guessData.highestRating,
          ratingFeedback: feedback.rating.feedback,
          appearancesCount: guessData.appearances.length,
          appearancesCountFeedback: feedback.appearancesCount.feedback,
          popularity: guessData.popularity,
          popularityFeedback: feedback.popularity.feedback,
          appearanceIds: guessData.appearanceIds,
          sharedAppearances: feedback.shared_appearances,
          metaTags: feedback.metaTags.guess,
          sharedMetaTags: feedback.metaTags.shared,
          isAnswer: false
        }]);

        handleGameEnd(false);
      } else {
        const feedback = generateFeedback(guessData, answerCharacter, gameSettings);
        setGuesses(prevGuesses => [...prevGuesses, {
          id: guessData.id,
          icon: guessData.image,
          name: guessData.name,
          nameCn: guessData.nameCn,
          gender: guessData.gender,
          genderFeedback: feedback.gender.feedback,
          latestAppearance: guessData.latestAppearance,
          latestAppearanceFeedback: feedback.latestAppearance.feedback,
          earliestAppearance: guessData.earliestAppearance,
          earliestAppearanceFeedback: feedback.earliestAppearance.feedback,
          highestRating: guessData.highestRating,
          ratingFeedback: feedback.rating.feedback,
          appearancesCount: guessData.appearances.length,
          appearancesCountFeedback: feedback.appearancesCount.feedback,
          popularity: guessData.popularity,
          popularityFeedback: feedback.popularity.feedback,
          appearanceIds: guessData.appearanceIds,
          sharedAppearances: feedback.shared_appearances,
          metaTags: feedback.metaTags.guess,
          sharedMetaTags: feedback.metaTags.shared,
          isAnswer: false
        }]);
      }
    } catch (error) {
      console.error('Error processing guess:', error);
      alert('出错了，请重试');
    } finally {
      setIsGuessing(false);
      setShouldResetTimer(false);
    }
  };

  const handleTimeUp = () => {
    if (timeUpRef.current || gameEnd || gameEndedRef.current) return;
    timeUpRef.current = true;

    const newGuessesLeft = guessesLeft - 1;

    setGuessesLeft(newGuessesLeft);

    // Always emit timeout
    socket.emit('timeOut', { roomId });

    if (newGuessesLeft <= 0) {
      setTimeout(() => {
        handleGameEnd(false);
      }, 100);
    }

    setShouldResetTimer(true);
    setTimeout(() => {
      setShouldResetTimer(false);
      timeUpRef.current = false;
    }, 100);
  };

  const handleSurrender = () => {
    if (gameEnd || gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGameEnd(true);

    // Emit game end event with surrender result
    socket.emit('gameEnd', {
      roomId,
      result: 'surrender'
    });
  };

  const handleStartGame = async () => {
    if (isHost) {
      try {
        const character = await getRandomCharacter(gameSettings);
        character.rawTags = Array.from(character.rawTags.entries());
        const encryptedCharacter = CryptoJS.AES.encrypt(JSON.stringify(character), secret).toString();
        socket.emit('gameStart', {
          roomId,
          character: encryptedCharacter,
          settings: gameSettings
        });

        // Update local state
        setAnswerCharacter(character);
        setGuessesLeft(gameSettings.maxAttempts);

        // Prepare hints if enabled
        let hintTexts = ['🚫提示未启用', '🚫提示未启用'];
        if (gameSettings.enableHints && character.summary) {
          const sentences = character.summary.replace('[mask]', '').replace('[/mask]','')
            .split(/[。、，。！？ ""]/).filter(s => s.trim());
          if (sentences.length > 0) {
            const selectedIndices = new Set();
            while (selectedIndices.size < Math.min(2, sentences.length)) {
              selectedIndices.add(Math.floor(Math.random() * sentences.length));
            }
            hintTexts = Array.from(selectedIndices).map(i => "……"+sentences[i].trim()+"……");
          }
        }
        setHints({
          first: hintTexts[0],
          second: hintTexts[1]
        });
        setGlobalGameEnd(false);
        setIsGameStarted(true);
        setGameEnd(false);
        setGuesses([]);
      } catch (error) {
        console.error('Failed to initialize game:', error);
        alert('游戏初始化失败，请重试');
      }
    }
  };

  const handleManualMode = () => {
    if (isManualMode) {
      setAnswerSetterId(null);
      setIsManualMode(false);
    } else {
      // Set all players as ready when entering manual mode
      socket.emit('enterManualMode', { roomId });
      setIsManualMode(true);
    }
  };

  const handleSetAnswerSetter = (setterId) => {
    if (!isHost || !isManualMode) return;
    socket.emit('setAnswerSetter', { roomId, setterId });
  };

  const handleVisibilityToggle = () => {
    socket.emit('toggleRoomVisibility', { roomId });
  };

  const handleSetAnswer = async ({ character, hints }) => {
    try {
      character.rawTags = Array.from(character.rawTags.entries());
      const encryptedCharacter = CryptoJS.AES.encrypt(JSON.stringify(character), secret).toString();
      socket.emit('setAnswer', {
        roomId,
        character: encryptedCharacter,
        hints
      });
      setShowSetAnswerPopup(false);
    } catch (error) {
      console.error('Failed to set answer:', error);
      alert('设置答案失败，请重试');
    }
  };

  const handleKickPlayer = (playerId) => {
    if (!isHost || !socket) return;
    
    // 确认后再踢出
    if (window.confirm('确定要踢出该玩家吗？')) {
      socket.emit('kickPlayer', { roomId, playerId });
    }
  };

  const handleTransferHost = (playerId) => {
    if (!isHost || !socket) return;
    
    // 确认后再转移房主
    if (window.confirm('确定要将房主权限转移给该玩家吗？')) {
      socket.emit('transferHost', { roomId, newHostId: playerId });
      setIsHost(false);
    }
  };

  // Add handleQuickJoin function
  const handleQuickJoin = async () => {
    try {
      const response = await fetch(`${SOCKET_URL}/quick-join`);
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || '没有可用的公开房间');
        return;
      }
      const data = await response.json();
      // Navigate to the returned URL
      window.location.href = data.url;
    } catch (error) {
      alert('快速加入失败，请重试');
    }
  };

  // 获取公开房间列表
  const fetchPublicRooms = async () => {
    try {
      setIsLoadingRooms(true);
      const response = await fetch(`${SOCKET_URL}/public-rooms`);
      if (response.ok) {
        const data = await response.json();
        setPublicRooms(data.rooms || []);
      } else {
        console.error('获取房间列表失败');
      }
    } catch (error) {
      console.error('获取房间列表出错:', error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // 在组件挂载时加载房间列表
  useEffect(() => {
    if (!roomId) {
      fetchPublicRooms();
      // 每10秒自动刷新一次房间列表
      const intervalId = setInterval(fetchPublicRooms, 10000);
      return () => clearInterval(intervalId);
    }
  }, [roomId]);

  if (!roomId) {
    return (
      <div className="multiplayer-container">
        <a
          href="/"
          className="social-link floating-back-button"
          title="Back"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <i className="fas fa-angle-left"></i>
        </a>
        <h1 className="mb-8 text-center text-4xl font-bold text-gray-800">多人游戏</h1>
        <div className="lobby-container">
          <div className="lobby-section rounded-lg bg-white p-6 shadow-md">
            <div className="mb-6 grid gap-x-8 gap-y-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-lg font-medium text-gray-700">创建新房间</h3>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="房间ID（4位）"
                    maxLength="4"
                    className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:outline-hidden"
                    value={customRoomId}
                    onChange={(e) => setCustomRoomId(e.target.value)}
                  />
                </div>
                <div className="mb-3 flex items-center">
                  <input
                    id="isPrivateRoom"
                    type="checkbox"
                    className="cursor-pointer rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={!isPublic}
                    onChange={() => setIsPublic(!isPublic)}
                  />
                  <label htmlFor="isPrivateRoom" className="ml-2 block cursor-pointer text-sm text-gray-700 select-none">
                    创建私密房间
                  </label>
                </div>
                <button
                  className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  onClick={() => {
                    if (!customRoomId || customRoomId.length !== 4) {
                      alert('请输入4位房间ID');
                      return;
                    }
                    setIsHost(true);
                    navigate(`/multiplayer/${customRoomId}`);
                  }}
                >
                  创建房间
                </button>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-medium text-gray-700">加入房间</h3>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="加入房间ID（4位）"
                    maxLength="4"
                    className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:outline-hidden"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  {/* 空白占位区域，确保高度与创建房间区域一致 */}
                  <div className="h-10"></div>
                </div>
                <div className="mb-3">
                  {/* 空白占位区域，确保高度与创建房间区域一致 */}
                  <div className="h-6"></div>
                </div>
                <button
                  className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  onClick={() => {
                    if (joinRoomId && joinRoomId.length === 4) {
                      navigate(`/multiplayer/${joinRoomId}`);
                    } else {
                      alert('请输入4位房间ID');
                    }
                  }}
                >
                  点击加入
                </button>
              </div>
            </div>
          </div>
          
          <div className="lobby-section rounded-lg bg-white p-6 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">房间列表 ({publicRooms.length})</h2>
              <div className="flex items-center gap-2">
                <button
                  className="quick-join-button"
                  onClick={handleQuickJoin}
                >
                  快速加入
                </button>
                <button
                  className="cursor-pointer rounded-lg border border-blue-600 px-4 py-2 text-blue-600 transition-colors hover:bg-blue-50"
                  onClick={fetchPublicRooms}
                >
                  刷新列表
                </button>
              </div>
            </div>
            
            {isLoadingRooms ? (
              <p className="text-center text-gray-500">加载中...</p>
            ) : publicRooms.length === 0 ? (
              <p className="text-center text-gray-500">当前没有可用的公开房间，创建一个吧！</p>
            ) : (
              <div className="rooms-list mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {publicRooms.map(room => (
                    <div
                      key={room.id}
                      className="room-card cursor-pointer p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
                      onClick={() => {
                        navigate(`/multiplayer/${room.id}`);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{room.name || `房间 ${room.id}`}</h3>
                        <span className="text-sm text-gray-500">{room.playerCount}/6 人</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 flex justify-between">
                        <span>{room.status === 'waiting' ? '等待中' : '游戏中'}</span>
                        <span className="text-blue-500">ID: {room.id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="lobby-section">
            <Leaderboard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="multiplayer-container">
      <a
          href="/"
          className="social-link floating-back-button"
          title="Back"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
      >
        <i className="fas fa-angle-left"></i>
      </a>
      {!isJoined ? (
        <>
          <div className="join-container">
            <h2>{isHost ? '创建房间' : '加入房间'}</h2>
            <input
              type="text"
              placeholder="输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="username-input"
              maxLength={20}
            />
            <button onClick={handleJoinRoom} className="join-button">
              {isHost ? '创建' : '加入'}
            </button>
            {error && <p className="error-message">{error}</p>}
          </div>
          <Leaderboard />
        </>
      ) : (
        <>
          <PlayerList 
                players={players} 
                socket={socket} 
                isGameStarted={isGameStarted}
                handleReadyToggle={handleReadyToggle}
                onAnonymousModeChange={setShowNames}
                isManualMode={isManualMode}
                isHost={isHost}
                answerSetterId={answerSetterId}
                onSetAnswerSetter={handleSetAnswerSetter}
                onKickPlayer={handleKickPlayer}
                onTransferHost={handleTransferHost}
              />

          {!isGameStarted && !globalGameEnd && (
            <>
              {isHost && !waitingForAnswer && (
                <div className="host-controls">
                  <div className="room-url-container">
                    <input
                      type="text"
                      value={roomId}
                      readOnly
                      className="room-url-input"
                    />
                    <button onClick={copyRoomId} className="copy-button">复制房间ID</button>
                  </div>
                </div>
              )}
              {isHost && !waitingForAnswer && (
                <div className="host-game-controls">
                  <div className="button-group">
                    <button
                      onClick={handleVisibilityToggle}
                      className="visibility-button"
                    >
                      {isPublic ? '🔓公开' : '🔒私密'}
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="settings-button"
                    >
                      设置
                    </button>
                    <button
                      onClick={handleStartGame}
                      className="start-game-button"
                      disabled={players.length < 2 || players.some(p => !p.isHost && !p.ready && !p.disconnected)}
                    >
                      开始
                    </button>
                    <button
                      onClick={handleManualMode}
                      className={`manual-mode-button ${isManualMode ? 'active' : ''}`}
                      disabled={players.length < 2 || players.some(p => !p.isHost && !p.ready && !p.disconnected)}
                    >
                      有人想出题？
                    </button>
                  </div>
                  <div className="anonymous-mode-info">
                    匿名模式？点表头"名"切换。
                  </div>
                </div>
              )}
              {!isHost && (
                <>
                  {/* 调试信息*/}
                  {/* <pre style={{ fontSize: '12px', color: '#666', padding: '5px', background: '#f5f5f5' }}>
                    {JSON.stringify({...gameSettings, __debug: '显示原始数据用于调试'}, null, 2)}
                  </pre> */}
                  <GameSettingsDisplay settings={gameSettings} />
                </>
              )}
            </>
          )}

          {isGameStarted && !globalGameEnd && (
            // In game
            <div className="container">
              {!isAnswerSetter ? (
                // Regular player view
                <>
                  <SearchBar
                    onCharacterSelect={handleCharacterSelect}
                    isGuessing={isGuessing}
                    gameEnd={gameEnd}
                    subjectSearch={gameSettings.subjectSearch}
                  />
                  {gameSettings.timeLimit && !gameEnd && (
                    <Timer
                      timeLimit={gameSettings.timeLimit}
                      onTimeUp={handleTimeUp}
                      isActive={!isGuessing}
                      reset={shouldResetTimer}
                    />
                  )}
                  <div className="game-info">
                    <div className="guesses-left">
                      <span>剩余猜测次数: {guessesLeft}</span>
                      <button
                        className="surrender-button"
                        onClick={handleSurrender}
                      >
                        投降 🏳️
                      </button>
                    </div>
                    {gameSettings.enableHints && hints.first && (
                      <div className="hints">
                        {guessesLeft <= 5 && <div className="hint">提示1: {hints.first}</div>}
                        {guessesLeft <= 2 && <div className="hint">提示2: {hints.second}</div>}
                      </div>
                    )}
                  </div>
                  <GuessesTable
                    guesses={guesses}
                    gameSettings={gameSettings}
                    answerCharacter={answerCharacter}
                  />
                </>
              ) : (
                // Answer setter view
                <div className="answer-setter-view">
                  <h3>你是出题人</h3>
                  <div className="selected-answer">
                    <img src={answerCharacter.imageGrid} alt={answerCharacter.name} className="answer-image" />
                    <div className="answer-info">
                      <div>{answerCharacter.name}</div>
                      <div>{answerCharacter.nameCn}</div>
                    </div>
                  </div>
                  <div className="guess-history-table">
                    <table>
                      <thead>
                        <tr>
                          {guessesHistory.map((playerGuesses, index) => (
                            <th key={playerGuesses.username}>
                              {showNames ? playerGuesses.username : `玩家${index + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: Math.max(...guessesHistory.map(g => g.guesses.length)) }).map((_, rowIndex) => (
                          <tr key={rowIndex}>
                            {guessesHistory.map(playerGuesses => (
                              <td key={playerGuesses.username}>
                                {playerGuesses.guesses[rowIndex] && (
                                  <>
                                    <img className="character-icon" src={playerGuesses.guesses[rowIndex].icon} alt={playerGuesses.guesses[rowIndex].name} />
                                    <div className="character-name">{playerGuesses.guesses[rowIndex].name}</div>
                                    <div className="character-name-cn">{playerGuesses.guesses[rowIndex].nameCn}</div>
                                  </>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isGameStarted && globalGameEnd && (
            // After game ends
            <div className="container">
              {isHost && (
                <div className="host-game-controls">
                  <div className="button-group">
                    <button
                      onClick={handleVisibilityToggle}
                      className="visibility-button"
                    >
                      {isPublic ? '🔓公开' : '🔒私密'}
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="settings-button"
                    >
                      设置
                    </button>
                    <button
                      onClick={handleStartGame}
                      className="start-game-button"
                      disabled={players.length < 2 || players.some(p => !p.isHost && !p.ready && !p.disconnected)}
                    >
                      开始
                    </button>
                    <button
                      onClick={handleManualMode}
                      className={`manual-mode-button ${isManualMode ? 'active' : ''}`}
                      disabled={players.length < 2 || players.some(p => !p.isHost && !p.ready && !p.disconnected)}
                    >
                      有人想出题？
                    </button>
                  </div>
                </div>
              )}
              <div className="game-end-message">
                {showNames ? <>{winner}<br /></> : ''} 答案是: {answerCharacter.nameCn || answerCharacter.name}
                <button
                  className="character-details-button"
                  onClick={() => setShowCharacterPopup(true)}
                >
                  查看角色详情
                </button>
              </div>
              <div className="game-end-container">
                {!isHost && (
                  <>
                    {/* 调试信息*/}
                    {/* <pre style={{ fontSize: '12px', color: '#666', padding: '5px', background: '#f5f5f5' }}>
                      {JSON.stringify({...gameSettings, __debug: '显示原始数据用于调试'}, null, 2)}
                    </pre> */}
                    <GameSettingsDisplay settings={gameSettings} />
                  </>
                )}
                <div className="guess-history-table">
                  <table>
                    <thead>
                      <tr>
                        {guessesHistory.map((playerGuesses, index) => (
                          <th key={playerGuesses.username}>
                            {showNames ? playerGuesses.username : `玩家${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: Math.max(...guessesHistory.map(g => g.guesses.length)) }).map((_, rowIndex) => (
                        <tr key={rowIndex}>
                          {guessesHistory.map(playerGuesses => (
                            <td key={playerGuesses.username}>
                              {playerGuesses.guesses[rowIndex] && (
                                <>
                                  <img className="character-icon" src={playerGuesses.guesses[rowIndex].icon} alt={playerGuesses.guesses[rowIndex].name} />
                                  <div className="character-name">{playerGuesses.guesses[rowIndex].name}</div>
                                  <div className="character-name-cn">{playerGuesses.guesses[rowIndex].nameCn}</div>
                                </>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {showSettings && (
            <SettingsPopup
              gameSettings={gameSettings}
              onSettingsChange={handleSettingsChange}
              onClose={() => setShowSettings(false)}
              hideRestart={true}
            />
          )}

          {globalGameEnd && showCharacterPopup && answerCharacter && (
            <GameEndPopup
              result={guesses.some(g => g.isAnswer) ? 'win' : 'lose'}
              answer={answerCharacter}
              onClose={() => setShowCharacterPopup(false)}
            />
          )}

          {showSetAnswerPopup && (
            <SetAnswerPopup
              onSetAnswer={handleSetAnswer}
              gameSettings={gameSettings}
            />
          )}
        </>

      )}
    </div>
  );
};

export default Multiplayer;