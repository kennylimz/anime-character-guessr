import '../styles/popups.css';
import { useState, useRef, useEffect } from 'react';
import { submitCharacterTags, proposeCustomTags, submitFeedbackTags } from '../utils/db';
import { idToTags } from '../data/id_tags.js';

function TagContributionPopup({ character, onClose }) {
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTags, setCustomTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeVoteTag, setActiveVoteTag] = useState(null);
  const [upvotedTags, setUpvotedTags] = useState(new Set());
  const [downvotedTags, setDownvotedTags] = useState(new Set());
  
  // Close vote box when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.vote-box') && !event.target.closest('.existing-tag-btn')) {
        setActiveVoteTag(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleTagVoteClick = (event, tag) => {
    console.log(character);
    event.stopPropagation();
    setActiveVoteTag(activeVoteTag === tag ? null : tag);
  };

  const handleVote = (tag, vote) => {
    // Remove from both sets first
    upvotedTags.delete(tag);
    downvotedTags.delete(tag);

    // Then add to appropriate set based on vote
    if (vote === 'up') {
      upvotedTags.add(tag);
    }
    else if (vote === 'down') {
      downvotedTags.add(tag);
    }
    else if (vote === 'neutral') {
      upvotedTags.delete(tag);
      downvotedTags.delete(tag);
    }
    
    // Force a re-render by setting the state with the same Set
    setUpvotedTags(new Set(upvotedTags));
    setDownvotedTags(new Set(downvotedTags));
    setActiveVoteTag(null);
  };

  const getTagClassName = (tag) => {
    let className = 'existing-tag-btn';
    if (upvotedTags.has(tag)) {
      className += ' upvoted';
    } else if (downvotedTags.has(tag)) {
      className += ' downvoted';
    }
    return className;
  };

  const MAX_TAGS = 6;
  const totalTags = selectedTags.length + customTags.length;

  const handleTagClick = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag));
    } else if (totalTags < MAX_TAGS) {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  const handleCustomTagAdd = () => {
    const trimmedTag = customTagInput.trim();
    if (!trimmedTag) {
      setInputError('标签不能为空');
      return;
    }
    if (trimmedTag.length > 8) {
      setInputError('标签最多8个字符');
      return;
    }
    if (customTags.includes(trimmedTag)) {
      setInputError('标签已存在');
      return;
    }
    if (totalTags >= MAX_TAGS) {
      setInputError(`最多只能添加${MAX_TAGS}个标签`);
      return;
    }
    setCustomTags(prev => [...prev, trimmedTag]);
    setCustomTagInput('');
    setInputError('');
  };

  const handleCustomTagRemove = (tagToRemove) => {
    setCustomTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomTagAdd();
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Submit both selected and custom tags if they exist
      const submitPromises = [];
      
      if (selectedTags.length > 0) {
        submitPromises.push(submitCharacterTags(character.id, selectedTags));
      }
      
      if (customTags.length > 0) {
        submitPromises.push(proposeCustomTags(character.id, customTags));
      }

      // Submit tag feedback if there are any votes
      if (upvotedTags.size > 0 || downvotedTags.size > 0) {
        submitPromises.push(submitFeedbackTags(character.id, upvotedTags, downvotedTags));
      }
      
      await Promise.all(submitPromises);
      
      alert('感谢您的贡献！');
      onClose();
    } catch (error) {
      console.error('Error submitting tags:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tagGroups = {
    '发色': ['黑发', '金发', '蓝发', '棕发', '银发', '红发', '紫发', '橙发', '绿发', '粉发', '挑染', '双色发', '彩虹发', '多色发', '阴阳发'],
    '发型': ['长直', '短发', '呆毛', '双马尾', '长发', '卷发', '黑长直', '高马尾', '马尾', '麻花辫', '长鬓角', '齐刘海', '遮单眼发', 
      'M形刘海', '下双马尾', '中长发', '胡须', '渐变色发', '进气口发型', '侧单马尾', '披肩双马尾', '中分', '姬发式', '斜刘海', '偏分',
      '双麻花辫', '低马尾', '不对称鬓发', '粗眉', '高额头', '长卷发', '丸子头', '光头', '乱发', '双丸子头', '长刘海', '盘发', '人字刘海',
      '尾扎长发', '单麻花辫', '大背头', '双螺旋', '短刘海', '死亡发型', '两根呆毛'],
    '瞳色': ['黑瞳', '金瞳', '蓝瞳', '棕瞳', '灰瞳', '红瞳', '紫瞳', '橙瞳', '绿瞳', '粉瞳', '白瞳', '异色瞳', '渐变瞳', '彩虹瞳'],
    '性格': ['元气', '傲娇', '温柔', '反差萌', '天然呆', '腹黑', '毒舌', '笨蛋', '强气', '认真', '无口', 'S属性', '病娇', '冒失',
      '冰美人', '小恶魔系', '中二病', '富有正义感', '三无', '糟糕', '女王(性格)', '小天使', '单纯', '忠犬', '狂气', '醋缸', '老好人', 
      '无铁炮', '孤僻', '慵懒', 'M属性', '天然黑', '话痨', '暴力女', '好奇', '天真无邪', '爱哭鬼', '胆小', '可靠', '怕羞', '自恋', 
      '调皮', '变态', '自卑', '拜金', '自来熟', '文静', '少女心', '热血', '暖男', '迟钝', '阳角'],
    '身份': ['高中生', '大小姐', '优等生', '天才', '组织领导人', '孤儿', '公主', '混血儿', '初中生', '大学生', '小学生', '部长', '贵族',
      '宅女', '黑社会人士', '转学生', '玩家', 'BOSS', '女王(身份)', '大少爷', '不良', '学生', '双重身份', '中国人', '辣妹', '外国人',
      '差生', '穿越者', '君主', '王子', '留学生']
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
        <div className="popup-header">
          <h2>为 {character.nameCn} 贡献标签</h2>
        </div>
        <div className="popup-body">
          <div className="tag-contribution-container">
            <div className="character-preview">
              <img 
                src={character.image} 
                alt={character.name} 
                className="character-preview-image"
              />
              <div className="character-preview-info">
                <div className="character-preview-name">{character.name}</div>
                <div className="character-preview-name-cn">{character.nameCn}</div>
              </div>
              <div className="existing-tags">
                <h4>现有标签</h4>
                <div className="existing-tags-list">
                  {idToTags[character.id]?.map(tag => (
                    <div key={tag} className="existing-tag-container">
                      <button
                        className={getTagClassName(tag)}
                        onClick={(e) => handleTagVoteClick(e, tag)}
                      >
                        {tag}
                      </button>
                      {activeVoteTag === tag && (
                        <div className="vote-box">
                          <button onClick={() => handleVote(tag, 'up')} className="vote-btn">👍</button>
                          <button onClick={() => handleVote(tag, 'neutral')} className="vote-btn">👐🏼</button>
                          <button onClick={() => handleVote(tag, 'down')} className="vote-btn">👎</button>
                        </div>
                      )}
                    </div>
                  )) || <span className="no-tags">暂无</span>}
                </div>
              </div>
            </div>
            <div className="tag-input-section">
              <div className="tag-groups">
                {Object.entries(tagGroups).map(([groupName, tags]) => (
                  <div key={groupName} className="tag-group">
                    <h4 className="tag-group-title">{groupName}</h4>
                    <div className="tag-list">
                      {tags.map(tag => (
                        <button
                          key={tag}
                          className={`tag-suggestion ${selectedTags.includes(tag) ? 'selected' : ''} ${totalTags >= MAX_TAGS && !selectedTags.includes(tag) ? 'disabled' : ''}`}
                          onClick={() => handleTagClick(tag)}
                          disabled={totalTags >= MAX_TAGS && !selectedTags.includes(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="tag-group">
                  <h4 className="tag-group-title">自定义标签</h4>
                  <div className="custom-tag-input">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="添加自定义标签（最多8字符）"
                      maxLength={8}
                      className={inputError ? 'has-error' : ''}
                      disabled={totalTags >= MAX_TAGS}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#000000',
                      }}
                    />
                    <button 
                      onClick={handleCustomTagAdd}
                      disabled={totalTags >= MAX_TAGS}
                    >
                      添加
                    </button>
                  </div>
                  {inputError && <div className="input-error">{inputError}</div>}
                  {customTags.length > 0 && (
                    <div className="custom-tags-list">
                      {customTags.map(tag => (
                        <div key={tag} className="custom-tag">
                          <span>{tag}</span>
                          <button onClick={() => handleCustomTagRemove(tag)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="popup-footer">
          <button 
            className="submit-tags-btn" 
            disabled={(totalTags === 0 && upvotedTags.size === 0 && downvotedTags.size === 0) || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? '提交中...' : `提交标签 (${totalTags}/${MAX_TAGS})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TagContributionPopup; 
