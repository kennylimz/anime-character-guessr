import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
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
import '../styles/MultiplayerLobby.css';
import '../styles/game.css';
import CryptoJS from 'crypto-js';
import { useLocalStorage } from 'usehooks-ts';

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
  const [roomName, setRoomName] = useState('');
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
  const [kickNotification, setKickNotification] = useState(null);

  // 复制房间ID而不是URL
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    showKickNotification('房间ID已复制到剪贴板', 'info');
  };

  // 复制房间链接
  const copyRoomLink = () => {
    const url = `${window.location.origin}/multiplayer/${roomId}`;
    navigator.clipboard.writeText(url);
    showKickNotification('房间链接已复制到剪贴板', 'info');
  };

  // 查询可用房间的API路径 - 添加预设房间配置
  const presetRooms = [
    { id: "1234", playerCount: 3, status: "waiting" },
    { id: "5678", playerCount: 2, status: "waiting" },
    { id: "9012", playerCount: 1, status: "waiting" },
    { id: "3456", playerCount: 4, status: "playing" }
  ];

  // 获取公开房间列表
  const fetchPublicRooms = async () => {
    try {
      setIsLoadingRooms(true);
      // 尝试从服务器获取房间列表
      const response = await fetch(`${SOCKET_URL}/public-rooms`);
      if (response.ok) {
        const data = await response.json();
        if (data.rooms && data.rooms.length > 0) {
          setPublicRooms(data.rooms);
        } else {
          // 如果服务器返回空数据，使用预设房间配置
          console.log('使用预设房间配置');
          setPublicRooms(presetRooms);
        }
      } else {
        console.error('获取房间列表失败，使用预设房间配置');
        setPublicRooms(presetRooms);
      }
    } catch (error) {
      console.error('获取房间列表出错:', error);
      // 出错时使用预设房间配置
      setPublicRooms(presetRooms);
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

  // 确保房间列表不为空的辅助函数
  const ensureRoomsList = () => {
    if (publicRooms.length === 0 && !isLoadingRooms) {
      setPublicRooms(presetRooms);
    }
  };
  
  // 确保房间列表始终有内容
  useEffect(() => {
    ensureRoomsList();
  }, [publicRooms.length, isLoadingRooms]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // 用于追踪事件是否已经被处理
    const kickEventProcessed = {}; 

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
          showKickNotification(`原房主已断开连接，你已成为新房主！`, 'host');
        } else {
          showKickNotification(`房主 ${oldHostName} 已将房主权限转移给你！`, 'host');
        }
      } else {
        showKickNotification(`房主权限已从 ${oldHostName} 转移给 ${newHostName}`, 'host');
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
      // 使用唯一标识确保同一事件不会处理多次
      const eventId = `${playerId}-${Date.now()}`;
      if (kickEventProcessed[eventId]) return;
      kickEventProcessed[eventId] = true;
      
      if (playerId === newSocket.id) {
        // 如果当前玩家被踢出，显示通知并重定向到多人游戏大厅
        showKickNotification('你已被房主踢出房间', 'kick');
        setIsJoined(false); 
        setGameEnd(true); 
        setTimeout(() => {
          navigate('/multiplayer');
        }, 100); // 延长延迟时间确保通知显示后再跳转
      } else {
        showKickNotification(`玩家 ${username} 已被踢出房间`, 'kick');
        setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== playerId));
      }
    });

    return () => {
      // 清理事件监听和连接
      newSocket.off('playerKicked');
      newSocket.off('hostTransferred');
      newSocket.off('updatePlayers');
      newSocket.off('waitForAnswer');
      newSocket.off('gameStart');
      newSocket.off('guessHistoryUpdate');
      newSocket.off('roomClosed');
      newSocket.off('error');
      newSocket.off('updateGameSettings');
      newSocket.off('gameEnded');
      newSocket.off('resetReadyStatus');
      
      newSocket.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    if (!roomId) {
      // 不再自动创建房间，让用户在大厅选择或创建
    } else {
      // 不再需要设置roomUrl
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
      socket.emit('createRoom', { roomId, username });
      // Send initial game settings when creating room
      socket.emit('updateGameSettings', { roomId, settings: gameSettings });
    } else {
      socket.emit('joinRoom', { roomId, username });
      // Request current settings from server
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
    
    // 确认当前玩家是房主
    const currentPlayer = players.find(p => p.id === socket.id);
    if (!currentPlayer || !currentPlayer.isHost) {
      alert('只有房主可以踢出玩家');
      return;
    }
    
    // 防止房主踢出自己
    if (playerId === socket.id) {
      alert('房主不能踢出自己');
      return;
    }
    
    // 确认后再踢出
    if (window.confirm('确定要踢出该玩家吗？')) {
      try {
        socket.emit('kickPlayer', { roomId, playerId });
      } catch (error) {
        console.error('踢出玩家失败:', error);
        alert('踢出玩家失败，请重试');
      }
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

  // 创建一个函数显示踢出通知
  const showKickNotification = (message, type = 'kick') => {
    setKickNotification({ message, type });
    setTimeout(() => {
      setKickNotification(null);
    }, 5000); // 5秒后自动关闭通知
  };

  // 创建房间处理函数
  const handleCreateRoom = () => {
    const newRoomId = uuidv4().substring(0, 4);
    setIsHost(true);
    navigate(`/multiplayer/${newRoomId}`);
  };

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
          <div className="lobby-section p-6 shadow-md">
            <div className="mb-6 grid gap-x-8 gap-y-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-lg font-medium text-gray-700">快速创建</h3>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="自定义房间ID（可选）"
                    maxLength="4"
                    className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:outline-hidden"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
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
                  onClick={handleCreateRoom}
                >
                  快速创建
                </button>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-medium text-gray-700">加入房间</h3>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="房间ID（4位）"
                    maxLength="4"
                    className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:outline-hidden"
                    value={roomName}
                    onChange={(e) => {
                      const newRoomId = e.target.value;
                      // 仅保存输入的房间ID，不自动跳转
                      if (newRoomId.length <= 4) {
                        setRoomName(newRoomId);
                      }
                    }}
                    onKeyDown={(e) => {
                      // 禁止回车键自动提交，必须点击确认按钮
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                  />
                  <button
                    className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                    onClick={() => {
                      if (roomName && roomName.length === 4) {
                        navigate(`/multiplayer/${roomName}`);
                      } else {
                        showKickNotification('请输入有效的4位房间ID', 'error');
                      }
                    }}
                  >
                    确认加入
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lobby-section p-6 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">房间列表 ({publicRooms.length})</h2>
              <div className="flex gap-2">
                <button
                  className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 quick-join-btn"
                  onClick={handleQuickJoin}
                >
                  快速加入
                </button>
                <button
                  className="cursor-pointer rounded-lg border border-blue-600 px-4 py-2 text-blue-600 transition-colors hover:bg-blue-50"
                  onClick={fetchPublicRooms}
                >
                  <i className="fas fa-sync-alt mr-1"></i> 刷新
                </button>
              </div>
            </div>
            
            {isLoadingRooms ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-gray-500">正在加载房间列表...</p>
              </div>
            ) : publicRooms.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-home-alt text-4xl text-gray-400 mb-2"></i>
                <p className="text-gray-500 mb-4">当前没有可用的公开房间</p>
                <button 
                  className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  onClick={handleCreateRoom}
                >
                  创建一个新房间
                </button>
              </div>
            ) : (
              <div className="rooms-list mt-4">
                <div className="grid gap-4">
                  {publicRooms.map(room => (
                    <div
                      key={room.id}
                      className="room-card cursor-pointer p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
                      onClick={() => {
                        navigate(`/multiplayer/${room.id}`);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">房间ID: {room.id}</h3>
                        <span className={`text-sm px-2 py-1 rounded-full ${
                          room.status === 'waiting' 
                            ? 'bg-green-400/20 text-green-400' 
                            : 'bg-yellow-400/20 text-yellow-400'
                        }`}>
                          {room.status === 'waiting' ? '等待中' : '游戏中'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 flex justify-between">
                        <span><i className="fas fa-user mr-1"></i>{room.playerCount}/6</span>
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
      {/* 添加踢出通知 */}
      {kickNotification && (
        <div className={`kick-notification ${kickNotification.type === 'host' ? 'host-notification' : ''} ${kickNotification.type === 'info' ? 'info-notification' : ''} ${kickNotification.type === 'error' ? 'error-notification' : ''}`}>
          <div className="kick-notification-content">
            <i className={`fas ${
              kickNotification.type === 'host' ? 'fa-crown' : 
              kickNotification.type === 'info' ? 'fa-info-circle' : 
              kickNotification.type === 'error' ? 'fa-exclamation-triangle' :
              'fa-exclamation-circle'
            }`}></i>
            <span>{kickNotification.message}</span>
            <button 
              className="notification-close-btn" 
              onClick={() => setKickNotification(null)}
              aria-label="关闭通知"
            >
              &times;
            </button>
          </div>
        </div>
      )}
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
            {isHost && !isJoined && <button onClick={handleQuickJoin} className="join-button">快速加入</button>}
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
            {/* Only show quick-join if not joined and is host, use same style as '创建' */}
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
                    <button onClick={copyRoomId} className="copy-button" title="复制房间ID">
                      <i className="fas fa-copy"></i> 复制ID
                    </button>
                    <button onClick={copyRoomLink} className="copy-button" title="复制完整房间链接">
                      <i className="fas fa-link"></i> 复制链接
                    </button>
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