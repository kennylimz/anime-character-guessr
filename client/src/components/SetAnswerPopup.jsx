import React, { useState } from 'react';
import SearchBar from './SearchBar';
import Image from './Image';
import '../styles/SetAnswerPopup.css';
import { designateCharacter } from '../utils/bangumi';
import { submitAnswerCharacterCount } from '../utils/db';

const SET_ANSWER_TEXT = {
  zh: {
    fetchFailed: '获取角色详情失败，请重试',
    title: '请选择答案角色',
    addHints: '添加提示',
    disabled: '（未启用）',
    hint: '提示',
    hintAt: '在剩余',
    hintAtSuffix: '次时出现',
    hintPlaceholder: (index) => `输入第${index}条提示`,
    submitting: '提交中...',
    confirm: '确认'
  },
  en: {
    fetchFailed: 'Failed to load character details. Please try again.',
    title: 'Select a Character as Answer',
    addHints: 'Add Hints',
    disabled: ' (disabled)',
    hint: 'Hint',
    hintAt: 'shown at',
    hintAtSuffix: 'guesses left',
    hintPlaceholder: (index) => `Enter hint ${index}`,
    submitting: 'Submitting...',
    confirm: 'Confirm'
  }
};

const SetAnswerPopup = ({ onSetAnswer, gameSettings, locale = 'zh' }) => {
  const text = SET_ANSWER_TEXT[locale] || SET_ANSWER_TEXT.zh;
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
        if (error?.isConnectionClosed || error?.code === 'ERR_CONNECTION_CLOSED' || error?.code === 'ERR_CONNECTION_TIMED_OUT' || error?.code === 'ECONNABORTED' || !error?.response ||
            String(error).toLowerCase().includes('closed') || String(error).toLowerCase().includes('timeout') || String(error).toLowerCase().includes('timed out') ||
            String(error).toLowerCase().includes('network') || String(error).toLowerCase().includes('fetch')) {
          return;
        }
        alert(text.fetchFailed);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="set-answer-popup-overlay">
      <div className="set-answer-popup">
        <h2>{text.title}</h2>
        <div className="search-container">
          <SearchBar
            onCharacterSelect={handleCharacterSelect}
            isGuessing={false}
            gameEnd={false}
            subjectSearch={true}
            locale={locale}
          />
        </div>
        {selectedCharacter && (
          <div className="selected-character">
            <Image src={selectedCharacter.image} alt={selectedCharacter.name} />
            <div className="character-info">
              <div translate="no">{selectedCharacter.name}</div>
              <div>{locale === 'en' ? (selectedCharacter.nameEn || selectedCharacter.nameCn) : selectedCharacter.nameCn}</div>
            </div>
          </div>
        )}
        <div className="hints-container">
          <h3>{text.addHints}{Array.isArray(gameSettings.useHints) && gameSettings.useHints.length === 0 && text.disabled}</h3>
          {Array.isArray(gameSettings.useHints) && gameSettings.useHints.length > 0 && gameSettings.useHints.map((val, idx) => (
            <div className="hint-input-group" key={idx}>
              <label>{text.hint}{idx+1} ({text.hintAt} {val} {text.hintAtSuffix}):</label>
              <input
                type="text"
                value={hints[idx] || ''}
                onChange={e => handleHintChange(idx, e.target.value)}
                placeholder={text.hintPlaceholder(idx + 1)}
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
          {isSubmitting ? text.submitting : text.confirm}
        </button>
      </div>
    </div>
  );
};

export default SetAnswerPopup; 
