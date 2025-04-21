import { useState } from 'react';
import '../styles/UpdateAnnouncement.css';

/**
 * 更新公告组件
 * @param {Object} props
 * @param {Array} props.announcements - 公告数组，每个元素包含 version, date, content 属性
 * @param {boolean} props.defaultExpanded - 是否默认展开（否则折叠）
 * @param {number} props.initialVisibleCount - 默认显示的公告数量
 */
const UpdateAnnouncement = ({ 
  announcements, 
  defaultExpanded = false,
  initialVisibleCount = 1
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  // 如果没有公告，则不显示组件
  if (!announcements || announcements.length === 0) {
    return null;
  }

  // 切换展开/折叠状态
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 显示更多公告
  const showMore = () => {
    setVisibleCount(announcements.length);
  };

  // 只显示有限数量的公告，或者展开时显示全部
  const displayedAnnouncements = isExpanded 
    ? announcements 
    : announcements.slice(0, visibleCount);

  return (
    <div className="update-announcement">
      <div className="update-header" onClick={toggleExpand}>
        <h3>更新公告</h3>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="announcement-content">
          {displayedAnnouncements.map((announcement, index) => (
            <div key={index} className="announcement-item">
              {announcement.version && (
                <div className="announcement-version">
                  <span className="version-tag">v{announcement.version}</span>
                  {announcement.date && <span className="date">{announcement.date}</span>}
                </div>
              )}
              <div className="announcement-text" dangerouslySetInnerHTML={{ __html: announcement.content }} />
            </div>
          ))}
          
          {!isExpanded && announcements.length > visibleCount && (
            <button className="show-more-button" onClick={showMore}>
              查看更多
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default UpdateAnnouncement; 