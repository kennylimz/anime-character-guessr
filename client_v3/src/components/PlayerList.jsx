import React, { useState, useEffect } from 'react';

const PlayerList = ({ players, socket, isGameStarted, handleReadyToggle, onAnonymousModeChange, isManualMode, isHost, answerSetterId, onSetAnswerSetter, onKickPlayer, onTransferHost }) => {
  const [showNames, setShowNames] = useState(true);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);

  // Add socket event listener for waitForAnswer
 useEffect(() => {
    if (socket) {
      socket.on('waitForAnswer', () => {
        setWaitingForAnswer(true);
      });

      // Reset waiting state when game starts
      socket.on('gameStart', () => {
        setWaitingForAnswer(false);
      });
    }
  }, [socket]);

  // Add click outside handler to close menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (activeMenu && !event.target.closest('.player-actions')) {
        setActiveMenu(null);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenu]);

  const handleShowNamesToggle = () => {
    const newShowNames = !showNames;
    setShowNames(newShowNames);
    if (onAnonymousModeChange) {
      onAnonymousModeChange(newShowNames);
    }
  };

  const getStatusDisplay = (player) => {
    if (player.disconnected) {
      return '已断开';
    }

    if (waitingForAnswer) {
      if (player.id === answerSetterId) {
        return '出题中';
      }
      if (player.isHost) {
        return '房主';
      }
      return '已准备';
    }

    if (isManualMode && !isGameStarted) {
      if (player.id === answerSetterId) {
        return <button className="ready-button ready">出题中</button>;
      }
      return <button className="ready-button">选择</button>;
    }

    if (player.isHost) {
      return '房主';
    }

    if (player.id === socket?.id && !isGameStarted) {
      return (
        <button 
          onClick={handleReadyToggle}
          className={`ready-button ${player.ready ? 'ready' : ''}`}
        >
          {player.ready ? '取消准备' : '准备'}
        </button>
      );
    }

    return player.ready ? '已准备' : '未准备';
  };

  const handlePlayerClick = (player) => {
    if (isHost && isManualMode && !isGameStarted && !waitingForAnswer) {
      onSetAnswerSetter(player.id);
    }
  };

  const handleKickClick = (e, playerId) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发行点击事件
    if (onKickPlayer) {
      onKickPlayer(playerId);
    }
  };

  const handleTransferHostClick = (e, playerId) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发行点击事件
    if (onTransferHost) {
      onTransferHost(playerId);
    }
  };

  return (
    <div className="players-list">
      <table className="score-table">
        <thead>
          <tr>
            <th></th>
            <th>
              <button 
                onClick={handleShowNamesToggle} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  padding: '0',
                  margin: '0',
                  height: 'auto',
                  lineHeight: '1',
                  fontSize: 'inherit',
                  outline: 'none'
                }}
              >
                {showNames ? '名' : '无名'}
              </button>
            </th>
            <th>分</th>
            <th>猜</th>
            {isHost && <th>操作</th>} 
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr 
              key={player.id}
              onClick={() => handlePlayerClick(player)}
              style={{
                cursor: isHost && isManualMode && !isGameStarted && !waitingForAnswer ? 'pointer' : 'default'
              }}
            >
              <td>
                {getStatusDisplay(player)}
              </td>
              <td>
                <span style={{
                  backgroundColor: !showNames && player.id !== socket?.id ? '#000' : 'transparent',
                  color: !showNames && player.id !== socket?.id ? '#000' : 'inherit',
                  padding: !showNames && player.id !== socket?.id ? '2px 4px' : '0'
                }}>
                  {player.username}
                </span>
              </td>
              <td>{player.score}</td>
              <td>{isGameStarted && player.isAnswerSetter ? '出题者' : player.guesses || ''}</td>
              {isHost && player.id !== socket?.id && (
                <td>
                  <div className="player-actions" style={{ position: 'relative' }}>
                    <button 
                      className="action-menu-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // 切换显示该玩家的操作菜单
                        setActiveMenu(activeMenu === player.id ? null : player.id);
                      }}
                      style={{
                        background: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#212529',
                        padding: '4px 8px',
                        fontSize: '14px',
                        minWidth: '70px',
                      }}
                    >
                      ⚙️ 操作
                    </button>
                    
                    {activeMenu === player.id && (
                      <div className="action-dropdown" style={{
                        position: 'absolute',
                        background: 'white',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        width: '120px',
                        right: 0,
                        top: '100%',
                        marginTop: '4px',
                      }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKickClick(e, player.id);
                            setActiveMenu(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: '#dc3545',
                            borderBottom: '1px solid #eee',
                          }}
                        >
                          <span>❌</span> 踢出
                        </button>
                        
                        {!player.disconnected && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTransferHostClick(e, player.id);
                              setActiveMenu(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              color: '#007bff',
                            }}
                          >
                            <span>👑</span> 转移房主
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PlayerList; 