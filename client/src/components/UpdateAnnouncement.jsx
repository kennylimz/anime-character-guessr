import { useState } from "react";
import "../styles/UpdateAnnouncement.css";

/**
 * Update Announcement Component
 * @param {Object} props
 * @param {Array} props.announcements - Announcements array, each element contains version, date, and content properties
 * @param {boolean} props.defaultExpanded - Whether expanded by default (otherwise collapsed)
 * @param {number} props.initialVisibleCount - Default number of visible announcements
 */
const UpdateAnnouncement = ({
  announcements,
  defaultExpanded = false,
  initialVisibleCount = 1,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // If there are no announcements, do not display the component
  if (!announcements || announcements.length === 0) {
    return null;
  }

  // Toggle expand/collapse state
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="update-announcement">
      <div className="update-header" onClick={toggleExpand}>
        <h3>Update Announcements</h3>
        <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
          {isExpanded ? "Collapse ▼" : "Expand ▶"}
        </span>
      </div>

      <div className="announcement-content">
        {(isExpanded
          ? announcements
          : announcements.slice(1, initialVisibleCount + 1)
        ).map((announcement, index) => (
          <div key={index} className="announcement-item">
            {announcement.version && (
              <div className="announcement-version">
                <span className="version-tag">v{announcement.version}</span>
                {announcement.date && (
                  <span className="date">{announcement.date}</span>
                )}
              </div>
            )}
            <div
              className="announcement-text"
              dangerouslySetInnerHTML={{ __html: announcement.content }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpdateAnnouncement;
