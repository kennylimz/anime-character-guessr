import '../styles/popups.css';
import subaruIcon from '/assets/subaru.jpg';
import { useState } from 'react';
import TagContributionPopup from './TagContributionPopup';

function GameEndPopup({ result, answer, onClose }) {
  const [showTagPopup, setShowTagPopup] = useState(false);

  if (showTagPopup) {
    return (
      <TagContributionPopup
        character={answer}
        onClose={() => {
          setShowTagPopup(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
        <div className="popup-header">
          <h2>{result === 'win' ? '🎉 给你猜对了，有点东西' : '😢 已经结束咧'}</h2>
        </div>
        <div className="popup-body">
          <div className="answer-character">
            <img
              src={answer.image}
              alt={answer.name}
              className="answer-character-image"
            />
            <div className="answer-character-info">
              <div className="character-name-container">
                <a
                  href={`https://bgm.tv/character/${answer.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="character-link"
                >
                  <div className="answer-character-name">{answer.name}</div>
                  <div className="answer-character-name-cn">{answer.nameCn}</div>
                </a>
                <div className="button-container">
                  <button
                    className="contribute-tag-btn"
                    onClick={() => setShowTagPopup(true)}
                  >
                    贡献标签
                  </button>
                  <img src={subaruIcon} alt="" className="button-icon" />
                </div>
              </div>

              {/* 角色出演作品 */}
              {answer.appearances && answer.appearances.length > 0 && (
                <div className="answer-appearances">
                  <h3>出演作品：</h3>
                  <ul className="appearances-list">
                    {answer.appearances.slice(0, 3).map((appearance, index) => (
                      <li key={index}>{appearance}</li>
                    ))}
                    {answer.appearances.length > 3 && (
                      <li>...等 {answer.appearances.length} 部作品</li>
                    )}
                  </ul>
                </div>
              )}

              {/* 角色标签 */}
              {answer.metaTags && answer.metaTags.length > 0 && (
                <div className="answer-tags">
                  <h3>标签：</h3>
                  <div className="tags-container">
                    {answer.metaTags.map((tag, index) => (
                      <span key={index} className="character-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 角色简介 */}
              {answer.summary && (
                <div className="answer-summary">
                  <h3>角色简介：</h3>
                  <div className="summary-content">{answer.summary}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameEndPopup;
