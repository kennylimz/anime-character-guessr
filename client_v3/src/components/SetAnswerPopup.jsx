import React, { useState } from 'react';
import SearchBar from './SearchBar';
import '../styles/SetAnswerPopup.css';
import { designateCharacter } from '../utils/bangumi';
import { submitAnswerCharacterCount } from '../utils/db';

const SetAnswerPopup = ({ onSetAnswer, gameSettings }) => {
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [hint1, setHint1] = useState('');
  const [hint2, setHint2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCharacterSelect = async (character) => {
    setSelectedCharacter(character);
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
          hints: [hint1, hint2]
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
          <h3>添加提示{!gameSettings.enableHints && '（已禁用）'}</h3>
          <div className="hint-input-group">
            <label>提示1:</label>
            <input
              type="text"
              value={hint1}
              onChange={(e) => setHint1(e.target.value)}
              placeholder={gameSettings.enableHints ? "输入第一条提示" : "提示已禁用"}
              maxLength={30}
              disabled={!gameSettings.enableHints}
            />
          </div>
          <div className="hint-input-group">
            <label>提示2:</label>
            <input
              type="text"
              value={hint2}
              onChange={(e) => setHint2(e.target.value)}
              placeholder={gameSettings.enableHints ? "输入第二条提示" : "提示已禁用"}
              maxLength={30}
              disabled={!gameSettings.enableHints}
            />
          </div>
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