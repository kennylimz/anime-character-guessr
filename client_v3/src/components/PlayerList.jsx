import React, { useState } from 'react';

const PlayerList = ({ players, socket, isGameStarted, handleReadyToggle, onAnonymousModeChange, isManualMode, isHost, answerSetterId, onSetAnswerSetter }) => {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PlayerList; 