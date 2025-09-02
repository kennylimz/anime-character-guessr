import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { io } from "socket.io-client";
import {
  getRandomCharacter,
  getCharacterAppearances,
  generateFeedback,
} from "../utils/bangumi";
import SettingsPopup from "../components/SettingsPopup";
import SearchBar from "../components/SearchBar";
import GuessesTable from "../components/GuessesTable";
import Timer from "../components/Timer";
import PlayerList from "../components/PlayerList";
import GameEndPopup from "../components/GameEndPopup";
import SetAnswerPopup from "../components/SetAnswerPopup";
import GameSettingsDisplay from "../components/GameSettingsDisplay";
import Leaderboard from "../components/Leaderboard";
import Roulette from "../components/Roulette";
import "../styles/Multiplayer.css";
import "../styles/game.css";
import CryptoJS from "crypto-js";
import axios from "axios";
const secret = import.meta.env.VITE_AES_SECRET || "My-Secret-Key";
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const Multiplayer = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [roomUrl, setRoomUrl] = useState("");
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isManualMode, setIsManualMode] = useState(false);
  const [answerSetterId, setAnswerSetterId] = useState(null);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [gameSettings, setGameSettings] = useState({
    startYear: new Date().getFullYear() - 5,
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
    commonTags: true,
    useHints: [],
    useImageHint: 0,
    imgHint: null,
  });

  // Game state
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [guesses, setGuesses] = useState([]);
  const [guessesLeft, setGuessesLeft] = useState(10);
  const [isGuessing, setIsGuessing] = useState(false);
  const answerCharacterRef = useRef(null);
  const gameSettingsRef = useRef(gameSettings);
  const [answerCharacter, setAnswerCharacter] = useState(null);
  const [hints, setHints] = useState([]);
  const [useImageHint, setUseImageHint] = useState(0);
  const [imgHint, setImgHint] = useState(null);
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
  const [answerViewMode, setAnswerViewMode] = useState("simple"); // 'simple' or 'detailed'

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    socketRef.current = newSocket;

    // 用于追踪事件是否已经被处理
    const kickEventProcessed = {};

    // Socket event listeners
    newSocket.on("updatePlayers", ({ players, isPublic, answerSetterId }) => {
      setPlayers(players);
      if (isPublic !== undefined) {
        setIsPublic(isPublic);
      }
      if (answerSetterId !== undefined) {
        setAnswerSetterId(answerSetterId);
      }
    });

    newSocket.on("waitForAnswer", ({ answerSetterId }) => {
      setWaitingForAnswer(true);
      setIsManualMode(false);
      // Show popup if current user is the answer setter
      if (answerSetterId === newSocket.id) {
        setShowSetAnswerPopup(true);
      }
    });

    newSocket.on(
      "gameStart",
      ({
        character,
        settings,
        players,
        isPublic,
        hints = null,
        isAnswerSetter: isAnswerSetterFlag,
      }) => {
        gameEndedRef.current = false;
        const decryptedCharacter = JSON.parse(
          CryptoJS.AES.decrypt(character, secret).toString(CryptoJS.enc.Utf8)
        );
        decryptedCharacter.rawTags = new Map(decryptedCharacter.rawTags);
        setAnswerCharacter(decryptedCharacter);
        answerCharacterRef.current = decryptedCharacter;
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
        let hintTexts = [];
        if (
          Array.isArray(settings.useHints) &&
          settings.useHints.length > 0 &&
          hints
        ) {
          hintTexts = hints;
        } else if (
          Array.isArray(settings.useHints) &&
          settings.useHints.length > 0 &&
          decryptedCharacter &&
          decryptedCharacter.summary
        ) {
          // Automatic mode - generate hints from summary
          const sentences = decryptedCharacter.summary
            .replace("[mask]", "")
            .replace("[/mask]", "")
            .split(/[。、，。！？ ""]/)
            .filter((s) => s.trim());
          if (sentences.length > 0) {
            const selectedIndices = new Set();
            while (
              selectedIndices.size <
              Math.min(settings.useHints.length, sentences.length)
            ) {
              selectedIndices.add(Math.floor(Math.random() * sentences.length));
            }
            hintTexts = Array.from(selectedIndices).map(
              (i) => "……" + sentences[i].trim() + "……"
            );
          }
        }
        setHints(hintTexts);
        setUseImageHint(settings.useImageHint);
        setImgHint(settings.useImageHint > 0 ? decryptedCharacter.image : null);
        setGlobalGameEnd(false);
        setIsGameStarted(true);
        setGameEnd(false);
        setGuesses([]);
      }
    );

    newSocket.on("guessHistoryUpdate", ({ guesses }) => {
      setGuessesHistory(guesses);
    });

    newSocket.on("roomClosed", ({ message }) => {
      alert(message || "The host has disconnected, the room is closed.");
      setError("房间已关闭");
      navigate("/multiplayer");
    });

    newSocket.on(
      "hostTransferred",
      ({ oldHostName, newHostId, newHostName }) => {
        // 如果当前用户是新房主，则更新状态
        if (newHostId === newSocket.id) {
          setIsHost(true);
          if (oldHostName === newHostName) {
            showKickNotification(
              `The previous host has disconnected, you are now the host!`,
              "host"
            );
          } else {
            showKickNotification(
              `Host ${oldHostName} has transferred host privileges to you!`,
              "host"
            );
          }
        } else {
          showKickNotification(
            `Host privileges have been transferred from ${oldHostName} to ${newHostName}`,
            "host"
          );
        }
      }
    );

    newSocket.on("error", ({ message }) => {
      alert(`Error: ${message}`);
      setError(message);
      setIsJoined(false);
      if (message && message.includes("Avatar is already in use 😭😭😭")) {
        sessionStorage.removeItem("avatarId");
        sessionStorage.removeItem("avatarImage");
      }
    });

    newSocket.on("updateGameSettings", ({ settings }) => {
      console.log("Received game settings:", settings);
      setGameSettings(settings);
    });

    newSocket.on("gameEnded", ({ message, guesses }) => {
      setWinner(message);
      setGlobalGameEnd(true);
      setGuessesHistory(guesses);
      setIsGameStarted(false);
    });

    newSocket.on("resetReadyStatus", () => {
      setPlayers((prevPlayers) =>
        prevPlayers.map((player) => ({
          ...player,
          ready: player.isHost ? player.ready : false,
        }))
      );
    });

    newSocket.on("playerKicked", ({ playerId, username }) => {
      // 使用唯一标识确保同一事件不会处理多次
      const eventId = `${playerId}-${Date.now()}`;
      if (kickEventProcessed[eventId]) return;
      kickEventProcessed[eventId] = true;

      if (playerId === newSocket.id) {
        // 如果当前Player被踢出，显示通知并重定向到多人游戏大厅
        showKickNotification("你已被房主踢出房间", "kick");
        setIsJoined(false);
        setGameEnd(true);
        setTimeout(() => {
          navigate("/multiplayer");
        }, 100); // 延长延迟时间确保通知显示后再跳转
      } else {
        showKickNotification(`Player ${username} 已被踢出房间`, "kick");
        setPlayers((prevPlayers) =>
          prevPlayers.filter((p) => p.id !== playerId)
        );
      }
    });

    // Listen for team guess broadcasts
    newSocket.on(
      "boardcastTeamGuess",
      ({ guessData, playerId, playerName }) => {
        if (guessData.rawTags) {
          guessData.rawTags = new Map(guessData.rawTags);
        }

        const feedback = generateFeedback(
          guessData,
          answerCharacterRef.current,
          gameSettingsRef.current
        );

        const newGuess = {
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
          isAnswer: false,
          playerId,
          playerName,
          guessrName: guessData.guessrName || playerName, // prefer guessData.guessrName if present
        };

        setGuesses((prev) => [...prev, newGuess]);
        setGuessesLeft((prev) => {
          const newGuessesLeft = prev - 1;
          if (newGuessesLeft <= 0) {
            setTimeout(() => {
              handleGameEnd(false);
            }, 100);
          }
          return newGuessesLeft;
        });
        setShouldResetTimer(true);
        setTimeout(() => setShouldResetTimer(false), 100);
      }
    );

    return () => {
      // 清理事件监听和连接
      newSocket.off("playerKicked");
      newSocket.off("hostTransferred");
      newSocket.off("updatePlayers");
      newSocket.off("waitForAnswer");
      newSocket.off("gameStart");
      newSocket.off("guessHistoryUpdate");
      newSocket.off("roomClosed");
      newSocket.off("error");
      newSocket.off("updateGameSettings");
      newSocket.off("gameEnded");
      newSocket.off("resetReadyStatus");
      newSocket.off("boardcastTeamGuess");
      newSocket.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    if (!roomId) {
      // Create new room if no roomId in URL
      const newRoomId = uuidv4();
      setIsHost(true);
      navigate(`/multiplayer/${newRoomId}`);
    } else {
      // Set room URL for sharing
      setRoomUrl(window.location.href);
    }
  }, [roomId, navigate]);

  useEffect(() => {
    console.log("Game Settings:", gameSettings);
    if (isHost && isJoined) {
      socketRef.current?.emit("updateGameSettings", {
        roomId,
        settings: gameSettings,
      });
    }
  }, [showSettings]);

  useEffect(() => {
    gameSettingsRef.current = gameSettings;
  }, [gameSettings]);

  const handleJoinRoom = () => {
    if (!username.trim()) {
      alert("Please enter a username");
      setError("Please enter a username");
      return;
    }

    setError("");
    // Only declare these variables once
    const avatarId = sessionStorage.getItem("avatarId");
    const avatarImage = sessionStorage.getItem("avatarImage");
    const avatarPayload = avatarId !== null ? { avatarId, avatarImage } : {};
    if (isHost) {
      socketRef.current?.emit("createRoom", {
        roomId,
        username,
        ...avatarPayload,
      });
      socketRef.current?.emit("updateGameSettings", {
        roomId,
        settings: gameSettings,
      });
    } else {
      socketRef.current?.emit("joinRoom", {
        roomId,
        username,
        ...avatarPayload,
      });
      socketRef.current?.emit("requestGameSettings", { roomId });
    }
    setIsJoined(true);
  };

  const handleReadyToggle = () => {
    socketRef.current?.emit("toggleReady", { roomId });
  };

  const handleSettingsChange = (key, value) => {
    setGameSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const copyRoomUrl = () => {
    navigator.clipboard.writeText(roomUrl);
  };

  const handleGameEnd = (isWin) => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGameEnd(true);
    // Emit game end event to server
    if (sessionStorage.getItem("avatarId") == answerCharacter.id) {
      socketRef.current?.emit("gameEnd", {
        roomId,
        result: isWin ? "bigwin" : "lose",
      });
    } else {
      socketRef.current?.emit("gameEnd", {
        roomId,
        result: isWin ? "win" : "lose",
      });
    }
  };

  const handleCharacterSelect = async (character) => {
    if (isGuessing || !answerCharacter || gameEnd) return;

    setIsGuessing(true);
    setShouldResetTimer(true);

    try {
      const appearances = await getCharacterAppearances(
        character.id,
        gameSettings
      );

      const guessData = {
        ...character,
        ...appearances,
      };
      const isCorrect = guessData.id === answerCharacter.id;
      // Send guess result to server
      guessData.rawTags = Array.from(appearances.rawTags?.entries?.() || []);
      if (!guessData || !guessData.id || !guessData.name) {
        console.warn("Invalid guessData, not emitting");
        return;
      }
      let tempFeedback = generateFeedback(
        guessData,
        answerCharacter,
        gameSettings
      );
      setGuessesLeft((prev) => prev - 1);
      socketRef.current?.emit("playerGuess", {
        roomId,
        guessResult: {
          isCorrect,
          isPartialCorrect: tempFeedback.shared_appearances.count > 0,
          guessData,
        },
      });
      guessData.rawTags = new Map(guessData.rawTags);
      const feedback = generateFeedback(
        guessData,
        answerCharacter,
        gameSettings
      );
      if (isCorrect) {
        setGuesses((prevGuesses) => [
          ...prevGuesses,
          {
            id: guessData.id,
            icon: guessData.image,
            name: guessData.name,
            nameCn: guessData.nameCn,
            gender: guessData.gender,
            genderFeedback: "yes",
            latestAppearance: guessData.latestAppearance,
            latestAppearanceFeedback: "=",
            earliestAppearance: guessData.earliestAppearance,
            earliestAppearanceFeedback: "=",
            highestRating: guessData.highestRating,
            ratingFeedback: "=",
            appearancesCount: guessData.appearances.length,
            appearancesCountFeedback: "=",
            popularity: guessData.popularity,
            popularityFeedback: "=",
            appearanceIds: guessData.appearanceIds,
            sharedAppearances: {
              first: appearances.appearances[0] || "",
              count: appearances.appearances.length,
            },
            metaTags: guessData.metaTags,
            sharedMetaTags: guessData.metaTags,
            isAnswer: true,
          },
        ]);
        handleGameEnd(true);
      } else if (guessesLeft <= 1) {
        setGuesses((prevGuesses) => [
          ...prevGuesses,
          {
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
            isAnswer: false,
          },
        ]);
        handleGameEnd(false);
      } else {
        setGuesses((prevGuesses) => [
          ...prevGuesses,
          {
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
            isAnswer: false,
          },
        ]);
      }
    } catch (error) {
      console.error("Error processing guess:", error);
      alert("An error occurred, please try again");
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
    socketRef.current?.emit("timeOut", { roomId });

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
    socketRef.current?.emit("gameEnd", {
      roomId,
      result: "surrender",
    });
  };

  const handleStartGame = async () => {
    if (isHost) {
      try {
        if (gameSettings.addedSubjects.length > 0) {
          await axios.post(SOCKET_URL + "/api/subject-added", {
            addedSubjects: gameSettings.addedSubjects,
          });
        }
      } catch (error) {
        console.error("Failed to update subject count:", error);
      }
      try {
        const character = await getRandomCharacter(gameSettings);
        character.rawTags = Array.from(character.rawTags.entries());
        const encryptedCharacter = CryptoJS.AES.encrypt(
          JSON.stringify(character),
          secret
        ).toString();
        socketRef.current?.emit("gameStart", {
          roomId,
          character: encryptedCharacter,
          settings: gameSettings,
        });

        // Update local state
        setAnswerCharacter(character);
        setGuessesLeft(gameSettings.maxAttempts);

        // Prepare hints if enabled
        let hintTexts = [];
        if (
          Array.isArray(gameSettings.useHints) &&
          gameSettings.useHints.length > 0 &&
          character.summary
        ) {
          const sentences = character.summary
            .replace("[mask]", "")
            .replace("[/mask]", "")
            .split(/[。、，。！？ ""]/)
            .filter((s) => s.trim());
          if (sentences.length > 0) {
            const selectedIndices = new Set();
            while (
              selectedIndices.size <
              Math.min(gameSettings.useHints.length, sentences.length)
            ) {
              selectedIndices.add(Math.floor(Math.random() * sentences.length));
            }
            hintTexts = Array.from(selectedIndices).map(
              (i) => "……" + sentences[i].trim() + "……"
            );
          }
        }
        setHints(hintTexts);
        setUseImageHint(gameSettings.useImageHint);
        setImgHint(gameSettings.useImageHint > 0 ? character.image : null);
        setGlobalGameEnd(false);
        setIsGameStarted(true);
        setGameEnd(false);
        setGuesses([]);
      } catch (error) {
        console.error("Failed to initialize game:", error);
        alert("Game initialization failed, please try again");
      }
    }
  };

  const handleManualMode = () => {
    if (isManualMode) {
      setAnswerSetterId(null);
      setIsManualMode(false);
    } else {
      // Set all players as ready when entering manual mode
      socketRef.current?.emit("enterManualMode", { roomId });
      setIsManualMode(true);
    }
  };

  const handleSetAnswerSetter = (setterId) => {
    if (!isHost || !isManualMode) return;
    socketRef.current?.emit("setAnswerSetter", { roomId, setterId });
  };

  const handleVisibilityToggle = () => {
    socketRef.current?.emit("toggleRoomVisibility", { roomId });
  };

  const handleSetAnswer = async ({ character, hints }) => {
    try {
      character.rawTags = Array.from(character.rawTags.entries());
      const encryptedCharacter = CryptoJS.AES.encrypt(
        JSON.stringify(character),
        secret
      ).toString();
      socketRef.current?.emit("setAnswer", {
        roomId,
        character: encryptedCharacter,
        hints,
      });
      setShowSetAnswerPopup(false);
    } catch (error) {
      console.error("Failed to set answer:", error);
      alert("Failed to set answer, please try again");
    }
  };

  const handleKickPlayer = (playerId) => {
    if (!isHost || !socketRef.current) return;

    // 确认当前Player是房主
    const currentPlayer = players.find((p) => p.id === socketRef.current.id);
    if (!currentPlayer || !currentPlayer.isHost) {
      alert("Only the host can kick a player");
      return;
    }

    // 防止房主踢出自己
    if (playerId === socketRef.current.id) {
      alert("The host cannot kick themselves");
      return;
    }

    // 确认后再踢出
    if (window.confirm("Are you sure you want to kick this player?")) {
      try {
        socketRef.current.emit("kickPlayer", { roomId, playerId });
      } catch (error) {
        console.error("踢出Player失败:", error);
        alert("Failed to kick player, please try again");
      }
    }
  };

  const handleTransferHost = (playerId) => {
    if (!isHost || !socketRef.current) return;

    // 确认后再转移房主
    if (
      window.confirm(
        "Are you sure you want to transfer host privileges to this player?"
      )
    ) {
      socketRef.current.emit("transferHost", { roomId, newHostId: playerId });
      setIsHost(false);
    }
  };

  // Add handleQuickJoin function
  const handleQuickJoin = async () => {
    try {
      const response = await axios.get(`${SOCKET_URL}/quick-join?lang=en`);
      window.location.href = response.data.url;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        alert(error.response.data.error || "No available public rooms");
      } else {
        alert("Quick Join失败，请重试");
      }
    }
  };

  // Create一个函数显示踢出通知
  const showKickNotification = (message, type = "kick") => {
    setKickNotification({ message, type });
    setTimeout(() => {
      setKickNotification(null);
    }, 5000); // 5秒后自动关闭通知
  };

  // Handle player message change
  const handleMessageChange = (newMessage) => {
    setPlayers((prevPlayers) =>
      prevPlayers.map((p) =>
        p.id === socketRef.current?.id ? { ...p, message: newMessage } : p
      )
    );
    // Emit to server for sync
    socketRef.current?.emit("updatePlayerMessage", {
      roomId,
      message: newMessage,
    });
  };

  // Handle player team change
  const handleTeamChange = (playerId, newTeam) => {
    if (!socketRef.current) return;
    setPlayers((prevPlayers) =>
      prevPlayers.map((p) =>
        p.id === playerId ? { ...p, team: newTeam || null } : p
      )
    );
    // Emit to server for sync
    socketRef.current.emit("updatePlayerTeam", {
      roomId,
      team: newTeam || null,
    });
  };

  if (!roomId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="multiplayer-container">
      {/* 添加踢出通知 */}
      {kickNotification && (
        <div
          className={`kick-notification ${
            kickNotification.type === "host" ? "host-notification" : ""
          }`}
        >
          <div className="kick-notification-content">
            <i
              className={`fas ${
                kickNotification.type === "host"
                  ? "fa-crown"
                  : "fa-exclamation-circle"
              }`}
            ></i>
            <span>{kickNotification.message}</span>
          </div>
        </div>
      )}
      <a
        href="/"
        className="social-link floating-back-button"
        title="Back"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        <i className="fas fa-angle-left"></i>
      </a>
      {!isJoined ? (
        <>
          <div className="join-container">
            <h2>{isHost ? "Create Room" : "Join Room"}</h2>
            {isHost && !isJoined && (
              <button onClick={handleQuickJoin} className="join-button">
                Quick Join
              </button>
            )}
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="username-input"
              maxLength={20}
            />
            <button onClick={handleJoinRoom} className="join-button">
              {isHost ? "Create" : "Join"}
            </button>
            {/* Only show quick-join if not joined and is host, use same style as 'Create' */}
            {error && <p className="error-message">{error}</p>}
          </div>
          <Roulette />
          <Leaderboard />
        </>
      ) : (
        <>
          <PlayerList
            players={players}
            socket={socketRef.current}
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
            onTeamChange={handleTeamChange}
          />
          <div className="anonymous-mode-info">
            Anonymous mode? Click the "Name" header to toggle.
            <br />
            Chat feature? Click your name to edit a short message.
          </div>

          {!isGameStarted && !globalGameEnd && (
            <>
              {isHost && !waitingForAnswer && (
                <div className="host-controls">
                  <div className="room-url-container">
                    <input
                      type="text"
                      value={roomUrl}
                      readOnly
                      className="room-url-input"
                    />
                    <button onClick={copyRoomUrl} className="copy-button">
                      Copy
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
                      {isPublic ? "🔓 Public" : "🔒 Private"}
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="settings-button"
                    >
                      Settings
                    </button>
                    <button
                      onClick={handleStartGame}
                      className="start-game-button"
                      disabled={
                        players.length < 2 ||
                        players.some(
                          (p) => !p.isHost && !p.ready && !p.disconnected
                        ) ||
                        players.every((p) => p.team === "0")
                      }
                    >
                      Start
                    </button>
                    <button
                      onClick={handleManualMode}
                      className={`manual-mode-button ${
                        isManualMode ? "active" : ""
                      }`}
                      disabled={
                        players.length < 2 ||
                        players.some(
                          (p) => !p.isHost && !p.ready && !p.disconnected
                        ) ||
                        players.every((p) => p.team === "0")
                      }
                    >
                      Someone wants to set the answer?
                    </button>
                  </div>
                </div>
              )}
              {!isHost && (
                <>
                  {/* Debug Info*/}
                  {/* <pre style={{ fontSize: '12px', color: '#666', padding: '5px', background: '#f5f5f5' }}>
                    {JSON.stringify({...gameSettings, __debug: 'Display raw data for debugging'}, null, 2)}
                  </pre> */}
                  <GameSettingsDisplay settings={gameSettings} />
                </>
              )}
            </>
          )}

          {isGameStarted && !globalGameEnd && (
            // In game
            <div className="container">
              {!isAnswerSetter &&
              players.find((p) => p.id === socketRef.current?.id)?.team !==
                "0" ? (
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
                      <span>Remaining guesses: {guessesLeft}</span>
                      <button
                        className="surrender-button"
                        onClick={handleSurrender}
                      >
                        Surrender 🏳️
                      </button>
                    </div>
                    {Array.isArray(gameSettings.useHints) &&
                      gameSettings.useHints.length > 0 &&
                      hints &&
                      hints.length > 0 && (
                        <div className="hints">
                          {gameSettings.useHints.map(
                            (val, idx) =>
                              guessesLeft <= val &&
                              hints[idx] && (
                                <div className="hint" key={idx}>
                                  Hint{idx + 1}: {hints[idx]}
                                </div>
                              )
                          )}
                        </div>
                      )}
                    {guessesLeft <= useImageHint && imgHint && (
                      <div className="hint-container">
                        <img
                          src={imgHint}
                          style={{
                            height: "200px",
                            filter: `blur(${guessesLeft}px)`,
                          }}
                          alt="Hint"
                        />
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
                  <div className="selected-answer">
                    <img
                      src={answerCharacter.imageGrid}
                      alt={answerCharacter.name}
                      className="answer-image"
                    />
                    <div className="answer-info">
                      <div>{answerCharacter.name}</div>
                      <div>{answerCharacter.nameCn}</div>
                    </div>
                  </div>
                  {/* Switch for Simple/Detailed */}
                  <div style={{ margin: "10px 0", textAlign: "center" }}>
                    <button
                      className={answerViewMode === "simple" ? "active" : ""}
                      style={{
                        marginRight: 8,
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        background:
                          answerViewMode === "simple" ? "#e0e0e0" : "#fff",
                        cursor: "pointer",
                        color: "inherit",
                      }}
                      onClick={() => setAnswerViewMode("simple")}
                    >
                      Simple
                    </button>
                    <button
                      className={answerViewMode === "detailed" ? "active" : ""}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        background:
                          answerViewMode === "detailed" ? "#e0e0e0" : "#fff",
                        cursor: "pointer",
                        color: "inherit",
                      }}
                      onClick={() => setAnswerViewMode("detailed")}
                    >
                      Detailed
                    </button>
                  </div>
                  {answerViewMode === "simple" ? (
                    <div className="guess-history-table">
                      <table>
                        <thead>
                          <tr>
                            {guessesHistory.map((playerGuesses, index) => (
                              <th key={playerGuesses.username}>
                                {showNames
                                  ? playerGuesses.username
                                  : `Player${index + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({
                            length: Math.max(
                              ...guessesHistory.map((g) => g.guesses.length)
                            ),
                          }).map((_, rowIndex) => (
                            <tr key={rowIndex}>
                              {guessesHistory.map((playerGuesses) => (
                                <td key={playerGuesses.username}>
                                  {playerGuesses.guesses[rowIndex] && (
                                    <>
                                      <img
                                        className="character-icon"
                                        src={
                                          playerGuesses.guesses[rowIndex]
                                            .guessData.image
                                        }
                                        alt={
                                          playerGuesses.guesses[rowIndex]
                                            .guessData.name
                                        }
                                      />
                                      <div className="character-name">
                                        {
                                          playerGuesses.guesses[rowIndex]
                                            .guessData.name
                                        }
                                      </div>
                                      <div className="character-name-cn">
                                        {
                                          playerGuesses.guesses[rowIndex]
                                            .guessData.nameCn
                                        }
                                      </div>
                                    </>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ marginTop: 12 }}>
                      <GuessesTable
                        guesses={guesses}
                        gameSettings={gameSettings}
                        answerCharacter={answerCharacter}
                      />
                    </div>
                  )}
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
                      {isPublic ? "🔓 Public" : "🔒 Private"}
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="settings-button"
                    >
                      Settings
                    </button>
                    <button
                      onClick={handleStartGame}
                      className="start-game-button"
                      disabled={
                        players.length < 2 ||
                        players.some(
                          (p) => !p.isHost && !p.ready && !p.disconnected
                        )
                      }
                    >
                      Start
                    </button>
                    <button
                      onClick={handleManualMode}
                      className={`manual-mode-button ${
                        isManualMode ? "active" : ""
                      }`}
                      disabled={
                        players.length < 2 ||
                        players.some(
                          (p) => !p.isHost && !p.ready && !p.disconnected
                        )
                      }
                    >
                      Someone wants to set the answer?
                    </button>
                  </div>
                </div>
              )}
              <div className="game-end-message">
                {showNames ? (
                  <>
                    {winner}
                    <br />
                  </>
                ) : (
                  ""
                )}{" "}
                The answer is: {answerCharacter.nameCn || answerCharacter.name}
                <button
                  className="character-details-button"
                  onClick={() => setShowCharacterPopup(true)}
                >
                  View character details
                </button>
              </div>
              <div className="game-end-container">
                {!isHost && (
                  <>
                    {/* Debug Info*/}
                    {/* <pre style={{ fontSize: '12px', color: '#666', padding: '5px', background: '#f5f5f5' }}>
                      {JSON.stringify({...gameSettings, __debug: 'Display raw data for debugging'}, null, 2)}
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
                            {showNames
                              ? playerGuesses.username
                              : `Player${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({
                        length: Math.max(
                          ...guessesHistory.map((g) => g.guesses.length)
                        ),
                      }).map((_, rowIndex) => (
                        <tr key={rowIndex}>
                          {guessesHistory.map((playerGuesses) => (
                            <td key={playerGuesses.username}>
                              {playerGuesses.guesses[rowIndex] && (
                                <>
                                  <img
                                    className="character-icon"
                                    src={
                                      playerGuesses.guesses[rowIndex].guessData
                                        .image
                                    }
                                    alt={
                                      playerGuesses.guesses[rowIndex].guessData
                                        .name
                                    }
                                  />
                                  <div className="character-name">
                                    {
                                      playerGuesses.guesses[rowIndex].guessData
                                        .name
                                    }
                                  </div>
                                  <div className="character-name-cn">
                                    {
                                      playerGuesses.guesses[rowIndex].guessData
                                        .nameCn
                                    }
                                  </div>
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
              result={guesses.some((g) => g.isAnswer) ? "win" : "lose"}
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
