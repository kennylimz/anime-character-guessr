import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import '../styles/RoomManager.css';
import { useLocalStorage } from 'usehooks-ts';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const RoomManager = () => {
  const navigate = useNavigate();
  const [roomInput, setRoomInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  // Room history stored in local storage
  const [roomHistory, setRoomHistory] = useLocalStorage('room-history', []);

  // Filter and update room history status
  useEffect(() => {
    const updateRoomStatuses = async () => {
      if (roomHistory.length === 0) return;
      
      setLoadingRooms(true);
      
      try {
        // Create a copy of room history to update
        const updatedHistory = [...roomHistory];
        
        // Update each room's status if it's not too old (older than 24 hours)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        
        for (let i = 0; i < updatedHistory.length; i++) {
          const room = updatedHistory[i];
          
          // Skip rooms older than 24 hours
          if (room.lastVisited && new Date(room.lastVisited).getTime() < oneDayAgo) {
            continue;
          }
          
          try {
            const response = await axios.get(`${SOCKET_URL}/api/rooms/${room.id}`);
            updatedHistory[i] = {
              ...room,
              exists: response.data.exists,
              isPublic: response.data.isPublic,
              playerCount: response.data.playerCount,
              playerNames: response.data.playerNames,
              inGame: response.data.inGame,
              lastChecked: Date.now()
            };
          } catch (error) {
            // If room doesn't exist or error occurs
            updatedHistory[i] = {
              ...room,
              exists: false,
              lastChecked: Date.now()
            };
          }
        }
        
        setRoomHistory(updatedHistory);
      } catch (error) {
        console.error('Error updating room statuses:', error);
      } finally {
        setLoadingRooms(false);
      }
    };
    
    updateRoomStatuses();
  }, []);

  // Handle create room
  const handleCreateRoom = () => {
    const newRoomId = uuidv4();
    
    // Add to history
    const newRoom = {
      id: newRoomId,
      type: 'created',
      createdAt: Date.now(),
      lastVisited: Date.now(),
      exists: true,
    };
    
    setRoomHistory(prev => [newRoom, ...prev.filter(room => room.id !== newRoomId)]);
    
    // Navigate to the room with creator flag
    navigate(`/multiplayer/${newRoomId}?creator=true`);
  };

  // Handle join room
  const handleJoinRoom = () => {
    if (!roomInput.trim()) {
      setErrorMessage('请输入房间ID或房间链接');
      return;
    }
    
    // Extract room ID if a full URL was pasted
    let roomId = roomInput.trim();
    
    if (roomId.includes('/multiplayer/')) {
      roomId = roomId.split('/multiplayer/')[1].split(/[?#]/)[0];
    }
    
    // Validate room ID format
    if (!roomId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      setErrorMessage('无效的房间ID格式');
      return;
    }
    
    // Check if room exists
    axios.get(`${SOCKET_URL}/api/rooms/${roomId}`)
      .then(response => {
        if (response.data.exists) {
          // Add to history
          const newRoom = {
            id: roomId,
            type: 'joined',
            createdAt: response.data.createdAt,
            lastVisited: Date.now(),
            exists: true,
            isPublic: response.data.isPublic,
            playerCount: response.data.playerCount,
            playerNames: response.data.playerNames,
            inGame: response.data.inGame,
            lastChecked: Date.now()
          };
          
          setRoomHistory(prev => [newRoom, ...prev.filter(room => room.id !== roomId)]);
          
          // Navigate to the room
          navigate(`/multiplayer/${roomId}`);
        } else {
          setErrorMessage('房间不存在');
        }
      })
      .catch(() => {
        setErrorMessage('房间不存在或无法连接到服务器');
      });
  };

  // Handle room item click
  const handleRoomClick = (roomId) => {
    // Update last visited time
    setRoomHistory(prev => 
      prev.map(room => 
        room.id === roomId 
          ? {...room, lastVisited: Date.now()} 
          : room
      )
    );
    
    // Navigate to the room without creator flag
    navigate(`/multiplayer/${roomId}`);
  };

  // Delete room from history
  const handleDeleteRoom = (e, roomId) => {
    e.stopPropagation();
    setRoomHistory(prev => prev.filter(room => room.id !== roomId));
  };

  // Clear entire history
  const handleClearHistory = () => {
    if (window.confirm('确定要清空房间历史记录吗？')) {
      setRoomHistory([]);
    }
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Copy room ID to clipboard
  const copyRoomId = (e, roomId) => {
    e.stopPropagation();
    navigator.clipboard.writeText(roomId)
      .then(() => {
        setCopyMessage('房间ID已复制到剪贴板');
        setTimeout(() => setCopyMessage(''), 2000);
      })
      .catch(err => {
        console.error('无法复制房间ID:', err);
      });
  };

  return (
    <div className="room-manager-container">
      {copyMessage && (
        <div className="copy-notification">
          {copyMessage}
        </div>
      )}
      
      <div className="content-wrapper">
        <div className="room-actions">
          <div className="create-room-section">
            <h2>创建房间</h2>
            <p>创建一个新的游戏房间，你将成为房主并可以设置游戏参数。创建后可以邀请好友加入。</p>
            <button 
              className="create-room-button"
              onClick={handleCreateRoom}
            >
              创建新房间
            </button>
          </div>
          
          <div className="join-room-section">
            <h2>加入房间</h2>
            <p>输入房间ID或房间链接加入已有的游戏。确保房间公开且游戏尚未开始。</p>
            <div className="join-room-input-group">
              <input
                type="text"
                placeholder="输入房间ID或房间链接"
                value={roomInput}
                onChange={(e) => {
                  setRoomInput(e.target.value);
                  setErrorMessage('');
                }}
                className="join-room-input"
              />
              <button 
                className="join-room-button"
                onClick={handleJoinRoom}
              >
                加入
              </button>
            </div>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
          </div>
        </div>
        
        <div className="room-history-section">
          <div className="room-history-header">
            <h2>历史房间</h2>
            {roomHistory.length > 0 && (
              <button 
                className="clear-history-button"
                onClick={handleClearHistory}
              >
                清空历史
              </button>
            )}
          </div>
          
          {loadingRooms ? (
            <div className="loading-message">正在加载房间状态...</div>
          ) : (
            <>
              {roomHistory.length > 0 ? (
                <div className="room-list">
                  {roomHistory
                    .sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0))
                    .map((room) => (
                      <div 
                        key={room.id} 
                        className={`room-item ${!room.exists ? 'inactive' : ''} ${room.inGame ? 'in-game' : ''}`}
                      >
                        <div className="room-info">
                          <div className="room-primary-info">
                            <span className={`room-type-badge ${room.type === 'created' ? 'created' : 'joined'}`}>
                              {room.type === 'created' ? '创建' : '加入'}
                            </span>
                            <span 
                              className="room-id"
                              onClick={(e) => copyRoomId(e, room.id)}
                              title="点击复制房间ID"
                            >
                              <span className="room-id-label">房间ID:</span> {room.id.substring(0, 8)}... <span className="copy-icon">📋</span>
                            </span>
                            {room.exists && (
                              <span className={`room-status ${room.isPublic ? 'public' : 'private'}`}>
                                {room.isPublic ? '🔓公开' : '🔒私密'}
                              </span>
                            )}
                            {room.exists && room.inGame && (
                              <span className="room-game-status">游戏中</span>
                            )}
                          </div>
                          <div className="room-secondary-info">
                            {room.exists ? (
                              <span className="player-count">
                                玩家数量：{room.playerCount || 0}
                              </span>
                            ) : (
                              <span className="room-not-exists">房间不存在</span>
                            )}
                            <span className="room-date">
                              最近访问：{formatDate(room.lastVisited)}
                            </span>
                          </div>
                        </div>
                        <div className="room-action-buttons">
                          {room.exists && !room.inGame && room.isPublic && (
                            <button 
                              className="join-room-button-small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRoomClick(room.id);
                              }}
                              title="加入房间"
                            >
                              加入
                            </button>
                          )}
                          <button 
                            className="delete-room-button"
                            onClick={(e) => handleDeleteRoom(e, room.id)}
                            title="从历史记录中删除"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="no-history-message">暂无历史房间记录</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomManager; 