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
import LobbyView from '../components/LobbyView';
import '../styles/Multiplayer.css';
import '../styles/MultiplayerLobby.css';
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
  const [roomName, setRoomName] = useState('');
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');
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
  const [notification, setNotification] = useState(null);

  const publicRoomsRef = useRef(publicRooms);
  useEffect(() => {
    publicRoomsRef.current = publicRooms;
  }, [publicRooms]);

  // Function to show temporary notifications
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000); // Auto-close after 5 seconds
  };

  // Alphanumeric validation for room IDs
  const isValidRoomId = (id) => /^[a-zA-Z0-9]{4}$/.test(id);
  const sanitizeRoomIdInput = (value) => {
    const sanitized = value.replace(/[^a-zA-Z0-9]/g, '');
    return sanitized.substring(0, 4);
  };
  
  const handleCreateIdChange = (e) => {
    setRoomName(sanitizeRoomIdInput(e.target.value));
  };

  const handleJoinIdChange = (e) => {
    setJoinRoomIdInput(sanitizeRoomIdInput(e.target.value));
  };

  // 创建房间处理函数
  const handleCreateRoom = () => {
    let newRoomId = roomName.trim();
    if (!isValidRoomId(newRoomId) && newRoomId !== '') { // Allow empty for auto-generate, but validate if not empty
        showNotification('自定义房间ID格式无效，将为您自动生成。需要4位字母或数字。', 'info');
        newRoomId = uuidv4().substring(0, 4);
    } else if (newRoomId === '') {
        newRoomId = uuidv4().substring(0, 4);
    }
    showNotification(`正在创建房间 ${newRoomId}...`, 'info');
    setIsHost(true);
    setRoomName(''); // Clear input after use
    navigate(`/multiplayer/${newRoomId}`);
  };

  // 复制房间ID而不是URL
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    showNotification('房间ID已复制到剪贴板', 'info');
  };

  // 复制房间链接
  const copyRoomLink = () => {
    const url = `${window.location.origin}/multiplayer/${roomId}`;
    navigator.clipboard.writeText(url);
    showNotification('房间链接已复制到剪贴板', 'info');
  };

  // 获取公开房间列表
  const fetchPublicRooms = async () => {
    console.log("[fetchPublicRooms] Attempting to fetch..."); // DEBUG
    try {
      setIsLoadingRooms(true);
      const response = await fetch(`${SOCKET_URL}/public-rooms`);
      if (response.ok) {
        const data = await response.json();
        console.log("[fetchPublicRooms] Data received:", data); // DEBUG
        if (data.rooms && data.rooms.length > 0) {
          setPublicRooms(data.rooms);
        } else {
          console.log('[fetchPublicRooms] Server returned no rooms or empty room list.');
          setPublicRooms([]);
        }
      } else {
        console.error('[fetchPublicRooms] Fetch failed, response not OK:', response.status);
        setPublicRooms([]);
      }
    } catch (error) {
      console.error('[fetchPublicRooms] Error fetching room list:', error);
      setPublicRooms([]);
    } finally {
      setIsLoadingRooms(false);
      console.log("[fetchPublicRooms] Fetch finished."); // DEBUG
    }
  };

  // 在组件挂载时加载房间列表 (Lobby view)
  useEffect(() => {
    if (!roomId) {
      console.log("[Lobby Effect] No roomId, initializing lobby."); // DEBUG
      fetchPublicRooms(); // Initial fetch
      const intervalId = setInterval(() => {
        console.log("[Lobby Interval] Fetching public rooms."); // DEBUG
        fetchPublicRooms();
      }, 100000); // Refresh every 100 seconds
      return () => {
        console.log("[Lobby Effect] Cleaning up interval."); // DEBUG
        clearInterval(intervalId);
      };
    }
  }, [roomId]); // Add fetchPublicRooms to dependency array if it's memoized, but it's stable here.

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
          showNotification(`原房主已断开连接，你已成为新房主！`, 'success');
        } else {
          showNotification(`房主 ${oldHostName} 已将房主权限转移给你！`, 'success');
        }
      } else {
        showNotification(`房主权限已从 ${oldHostName} 转移给 ${newHostName}`, 'success');
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
        showNotification('你已被房主踢出房间', 'error');
        setIsJoined(false); 
        setGameEnd(true); 
        setTimeout(() => {
          navigate('/multiplayer');
        }, 100); // 延长延迟时间确保通知显示后再跳转
      } else {
        showNotification(`玩家 ${username} 已被踢出房间`, 'error');
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

  // Restored Quick Join function to client-side logic
  const handleQuickJoin = async () => {
    if (isLoadingRooms) { // Still good to keep, prevents quick clicks if lobby is initially loading
      showNotification('房间列表仍在加载中，请稍候。', 'info');
      return;
    }
    
    showNotification('正在查找可加入的房间...', 'info');
    
    try {
      const response = await fetch(`${SOCKET_URL}/quick-join`);
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          // Extract roomId from the URL provided by the backend
          const urlParts = data.url.split('/');
          const roomIdFromServer = urlParts[urlParts.length - 1];
          showNotification(`正在加入房间 ${roomIdFromServer}...`, 'info');
          // Clear any previous input before navigating
          setJoinRoomIdInput(''); 
          setRoomName(''); 
          navigate(`/multiplayer/${roomIdFromServer}`);
        } else {
          // This case should ideally not happen if backend sends 404 for no rooms,
          // or if it sends a specific error message in JSON.
          showNotification('未能获取到房间链接，请稍后再试。', 'error');
        }
      } else if (response.status === 404) {
        // The backend /quick-join sends 404 if no rooms are available.
        const errorJson = await response.json().catch(() => ({})); // Try to parse JSON, default to empty if fail
        const message = errorJson.error || '暂时没有可快速加入的房间，请尝试创建一个房间或稍后再试。';
        showNotification(message, 'info');
      } else {
        // Handle other potential errors like 500, etc.
        const errorData = await response.text(); 
        console.error('[handleQuickJoin] Failed to quick join:', response.status, errorData);
        showNotification(`快速加入失败 (状态: ${response.status})，请稍后再试。`, 'error');
      }
    } catch (error) {
      console.error('[handleQuickJoin] Error during quick join fetch:', error);
      showNotification('快速加入时发生网络错误，请检查连接并稍后再试。', 'error');
    }
  };

  // Handle player message change
  const handleMessageChange = (newMessage) => {
    setPlayers(prevPlayers => prevPlayers.map(p =>
      p.id === socket.id ? { ...p, message: newMessage } : p
    ));
    // Emit to server for sync
    socket.emit('updatePlayerMessage', { roomId, message: newMessage });
  };

  if (!roomId) {
    return (
      <LobbyView
        navigate={navigate}
        roomName={roomName}
        handleCreateIdChange={handleCreateIdChange}
        isPublic={isPublic}
        setIsPublic={setIsPublic}
        handleCreateRoom={handleCreateRoom}
        joinRoomIdInput={joinRoomIdInput}
        handleJoinIdChange={handleJoinIdChange}
        isValidRoomId={isValidRoomId}
        showNotification={showNotification}
        notificationToDisplay={notification}
        dismissNotification={() => setNotification(null)}
        publicRooms={publicRooms}
        isLoadingRooms={isLoadingRooms}
        handleQuickJoin={handleQuickJoin}
        fetchPublicRooms={fetchPublicRooms}
        // Leaderboard is now handled inside LobbyView
      />
    );
  }

  return (
    <div className="multiplayer-container">
      {notification && (
        <div className={`notification-banner ${notification.type === 'success' ? 'notification-success' : ''} ${notification.type === 'info' ? 'notification-info' : ''} ${notification.type === 'error' ? 'notification-error' : ''}`}>
          <div className="notification-content">
            <i className={`fas ${
              notification.type === 'success' ? 'fa-check-circle' : 
              notification.type === 'info' ? 'fa-info-circle' : 
              notification.type === 'error' ? 'fa-exclamation-triangle' :
              'fa-bell'
            }`}></i>
            <span>{notification.message}</span>
            <button 
              className="notification-close-btn" 
              onClick={() => setNotification(null)}
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
                onMessageChange={handleMessageChange}
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
                    匿名模式？点表头"名"切换。<br/>
                    想沟通玩法？点自己名字编辑短信息。
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