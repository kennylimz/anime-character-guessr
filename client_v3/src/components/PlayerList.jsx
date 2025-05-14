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
    const host = <span><i className={`fas fa-crown`}></i>房主</span>
    if (player.disconnected) {
      return renderStyledSpan('已断开','red');
    }

    if (waitingForAnswer) {
      if (player.id === answerSetterId) {
        return renderStyledSpan('出题中','orange');
      }
      if (player.isHost) {
        return host;
      }
      return renderStyledSpan('已准备','green');
    }

    if (isManualMode && !isGameStarted) {
      if (player.id === answerSetterId) {
        return <button className="ready-button ready">出题中</button>;
      }
      return <button className="ready-button">选择</button>;
    }

    if (player.isHost) {
      return host;
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

    return player.ready ? renderStyledSpan('已准备','green') : renderStyledSpan('未准备');
  };

  const renderStyledSpan = (text, color = "inherit") => (
    <span style={{ color }}>{text}</span>
  );

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
              <button className='table-head-name-button'
                onClick={handleShowNamesToggle}>
                {showNames ? '名' : '无名' }
              </button>
            </th>
            <th>分</th>
            <th>猜</th>
            {isHost && <th><span style={{ width: "100px",display:"block" }}>操作</span></th>}
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
                    >
                      ⚙️ 操作
                    </button>
                    
                    {activeMenu === player.id && (
                      <div className="action-dropdown">
                        <button className='action-button'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKickClick(e, player.id);
                            setActiveMenu(null);
                          }}
                          >
                          <span>❌</span> 踢出
                        </button>
                        
                        {!player.disconnected && (
                          <button className='action-button'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTransferHostClick(e, player.id);
                              setActiveMenu(null);
                            }}
                            style={{ color: '#007bff' , borderBottom: '0px' }}
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