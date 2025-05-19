import '../styles/game.css';
import { useState } from 'react';

function GameInfo({ gameEnd, guessesLeft, onRestart, finishInit, enableHints, hints, onSurrender, enableMultipleHints, multipleHints }) {
  const showFirstHint = guessesLeft <= 5;
  const showSecondHint = guessesLeft <= 2;
  const [currentHintIndex, setCurrentHintIndex] = useState(-1);

  const renderMultipleHints = () => {
    if (!enableMultipleHints || !multipleHints || multipleHints.length === 0) {
      return null;
    }

    const currentHint = multipleHints[currentHintIndex];
    const isLastHint = currentHintIndex >= multipleHints.length - 1;

    return (
      <div className="multiple-hints-container">
        {currentHintIndex == -1 ? null : isLastHint ? (<div className="hint-container">
          <span className="hint-label">提示用完喽:</span>
          <span className="hint-text">还得再练！</span>
        </div>) : (<div className="hint-container">
          <span className="hint-label">提示 {currentHintIndex + 1}:</span>
          <span className="hint-text">{currentHint}</span>
        </div>)}
      </div>
    );
  };

  return (
    <div className="game-info">
      {gameEnd ? (
        <button className="restart-button" onClick={() => {
          setCurrentHintIndex(-1);
          onRestart();
          }}>
          再玩一次
        </button>
      ) : (
        <div className="game-info-container">
          <div className="game-controls">
            <span>剩余次数: {guessesLeft}</span>
            {onSurrender && (
              <button disabled={!finishInit} className="surrender-button" onClick={() => {
                setCurrentHintIndex(-1);
                onSurrender();
                }}>
                投降 🏳️
              </button>
            )}
            {enableMultipleHints && <button
            className="hint-button"
            onClick={() => setCurrentHintIndex(currentHintIndex + 1)}
          >
            提示 💡
          </button>}
          </div>
          {enableHints ? ( enableMultipleHints ? (
            renderMultipleHints()
          ) : (
            <>
              {showFirstHint && (
                <div className="hint-container">
                  <span className="hint-label">提示 1:</span>
                  <span className="hint-text">{hints.first}</span>
                </div>
              )}
              {showSecondHint && (
                <div className="hint-container">
                  <span className="hint-label">提示 2:</span>
                  <span className="hint-text">{hints.second}</span>
                </div>
              )}
            </>
          )) : null}
        </div>
      )}
    </div>
  );
}

export default GameInfo;
