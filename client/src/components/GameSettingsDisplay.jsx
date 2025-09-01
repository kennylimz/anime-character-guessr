import React from "react";
import { matchPreset } from "../data/presets";
import "../styles/GameSettingsDisplay.css";
/*相关内容
This is the multiplayer participant view, showing game settings*/
/**
 * Game Settings Display Component - Converts JSON game settings to visual display
 *
 * @param {Object} props
 * @param {Object} props.settings - Game Rules对象
 * @param {string} props.title - Display title, default is "The Room's Question Bank Range"
 * @param {boolean} props.collapsible - Whether collapsible, default is true
 * @param {boolean} props.defaultExpanded - Default expanded state, default is true
 */
const GameSettingsDisplay = ({
  settings,
  title = "The Room's Question Bank Range",
  collapsible = true,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  // If settings are missing or empty, show a loading message
  if (!settings || Object.keys(settings).length === 0) {
    return (
      <div className="game-settings-display">
        <div className="settings-display-header">
          <h3>{title}</h3>
        </div>
        <div className="settings-display-content">
          <div className="settings-group">
            <div className="settings-items">
              <div className="settings-item">
                <span className="setting-value">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 使用共享预设匹配函数获取预设信息
  const presetInfo = matchPreset(settings);

  // Convert boolean to text
  const boolToText = (value) => (value ? "Yes" : "No");

  // 将主要设置项映射为中文
  const settingLabels = {
    // Time Range
    yearRange: {
      label: "Work Time Range",
      value: `${settings.startYear || "Not Set"} - ${
        settings.endYear || "Not Set"
      }`,
    },
    // 热度设置
    topNSubjects: {
      label: "Top Ranked Works Count",
      value: settings.topNSubjects || "Not Set",
    },
    useSubjectPerYear: {
      label: "Calculate Popularity Per Year",
      value: boolToText(settings.useSubjectPerYear),
    },
    // Filter Settings
    metaTags: {
      label: "Category Filter",
      value: getMetaTagsText(settings.metaTags),
    },
    // Index Settings
    useIndex: {
      label: "Use Specific Index",
      value: boolToText(settings.useIndex),
    },
    indexId: {
      label: "Index ID",
      value: settings.indexId || "未使用",
    },
    // Character Settings
    mainCharacterOnly: {
      label: "Main Character Only",
      value: boolToText(settings.mainCharacterOnly),
    },
    characterNum: {
      label: "Characters Per Work",
      value: settings.characterNum || "Default",
    },
    // Game Rules
    maxAttempts: {
      label: "Maximum Attempts",
      value: settings.maxAttempts || "10",
    },
    useHints: {
      label: "Hint Occurrence",
      value:
        Array.isArray(settings.useHints) && settings.useHints.length > 0
          ? settings.useHints.join(",")
          : "None",
    },
    useImageHint: {
      label: "Image Hint",
      value: settings.useImageHint || "None",
    },
    includeGame: {
      label: "Include Game Works",
      value: boolToText(settings.includeGame),
    },
    timeLimit: {
      label: "Time Limit",
      value: settings.timeLimit ? `${settings.timeLimit}seconds` : "无限制",
    },
    subjectSearch: {
      label: "Enable Work Search",
      value: boolToText(settings.subjectSearch),
    },
    // Tag Settings
    characterTagNum: {
      label: "Number of Character Tags",
      value: settings.characterTagNum || "Default",
    },
    subjectTagNum: {
      label: "Number of Work Tags",
      value: settings.subjectTagNum || "Default",
    },
    commonTags: {
      label: "Prioritize Common Tags",
      value: boolToText(settings.commonTags),
    },
  };

  // Parse Meta Tags
  function getMetaTagsText(metaTags) {
    if (!metaTags || !Array.isArray(metaTags) || metaTags.length === 0)
      return "None";

    const validTags = metaTags.filter(
      (tag) => tag && typeof tag === "string" && tag.trim() !== ""
    );
    if (validTags.length === 0) return "None";

    return validTags.join("、");
  }

  // Group Settings by Type
  const settingGroups = {
    "Work Range": [
      "yearRange",
      "topNSubjects",
      "useSubjectPerYear",
      "metaTags",
    ],
    "Index Settings": ["useIndex", "indexId"],
    "Character Settings": [
      "mainCharacterOnly",
      "characterNum",
      "characterTagNum",
    ],
    "Game Rules": [
      "maxAttempts",
      "useHints",
      "timeLimit",
      "subjectSearch",
      "includeGame",
      "subjectTagNum",
      "commonTags",
    ],
  };

  const toggleExpand = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="game-settings-display">
      <div
        className={`settings-display-header ${
          collapsible ? "collapsible" : ""
        }`}
        onClick={toggleExpand}
      >
        <div className="settings-title-container">
          <h3>{title}</h3>
          {presetInfo.name && (
            <div className="preset-info">
              <span className="preset-name">{presetInfo.name}</span>
              {presetInfo.modified && (
                <span className="preset-modified">
                  (Host modified this preset)
                </span>
              )}
            </div>
          )}
        </div>
        {collapsible && (
          <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
            {isExpanded ? "▼" : "▶"}
          </span>
        )}
      </div>

      {(isExpanded || !collapsible) && (
        <div className="settings-display-content">
          {Object.entries(settingGroups).map(([groupName, settingKeys]) => (
            <div key={groupName} className="settings-group">
              <h4>{groupName}</h4>
              <div className="settings-items">
                {settingKeys.map((key) => (
                  <div key={key} className="settings-item" data-key={key}>
                    <span className="setting-label">
                      {settingLabels[key].label}:
                    </span>
                    <span className="setting-value">
                      {settingLabels[key].value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameSettingsDisplay;
