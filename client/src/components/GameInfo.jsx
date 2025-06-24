import '../styles/game.css';

function GameInfo({ gameEnd, guessesLeft, onRestart, finishInit, hints, useHints = [], onSurrender }) {
  return (
    <div className="game-info">
      {gameEnd ? (
        <button className="restart-button" onClick={onRestart}>
          再玩一次
        </button>
      ) : (
        <div className="game-info-container">
          <div className="game-controls">
            <span>剩余次数: {guessesLeft}</span>
            {onSurrender && (
              <button disabled={!finishInit} className="surrender-button" onClick={onSurrender}>
                投降 🏳️
              </button>
            )}
          </div>
          {useHints && hints && useHints.map((val, idx) => (
            guessesLeft <= val && hints[idx] && (
              <div className="hint-container" key={idx}>
                <span className="hint-label">提示 {idx+1}:</span>
                <span className="hint-text">{hints[idx]}</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

export default GameInfo;
