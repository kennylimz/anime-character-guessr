import React, { useState } from 'react';
import SearchBar from './SearchBar';
import '../styles/SetAnswerPopup.css';
import { designateCharacter } from '../utils/bangumi';
import { submitAnswerCharacterCount } from '../utils/db';

const SetAnswerPopup = ({ onSetAnswer, gameSettings }) => {
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [hints, setHints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCharacterSelect = async (character) => {
    setSelectedCharacter(character);
  };

  const handleHintChange = (idx, value) => {
    setHints(prev => {
      const newHints = [...prev];
      newHints[idx] = value;
      return newHints;
    });
  };

  const handleSubmit = async () => {
    if (selectedCharacter && !isSubmitting) {
      setIsSubmitting(true);
      try {
        const character = await designateCharacter(selectedCharacter.id, gameSettings);
        try {
          await submitAnswerCharacterCount(selectedCharacter.id, character.nameCn || character.name);
        } catch (error) {
          console.error('Failed to submit answer count:', error);
        }
        onSetAnswer({
          character,
          hints: hints.slice(0, Array.isArray(gameSettings.useHints) ? gameSettings.useHints.length : 0)
        });
      } catch (error) {
        console.error('Failed to get character details:', error);
        alert('获取角色详情失败，请重试');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="set-answer-popup-overlay">
      <div className="set-answer-popup">
        <h2>请选择答案角色</h2>
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
          <h3>添加提示{Array.isArray(gameSettings.useHints) && gameSettings.useHints.length === 0 && '（未启用）'}</h3>
          {Array.isArray(gameSettings.useHints) && gameSettings.useHints.length > 0 && gameSettings.useHints.map((val, idx) => (
            <div className="hint-input-group" key={idx}>
              <label>提示{idx+1} (在剩余{val}次时出现):</label>
              <input
                type="text"
                value={hints[idx] || ''}
                onChange={e => handleHintChange(idx, e.target.value)}
                placeholder={`输入第${idx+1}条提示`}
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
          {isSubmitting ? '提交中...' : '确认'}
        </button>
      </div>
    </div>
  );
};

export default SetAnswerPopup; 