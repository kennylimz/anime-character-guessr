import '../styles/game.css';
import Image from './Image';
import BlurredImageHint from './BlurredImageHint';

const GAME_INFO_TEXT = {
  zh: {
    loading: '正在加载...',
    questionLoading: '题目正在加载中，请稍后',
    playAgain: '再玩一次',
    guessesLeft: '剩余次数',
    retry: '重试',
    surrender: '投降 🏳️',
    hint: '提示',
    imageHintAlt: '提示'
  },
  en: {
    loading: 'Loading...',
    questionLoading: 'Loading question, please wait...',
    playAgain: 'Play Again',
    guessesLeft: 'Attempts left',
    retry: 'Retry',
    surrender: 'Surrender 🏳️',
    hint: 'Hint',
    imageHintAlt: 'Hint'
  }
};

function GameInfo({ gameEnd, guessesLeft, onRestart, finishInit, hints, useHints = [], onSurrender, imgHint=null, useImageHint=0, initFailed=false, isRestarting=false, locale='zh' }) {
  const text = GAME_INFO_TEXT[locale] || GAME_INFO_TEXT.zh;

  return (
    <div className="game-info">
      {gameEnd ? (
        <button className="restart-button" onClick={onRestart} disabled={isRestarting}>
          {isRestarting ? text.loading : text.playAgain}
        </button>
      ) : (
        <div className="game-info-container">
          <div className="game-controls">
            <span>{text.guessesLeft}: {guessesLeft}</span>
            {initFailed ? (
              <button className="restart-button" onClick={onRestart} disabled={isRestarting}>
                {isRestarting ? text.loading : text.retry}
              </button>
            ) : (
              onSurrender && (
                <button disabled={!finishInit} className="surrender-button" onClick={onSurrender}>
                  {text.surrender}
                </button>
              )
            )}
          </div>
          {!finishInit && !initFailed && (
            <div className="game-loading-banner">
              <span>{text.questionLoading}</span>
              <div className="loading-dots-orbit">
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
              </div>
            </div>
          )}
          {useHints && hints && useHints.map((val, idx) => (
            <div key={idx}>
              {guessesLeft <= val && hints[idx] && (
                <div className="hint-container">
                  <span className="hint-label">{text.hint} {idx+1}:</span>
                  <span className="hint-text">{hints[idx]}</span>
                </div>
              )}
            </div>
          ))}
          {guessesLeft <= useImageHint && imgHint && (
            <div className="hint-container">
              <BlurredImageHint src={imgHint} blurRadius={guessesLeft} alt={text.imageHintAlt} height={200} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GameInfo;

