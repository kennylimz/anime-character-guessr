import React, { useState } from 'react';

const PlayerList = ({ players, socket, isGameStarted, handleReadyToggle, onAnonymousModeChange, isManualMode, isHost, answerSetterId, onSetAnswerSetter, onKickPlayer, onTransferHost }) => {
  const [showNames, setShowNames] = useState(true);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);

  // Add socket event listener for waitForAnswer
  React.useEffect(() => {
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
                  {player.disconnected ? (
                    <button 
                      onClick={(e) => handleKickClick(e, player.id)}
                      className="kick-button"
                      title="踢出断开连接的玩家"
                      style={{
                        background: '#ffebeb',
                        border: '1px solid #dc3545',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#dc3545',
                        fontSize: '14px',
                        padding: '2px 6px',
                        marginRight: '5px'
                      }}
                    >
                      踢出
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => handleTransferHostClick(e, player.id)}
                      className="transfer-host-button"
                      title="将房主权限转移给该玩家"
                      style={{
                        background: '#e6f3ff',
                        border: '1px solid #007bff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#007bff',
                        fontSize: '14px',
                        padding: '2px 6px'
                      }}
                    >
                      转移房主
                    </button>
                  )}
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