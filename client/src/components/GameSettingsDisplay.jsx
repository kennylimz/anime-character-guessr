import React from 'react';
import { matchPreset } from '../data/presets';
import '../styles/GameSettingsDisplay.css';
/*这是多人游戏参与者视角，游戏设置的相关内容*/
/**
 * 游戏设置显示组件 - 将JSON格式的游戏设置转换为中文可视化显示
 * 
 * @param {Object} props
 * @param {Object} props.settings - 游戏设置对象
 * @param {string} props.title - 显示标题，默认为"该房间的题库范围"
 * @param {boolean} props.collapsible - 是否可折叠，默认为true
 * @param {boolean} props.defaultExpanded - 默认是否展开，默认为true
 */
const GameSettingsDisplay = ({ 
  settings, 
  title = "该房间的题库范围", 
  collapsible = true,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  // 如果没有settings或settings是空对象，显示提示信息
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
                <span className="setting-value">加载中...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 使用共享预设匹配函数获取预设信息
  const presetInfo = matchPreset(settings);

  // 将布尔值转换为中文显示
  const boolToText = (value) => value ? '是' : '否';

  // 将主要设置项映射为中文
  const settingLabels = {
    // 时间范围
    yearRange: {
      label: '作品时间范围',
      value: `${settings.startYear || '未设置'} - ${settings.endYear || '未设置'}`
    },
    // 热度设置
    topNSubjects: {
      label: '热度排行榜作品数',
      value: settings.topNSubjects || '未设置'
    },
    useSubjectPerYear: {
      label: '每年独立计算热度',
      value: boolToText(settings.useSubjectPerYear)
    },
    // 筛选设置
    metaTags: {
      label: '分类筛选',
      value: getMetaTagsText(settings.metaTags)
    },
    // 目录设置
    useIndex: {
      label: '使用指定目录',
      value: boolToText(settings.useIndex)
    },
    indexId: {
      label: '目录ID',
      value: settings.indexId || '未使用'
    },
    // 角色设置
    mainCharacterOnly: {
      label: '仅主角',
      value: boolToText(settings.mainCharacterOnly)
    },
    characterNum: {
      label: '每个作品的角色数',
      value: settings.characterNum || '默认'
    },
    // 游戏设置
    maxAttempts: {
      label: '最大尝试次数',
      value: settings.maxAttempts || '10'
    },
    useHints: {
      label: '提示出现次数',
      value: Array.isArray(settings.useHints) && settings.useHints.length > 0 ? settings.useHints.join(',') : '无'
    },
    includeGame: {
      label: '包含游戏作品',
      value: boolToText(settings.includeGame)
    },
    timeLimit: {
      label: '时间限制',
      value: settings.timeLimit ? `${settings.timeLimit}秒` : '无限制'
    },
    subjectSearch: {
      label: '启用作品搜索',
      value: boolToText(settings.subjectSearch)
    },
    // 标签设置
    characterTagNum: {
      label: '角色标签数量',
      value: settings.characterTagNum || '默认'
    },
    subjectTagNum: {
      label: '作品标签数量',
      value: settings.subjectTagNum || '默认'
    },
    commonTags: {
      label: '共同标签优先',
      value: boolToText(settings.commonTags)
    }
  };

  // 解析元标签
  function getMetaTagsText(metaTags) {
    if (!metaTags || !Array.isArray(metaTags) || metaTags.length === 0) return '无';
    
    const validTags = metaTags.filter(tag => tag && typeof tag === 'string' && tag.trim() !== '');
    if (validTags.length === 0) return '无';
    
    return validTags.join('、');
  }

  // 根据设置类型对设置项进行分组
  const settingGroups = {
    '作品范围': ['yearRange', 'topNSubjects', 'useSubjectPerYear', 'metaTags'],
    '目录设置': ['useIndex', 'indexId'],
    '角色设置': ['mainCharacterOnly', 'characterNum', 'characterTagNum'],
    '游戏规则': ['maxAttempts', 'useHints', 'timeLimit', 'subjectSearch', 'includeGame', 'subjectTagNum', 'commonTags']
  };

  const toggleExpand = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="game-settings-display">
      <div 
        className={`settings-display-header ${collapsible ? 'collapsible' : ''}`}
        onClick={toggleExpand}
      >
        <div className="settings-title-container">
          <h3>{title}</h3>
          {presetInfo.name && (
            <div className="preset-info">
              <span className="preset-name">{presetInfo.name}</span>
              {presetInfo.modified && (
                <span className="preset-modified">(房主有修改此预设)</span>
              )}
            </div>
          )}
        </div>
        {collapsible && (
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {(isExpanded || !collapsible) && (
        <div className="settings-display-content">
          {Object.entries(settingGroups).map(([groupName, settingKeys]) => (
            <div key={groupName} className="settings-group">
              <h4>{groupName}</h4>
              <div className="settings-items">
                {settingKeys.map(key => (
                  <div key={key} className="settings-item" data-key={key}>
                    <span className="setting-label">{settingLabels[key].label}:</span>
                    <span className="setting-value">{settingLabels[key].value}</span>
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