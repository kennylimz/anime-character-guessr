import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/FeedbackBoard.css';

const BOARD_TEXT = {
  zh: {
    title: '反馈公开栏',
    collapse: '收起 ▼',
    expand: '展开 ▶',
    loading: '正在加载反馈记录...',
    empty: '暂无公开反馈记录',
    replyHeader: '开发者回复：',
    addFeedback: '新增反馈'
  },
  en: {
    title: 'Public Feedback Board',
    collapse: 'Collapse ▼',
    expand: 'Expand ▶',
    loading: 'Loading feedback records...',
    empty: 'No public feedback records found',
    replyHeader: 'Developer Reply: ',
    addFeedback: 'Add Feedback'
  }
};

const FeedbackBoard = ({ defaultExpanded = false, locale = 'zh', onAddFeedbackClick }) => {
  const text = BOARD_TEXT[locale] || BOARD_TEXT.zh;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFeedbacks = async () => {
      setLoading(true);
      try {
        const serverUrl = import.meta.env.VITE_SERVER_URL || '';
        const response = await axios.get(`${serverUrl}/api/feedback-list`);
        if (Array.isArray(response.data)) {
          setFeedbacks(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch feedback list:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFeedbacks();
  }, []);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const formatLocalTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return dateStr;
    }
  };

  const displayedFeedbacks = isExpanded ? feedbacks : feedbacks.slice(0, 3);

  return (
    <div className="feedback-board">
      <div className="feedback-board-header">
        <div className="feedback-board-header-left" onClick={toggleExpand}>
          <h3>{text.title}</h3>
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            {isExpanded ? text.collapse : text.expand}
          </span>
        </div>
        <button 
          className="add-feedback-btn" 
          onClick={(e) => {
            e.stopPropagation();
            onAddFeedbackClick?.();
          }}
          type="button"
        >
          <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>
          {text.addFeedback}
        </button>
      </div>
      
      <div className="feedback-board-content" style={!isExpanded ? { maxHeight: 'none', overflowY: 'visible' } : {}}>
        {loading && (
          <div className="feedback-board-status">{text.loading}</div>
        )}
        
        {!loading && feedbacks.length === 0 && (
          <div className="feedback-board-status">{text.empty}</div>
        )}
        
        {!loading && displayedFeedbacks.map((item, index) => (
          <div key={index} className="feedback-board-item">
            <div className="feedback-board-meta">
              <span className={`feedback-type-tag ${
                item.bugType?.includes('Bug') ? 'tag-bug' : 
                item.bugType?.includes('标签') || item.bugType?.includes('Tag') ? 'tag-tag' : 'tag-suggest'
              }`}>
                {item.bugType}
              </span>
              <span className="feedback-date">{formatLocalTime(item.createdAt)}</span>
            </div>
            <div className="feedback-description">
              {item.description}
            </div>
            {item.reply && (
              <div className="feedback-developer-reply">
                <span className="reply-header">
                  <i className="fas fa-reply fa-flip-horizontal" style={{ marginRight: '6px' }}></i>
                  {text.replyHeader}
                </span>
                <span className="reply-content">
                  {item.reply}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedbackBoard;
