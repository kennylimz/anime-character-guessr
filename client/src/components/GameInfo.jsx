import "../styles/game.css";

function GameInfo({
  gameEnd,
  guessesLeft,
  onRestart,
  finishInit,
  hints,
  useHints = [],
  onSurrender,
  imgHint = null,
  useImageHint = 0,
}) {
  return (
    <div className="game-info">
      {gameEnd ? (
        <button className="restart-button" onClick={onRestart}>
          Play Again
        </button>
      ) : (
        <div className="game-info-container">
          <div className="game-controls">
            <span>Remaining Attempts: {guessesLeft}</span>
            {onSurrender && (
              <button
                disabled={!finishInit}
                className="surrender-button"
                onClick={onSurrender}
              >
                Surrender 🏳️
              </button>
            )}
          </div>
          {useHints &&
            hints &&
            useHints.map((val, idx) => (
              <div key={idx}>
                {guessesLeft <= val && hints[idx] && (
                  <div className="hint-container">
                    <span className="hint-label">Hint {idx + 1}:</span>
                    <span className="hint-text">{hints[idx]}</span>
                  </div>
                )}
              </div>
            ))}
          {guessesLeft <= useImageHint && imgHint && (
            <div className="hint-container">
              <img
                className="hint-image"
                src={imgHint}
                style={{ height: "200px", filter: `blur(${guessesLeft}px)` }}
                alt="Hint"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GameInfo;
