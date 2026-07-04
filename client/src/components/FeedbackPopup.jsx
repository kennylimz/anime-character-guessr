import React, { useState } from 'react';
import SearchBar from './SearchBar';
import '../styles/FeedbackPopup.css';
import '../styles/popups.css';

const FEEDBACK_TEXT = {
  zh: {
    title: '用户反馈',
    type: '反馈类型',
    description: '描述',
    placeholder: '请简单描述您遇到的问题或想法...',
    submitting: '提交中...',
    submit: '提交',
    types: [
      'Bug反馈',
      '标签反馈',
      '优化建议'
    ]
  },
  en: {
    title: 'Feedback',
    type: 'Feedback type',
    description: 'Description',
    placeholder: 'Briefly describe the issue or your suggestion...',
    submitting: 'Submitting...',
    submit: 'Submit',
    types: [
      'Bug feedback',
      'Tag feedback',
      'Optimization suggestion'
    ]
  }
};

const FeedbackPopup = ({ onClose, onSubmit, onTagFeedbackSelect, locale = 'zh' }) => {
  const text = FEEDBACK_TEXT[locale] || FEEDBACK_TEXT.zh;
  const isEnglish = locale === 'en';
  
  const [type, setType] = useState(text.types[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBugFeedback = type === 'Bug反馈' || type === 'Bug feedback';
  const isTagFeedback = type === '标签反馈' || type === 'Tag feedback';

  const handleCharacterSelect = (character) => {
    onTagFeedbackSelect?.(character);
    onClose?.();
  };

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    
    // Logs are automatically uploaded only for Bug Feedback
    const includeLogs = isBugFeedback;
    
    try {
      await onSubmit?.({ type, description: trimmed, includeLogs });
      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="feedback-popup-overlay" role="dialog" aria-modal="true">
      <div className="feedback-popup">
        <button className="popup-close" onClick={onClose} aria-label={isEnglish ? 'Close' : '关闭'}>
          <i className="fas fa-xmark"></i>
        </button>

        <div className="feedback-header">
          <h3>{text.title}</h3>
        </div>

        <label className="feedback-label">
          {text.type}
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="feedback-select"
          >
            {text.types.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        {isTagFeedback ? (
          <div className="feedback-tag-search-container" style={{ margin: '5px 0' }}>
            <div className="feedback-hint-tip" style={{ marginBottom: '15px' }}>
              {isEnglish ? 'You can also click "Contribute Tags" on the character card page after the game ends.' : '在游戏结束后的角色卡片页面点击“贡献标签”也可以进行标签反馈'}
            </div>
            <SearchBar
              onCharacterSelect={handleCharacterSelect}
              isGuessing={false}
              gameEnd={false}
              subjectSearch={true}
              finishInit={true}
              locale={locale}
              placeholder={isEnglish ? 'Search characters to submit feedback...' : '搜索想反馈的角色'}
            />
          </div>
        ) : (
          <label className="feedback-label">
            {text.description}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={text.placeholder}
              rows={4}
              className="feedback-textarea"
              maxLength={100}
            />
            <div className="feedback-hint">{description.length}/100</div>
          </label>
        )}

        {!isTagFeedback && (
          <div className="feedback-actions">
            <button
              type="button"
              className="feedback-button primary"
              style={{ width: '100%' }}
              onClick={handleSubmit}
              disabled={!description.trim() || isSubmitting}
            >
              {isSubmitting ? text.submitting : text.submit}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackPopup;
