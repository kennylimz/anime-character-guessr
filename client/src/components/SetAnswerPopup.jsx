import React, { useState } from "react";
import SearchBar from "./SearchBar";
import "../styles/SetAnswerPopup.css";
import { designateCharacter } from "../utils/bangumi";
import { submitAnswerCharacterCount } from "../utils/db";

const SetAnswerPopup = ({ onSetAnswer, gameSettings }) => {
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [hints, setHints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCharacterSelect = async (character) => {
    setSelectedCharacter(character);
  };

  const handleHintChange = (idx, value) => {
    setHints((prev) => {
      const newHints = [...prev];
      newHints[idx] = value;
      return newHints;
    });
  };

  const handleSubmit = async () => {
    if (selectedCharacter && !isSubmitting) {
      setIsSubmitting(true);
      try {
        const character = await designateCharacter(
          selectedCharacter.id,
          gameSettings
        );
        try {
          await submitAnswerCharacterCount(
            selectedCharacter.id,
            character.nameCn || character.name
          );
        } catch (error) {
          console.error("Failed to submit answer count:", error);
        }
        onSetAnswer({
          character,
          hints: hints.slice(
            0,
            Array.isArray(gameSettings.useHints)
              ? gameSettings.useHints.length
              : 0
          ),
        });
      } catch (error) {
        console.error("Failed to get character details:", error);
        alert("Failed to get character details, please try again");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="set-answer-popup-overlay">
      <div className="set-answer-popup">
        <h2>Please select the answer character</h2>
        <div className="search-container">
          <SearchBar
            onCharacterSelect={handleCharacterSelect}
            isGuessing={false}
            gameEnd={false}
            subjectSearch={true}
          />
        </div>
        {selectedCharacter && (
          <div className="selected-character">
            <img src={selectedCharacter.image} alt={selectedCharacter.name} />
            <div className="character-info">
              <div>{selectedCharacter.name}</div>
              <div>{selectedCharacter.nameCn}</div>
            </div>
          </div>
        )}
        <div className="hints-container">
          <h3>
            Add hints
            {Array.isArray(gameSettings.useHints) &&
              gameSettings.useHints.length === 0 &&
              "(Not enabled)"}
          </h3>
          {Array.isArray(gameSettings.useHints) &&
            gameSettings.useHints.length > 0 &&
            gameSettings.useHints.map((val, idx) => (
              <div className="hint-input-group" key={idx}>
                <label>
                  Hint{idx + 1} (Appears when {val} uses remaining):
                </label>
                <input
                  type="text"
                  value={hints[idx] || ""}
                  onChange={(e) => handleHintChange(idx, e.target.value)}
                  placeholder={`Enter hint #${idx + 1}`}
                  maxLength={30}
                />
              </div>
            ))}
        </div>
        <button
          onClick={handleSubmit}
          className="submit-button"
          disabled={!selectedCharacter || isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Confirm"}
        </button>
      </div>
    </div>
  );
};

export default SetAnswerPopup;
