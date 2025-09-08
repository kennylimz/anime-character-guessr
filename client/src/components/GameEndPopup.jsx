import "../styles/popups.css";
import subaruIcon from "/assets/subaru.jpg";
import { useState } from "react";
import TagContributionPopup from "./TagContributionPopup";
import { idToTags } from "../data/id_tags";

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
        <button className="popup-close" onClick={onClose}>
          <i class="fas fa-xmark"></i>
        </button>
        <div className="popup-header">
          <h2>
            {result === "win"
              ? "🎉 You guessed it right, impressive!"
              : "😢 The game is over"}
          </h2>
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
                  <div className="answer-character-name-cn">
                    {answer.nameEn}
                  </div>
                </a>
                <div className="button-container">
                  <button
                    className="contribute-tag-btn"
                    onClick={() => setShowTagPopup(true)}
                  >
                    Contribute Tags
                  </button>
                  <img src={subaruIcon} alt="" className="button-icon" />
                </div>
              </div>

              {/* Character Appearances */}
              {answer.appearances && answer.appearances.length > 0 && (
                <div className="answer-appearances">
                  <h3>Appearances:</h3>
                  <ul className="appearances-list">
                    {answer.appearances.slice(0, 3).map((appearance, index) => (
                      <li key={index}>{appearance}</li>
                    ))}
                    {answer.appearances.length > 3 && (
                      <li>...and {answer.appearances.length} more works</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Character Tags */}
              {idToTags[answer.id] && idToTags[answer.id].length > 0 && (
                <div className="answer-tags">
                  <h3>Character Tags：</h3>
                  <div className="tags-container">
                    {idToTags[answer.id].map((tag, index) => (
                      <span key={index} className="character-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Character Summary */}
              {answer.summary && (
                <div className="answer-summary">
                  <h3>Character Summary：</h3>
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
