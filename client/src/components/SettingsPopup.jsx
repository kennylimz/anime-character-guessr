import '../styles/popups.css';
import '../styles/SettingsPopup.css';
import { getIndexInfo, searchSubjects } from '../utils/bangumi';
import { useState, useEffect, useRef } from 'react';
import axiosCache from '../utils/cached-axios';
import { getPresetConfig } from '../data/presets';
import { hasBgmAccelUrl, isBgmAccelEnabled, setBgmAccelEnabled } from '../utils/bgmApi';

// Helper Components
const Tooltip = ({ content }) => (
  <div className="tooltip-wrapper">
    <div className="tooltip-icon">?</div>
    <div className="tooltip-content" dangerouslySetInnerHTML={{ __html: content }} />
  </div>
);

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <div 
    className={`toggle-switch ${checked ? 'active' : ''}`} 
    onClick={() => !disabled && onChange(!checked)}
    style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
  >
    <div className="toggle-thumb" />
  </div>
);

const PRESET_KEYS = ['入门', '冻鳗高手', '老番享受者', '瓶子严选', '木柜子痴', '二游高手', '米哈游高手', 'MOBA糕手'];

const CATEGORY_OPTIONS = [
  { value: '全部', zh: '全部分类', en: 'All categories' },
  { value: '游戏', zh: '游戏', en: 'Games' },
  { value: '书籍', zh: '书籍', en: 'Books' },
  { value: '三次元', zh: '三次元', en: 'Live action' },
  { value: '', zh: '全部动画', en: 'All anime' },
  { value: 'TV', zh: 'TV', en: 'TV' },
  { value: 'Galgame', zh: 'Galgame', en: 'Galgame' },
  { value: 'WEB', zh: 'WEB', en: 'WEB' },
  { value: 'OVA', zh: 'OVA', en: 'OVA' },
  { value: '剧场版', zh: '剧场版', en: 'Movie' },
  { value: '动态漫画', zh: '动态漫画', en: 'Motion comic' },
  { value: '其他', zh: '其他', en: 'Other' }
];

const SOURCE_OPTIONS = [
  { value: '', zh: '全部来源', en: 'All sources' },
  { value: '原创', zh: '原创', en: 'Original' },
  { value: '漫画改', zh: '漫画改', en: 'Manga adaptation' },
  { value: '游戏改', zh: '游戏改', en: 'Game adaptation' },
  { value: '小说改', zh: '小说改', en: 'Novel adaptation' }
];

const GENRE_OPTIONS = [
  { value: '', zh: '全部类型', en: 'All genres' },
  { value: '科幻', zh: '科幻', en: 'Sci-fi' },
  { value: '喜剧', zh: '喜剧', en: 'Comedy' },
  { value: '百合', zh: '百合', en: 'Yuri' },
  { value: '校园', zh: '校园', en: 'School' },
  { value: '惊悚', zh: '惊悚', en: 'Thriller' },
  { value: '后宫', zh: '后宫', en: 'Harem' },
  { value: '机战', zh: '机战', en: 'Mecha' },
  { value: '悬疑', zh: '悬疑', en: 'Mystery' },
  { value: '恋爱', zh: '恋爱', en: 'Romance' },
  { value: '奇幻', zh: '奇幻', en: 'Fantasy' },
  { value: '推理', zh: '推理', en: 'Detective' },
  { value: '运动', zh: '运动', en: 'Sports' },
  { value: '耽美', zh: '耽美', en: 'BL' },
  { value: '音乐', zh: '音乐', en: 'Music' },
  { value: '战斗', zh: '战斗', en: 'Action' },
  { value: '冒险', zh: '冒险', en: 'Adventure' },
  { value: '萌系', zh: '萌系', en: 'Moe' },
  { value: '穿越', zh: '穿越', en: 'Isekai' },
  { value: '玄幻', zh: '玄幻', en: 'Xuanhuan' },
  { value: '乙女', zh: '乙女', en: 'Otome' },
  { value: '恐怖', zh: '恐怖', en: 'Horror' },
  { value: '历史', zh: '历史', en: 'History' },
  { value: '日常', zh: '日常', en: 'Slice of life' },
  { value: '剧情', zh: '剧情', en: 'Drama' },
  { value: '武侠', zh: '武侠', en: 'Wuxia' },
  { value: '美食', zh: '美食', en: 'Food' },
  { value: '职场', zh: '职场', en: 'Workplace' }
];

const SUBJECT_TYPE_LABELS = {
  en: {
    动漫: 'Anime',
    游戏: 'Game',
    书籍: 'Novel',
    三次元: 'Media'
  },
  zh: {
    动漫: '动漫',
    游戏: '游戏',
    书籍: '书籍',
    三次元: '三次元'
  }
};

const SETTINGS_TEXT = {
  zh: {
    title: '设置',
    subtitle: '将鼠标移到各设置的标签上可以看到提示，移到输入框上可以看到数值范围',
    clearCache: '清空缓存',
    close: '关闭',
    confirm: '确认修改',
    cacheCleared: '缓存已清空！',
    indexRequired: '请输入目录ID',
    indexNotFound: '目录不存在或者FIFA了',
    importFailed: '导入失败，请稍后重试',
    settingsImported: '设置已导入！',
    invalidJson: '导入失败无效的JSON文件',
    multiplayerTitle: '多人模式',
    multiplayerSubtitle: '这些模式可以自由组合出2⁴=16种模式',
    globalPickTitle: '角色全局BP',
    globalPickDesc: '角色只能被猜一次',
    tagBanTitle: '标签全局BP',
    tagBanDesc: '命中的标签会对别的玩家隐藏',
    syncModeTitle: '同步模式',
    syncModeDesc: '全员猜完才进下一轮',
    nonstopModeTitle: '血战模式',
    nonstopModeDesc: '直到最后一人猜对或次数耗尽',
    presetTitle: '预设配置',
    presetSubtitle: '我们准备了一些开箱即用的难度配置，您可以直接选用',
    exportConfig: '导出配置',
    importConfig: '导入配置',
    guessTitle: '猜测设置',
    guessSubtitle: '影响和玩家猜测有关的内容',
    subjectSearch: '搜索作品',
    subjectSearchTitle: '开启后，猜测时可以搜索一个作品中所有人物并从中选择',
    maxAttempts: '猜测次数（次）',
    maxAttemptsTitle: '一名玩家一局游戏能猜测的次数',
    timeLimit: '时间限制（秒/轮）',
    timeLimitTitle: '每轮猜测的限制时间，设为0或留空时关闭',
    range: '数值范围',
    textHints: '文本提示（剩x轮）',
    textHintsTitle: '剩余x轮时显示一次文本提示，从左到右填入从大到小的数值，留空或为0时关闭',
    imageHint: '图片提示（剩x轮）',
    imageHintTitle: '剩余x轮时显示图片提示，留空或为0时关闭。',
    answerTitle: '答案设置',
    answerSubtitle: '影响和答案角色有关的内容',
    subjectFilter: '作品筛选',
    subjectFilterTitle: "这行选项同时会影响登场作品的信息\n比如不想让剧场版计入登场数据，可以只勾选'TV'。\n当'使用目录'生效时，这行选项不会影响正确答案的抽取，只会影响表格内显示的信息。",
    yearRange: '年份范围',
    unavailableWithIndex: '开启目录时不可用',
    popularityRange: '热度范围',
    popularityTitle: '使用年榜时会先抽取某一年份，再从中抽取作品。\n削弱了新番热度的影响。\n利好老二次元！\n开启目录时不可用',
    totalRank: '总榜',
    yearlyRank: '年榜',
    disabledByIndex: '使用目录时不可切换',
    topN: '前N部',
    worksUnit: '部',
    characterCount: '角色数量',
    characterCountTitle: '作品中至少有多少名角色，设为0或留空时仅包含主角',
    characterCountPlaceholder: '角色数量',
    mainOnly: '仅主角',
    tagCount: '标签数量',
    tagCountTitle: '猜测时显示的来自作品和角色的标签数量',
    character: '角色',
    subject: '作品',
    useIndex: '使用目录',
    useIndexTitle: '勾选时，正确答案只会从目录（+额外作品）中抽取。\n目录id为bangumi.tv/index/目录id',
    indexId: '目录ID',
    import: '导入',
    extraSubjects: '额外作品',
    searchSubjects: '搜索作品...',
    searching: '搜索中...',
    totalWorks: (count) => `共 ${count} 部作品`,
    removeIndex: '移除目录',
    footerHint: '*设置改动点了才会生效！否则下一把生效',
    bgmAccel: '启用BGM加速',
    bgmAccelNote: '国内访问建议启用',
    bgmAccelTitle: '开启后使用加速镜像访问 Bangumi API，适合官方接口不可用的网络环境。',
    presetMessages: {
      二游高手: '那很有生活了😅',
      MOBA糕手: '风暴要火'
    },
    presets: {
      入门: '入门',
      冻鳗高手: '冻鳗高手',
      老番享受者: '老番享受者',
      瓶子严选: '瓶子严选',
      木柜子痴: '木柜子痴',
      二游高手: '二游高手',
      米哈游高手: '米哈游高高手',
      MOBA糕手: 'MOBA糕手'
    }
  },
  en: {
    title: 'Settings',
    subtitle: 'Hover over labels for details and over inputs for valid ranges',
    clearCache: 'Clear cache',
    close: 'Close',
    confirm: 'Apply changes',
    cacheCleared: 'Cache cleared.',
    indexRequired: 'Please enter an index ID.',
    indexNotFound: 'Index not found or unavailable.',
    importFailed: 'Import failed. Please try again later.',
    settingsImported: 'Settings imported.',
    invalidJson: 'Import failed: invalid JSON file.',
    multiplayerTitle: 'Multiplayer Modes',
    multiplayerSubtitle: 'These modes can be freely combined into 16 variants',
    globalPickTitle: 'Global Character Ban',
    globalPickDesc: 'Each character can only be guessed once',
    tagBanTitle: 'Global Tag Ban',
    tagBanDesc: 'Matched tags are hidden from other players',
    syncModeTitle: 'Sync Mode',
    syncModeDesc: 'Next round starts after everyone makes their guess',
    nonstopModeTitle: 'Endless Mode',
    nonstopModeDesc: 'Continue until the last player finishes',
    presetTitle: 'Presets',
    presetSubtitle: 'Expand tabs below to check details.',
    exportConfig: 'Export Config',
    importConfig: 'Import Config',
    guessTitle: 'Guess Settings',
    guessSubtitle: 'Controls related to player guesses',
    subjectSearch: 'Allow Work Search',
    subjectSearchTitle: 'When enabled, you can search a work then choose one of its characters',
    maxAttempts: 'Attempts',
    maxAttemptsTitle: 'How many guesses a player gets in one game',
    timeLimit: 'Time Limit (sec/round)',
    timeLimitTitle: 'Per-round time limit. Use 0 or leave blank to disable',
    range: 'Range',
    textHints: 'Text Hints (at x left)',
    textHintsTitle: 'Show a text hint when x guesses remain. Fill from left to right in descending order; blank or 0 disables.',
    imageHint: 'Image Hint (at x left)',
    imageHintTitle: 'Show an image hint when x guesses remain. Blank or 0 disables.',
    answerTitle: 'Answer Settings',
    answerSubtitle: 'Controls related to answer characters',
    subjectFilter: 'Subject Filter',
    subjectFilterTitle: "These options also affect appearance data.\nFor example, select only 'TV' if you do not want movies counted in appearance data.\nWhen 'Use Index' is enabled, this does not affect answer selection, only table data.",
    yearRange: 'Year Range',
    unavailableWithIndex: 'Unavailable when using an index',
    popularityRange: 'Subject Pool Size',
    popularityTitle: 'Yearly ranking first picks a year, then picks works from that year.\nThis reduces the influence of newer seasonal anime.\nUnavailable when using an index.',
    totalRank: 'All-time',
    yearlyRank: 'Per-year',
    disabledByIndex: 'Cannot switch while using an index',
    topN: 'Top N works',
    worksUnit: 'works',
    characterCount: 'Character Count',
    characterCountTitle: 'Minimum number of characters in a work. Use 0 or blank to include only main characters.',
    characterCountPlaceholder: 'Characters',
    mainOnly: 'Main characters only',
    tagCount: 'Tag Count',
    tagCountTitle: 'Number of work and character tags shown for each guess',
    character: 'Character',
    subject: 'Subject',
    useIndex: 'Use Index',
    useIndexTitle: 'When enabled, the correct answer is drawn only from the index plus extra works.\nIndex ID comes from bangumi.tv/index/{id}',
    indexId: 'Index ID',
    import: 'Import',
    extraSubjects: 'Extra Subjects',
    searchSubjects: 'Search subjects...',
    searching: 'Searching...',
    totalWorks: (count) => `${count} subjects`,
    removeIndex: 'Remove index',
    footerHint: '*Changes only take effect after applying settings; otherwise they apply next game',
    bgmAccel: 'Enable BGM Accel',
    bgmAccelNote: 'Recommended for users in Mainland China',
    bgmAccelTitle: 'Use an accelerated Bangumi API mirror when the official endpoint is unreachable.',
    presetMessages: {
      二游高手: 'That is quite a lifestyle.',
      MOBA糕手: 'The storm is coming.'
    },
    presets: {
      入门: 'Beginner',
      冻鳗高手: 'Anime Expert',
      老番享受者: 'Classic Anime',
      瓶子严选: 'Niu\'s Picks',
      木柜子痴: 'Girls Bands',
      二游高手: 'Gacha Game Lover',
      米哈游高手: 'HoYoverse Fan',
      MOBA糕手: 'MOBA Expert'
    }
  }
};

function SettingsPopup({ gameSettings, onSettingsChange, onClose, onRestart, hideRestart = false, isMultiplayer = false, locale = 'zh' }) {
  const text = SETTINGS_TEXT[locale] || SETTINGS_TEXT.zh;
  const optionLabel = (option) => option[locale] || option.zh;
  const getSubjectTypeLabel = (type) => SUBJECT_TYPE_LABELS[locale]?.[type] || type;
  const [indexInputValue, setIndexInputValue] = useState('');
  const [indexInfo, setIndexInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef(null);
  const [hintInputs, setHintInputs] = useState(['8','5','3']);
  const [localSettings, setLocalSettings] = useState(() => JSON.parse(JSON.stringify(gameSettings)));
  const [isGuessSettingsOpen, setIsGuessSettingsOpen] = useState(false);
  const [isAnswerSettingsOpen, setIsAnswerSettingsOpen] = useState(false);
  const [bgmAccel, setBgmAccel] = useState(() => isBgmAccelEnabled());
  const canUseBgmAccel = hasBgmAccelUrl();
  const exclusiveMetaCategories = ['全部', '游戏', '书籍', '三次元', 'Galgame'];
  const isExclusiveMetaCategory = exclusiveMetaCategories.includes(gameSettings.metaTags[0]);

  const handleBgmAccelChange = (enabled) => {
    if (!canUseBgmAccel) return;
    setBgmAccelEnabled(enabled);
    setBgmAccel(enabled);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      // Add a small delay to allow click events to complete
      setTimeout(() => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
          setSearchResults([]);
        }
      }, 100);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced search function
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Initialize indexInputValue and fetch indexInfo if indexId exists
  useEffect(() => {
    if (gameSettings.useIndex && gameSettings.indexId) {
      setIndexInputValue(gameSettings.indexId);
      getIndexInfo(gameSettings.indexId)
        .then(info => setIndexInfo(info))
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (Array.isArray(gameSettings.useHints) && gameSettings.useHints.length > 0) {
      // Always keep 3 inputs, fill with '' if less than 3
      const arr = gameSettings.useHints.map(String);
      while (arr.length < 3) arr.push('');
      setHintInputs(arr);
    } else {
      setHintInputs(['','','']);
    }
  }, [gameSettings.useHints]);

  // Enforce commonTags to be true
  useEffect(() => {
    if (!gameSettings.commonTags) {
      onSettingsChange('commonTags', true);
    }
  }, []);

  const setIndex = async (indexId) => {
    if (!indexId) {
      onSettingsChange('useIndex', false);
      onSettingsChange('indexId', null);
      setIndexInputValue('');
      setIndexInfo(null);
      return;
    }

    try {
      const info = await getIndexInfo(indexId);
      setIndexInputValue(indexId);
      setIndexInfo(info);
      onSettingsChange('useIndex', true);
      onSettingsChange('indexId', indexId);
    } catch (error) {
      console.error('Failed to fetch index info:', error);
      if (error.message === 'Index not found') {
        alert(text.indexNotFound);
      } else {
        alert(text.importFailed);
      }
      // Reset index settings on error
      onSettingsChange('useIndex', false);
      onSettingsChange('indexId', null);
      setIndexInputValue('');
      setIndexInfo(null);
    }
  };

  const handleImport = async () => {
    if (!indexInputValue) {
      alert(text.indexRequired);
      return;
    }
    try {
      const info = await getIndexInfo(indexInputValue);
      setIndexInputValue(indexInputValue);
      setIndexInfo(info);
      onSettingsChange('useIndex', true); // 修复：确保useIndex为true
      onSettingsChange('indexId', indexInputValue);
    } catch (error) {
      console.error('Failed to fetch index info:', error);
      if (error.message === 'Index not found') {
        alert(text.indexNotFound);
      } else {
        alert(text.importFailed);
      }
      // Reset index settings on error
      onSettingsChange('useIndex', false);
      onSettingsChange('indexId', null);
      setIndexInputValue('');
      setIndexInfo(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchSubjects(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSubject = (subject) => {
    const newAddedSubjects = [
      ...gameSettings.addedSubjects,
      {
        id: subject.id,
        name: subject.name,
        name_cn: subject.name_cn,
        type: subject.type,
      }
    ];
    onSettingsChange('addedSubjects', newAddedSubjects);
    
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveSubject = (id) => {
    // Remove the subject from gameSettings
    const newAddedSubjects = gameSettings.addedSubjects.filter(subject => subject.id !== id);
    onSettingsChange('addedSubjects', newAddedSubjects);
  };

  const handleClearCache = () => {
    axiosCache.clearCache();
    alert(text.cacheCleared);
  }

  const applyPresetConfig = async (presetName) => {
    const presetConfig = getPresetConfig(presetName);
    if (!presetConfig) return;
    
    // 处理所有普通配置项
    Object.entries(presetConfig).forEach(([key, value]) => {
      if (key !== 'indexId') { // 特殊处理indexId
        onSettingsChange(key, value);
      }
    });
    
    // 特殊处理indexId，确保使用setIndex函数
    if (presetConfig.useIndex && presetConfig.indexId) {
      await setIndex(presetConfig.indexId);
    } else {
      await setIndex(""); // 清除索引
    }
  };

  // 关闭时放弃本地更改（恢复到父级传入的 gameSettings）
  const handleClose = () => {
    setLocalSettings(JSON.parse(JSON.stringify(gameSettings)));
    onClose();
  };

  // 确认时把多人模式卡片的本地改动合并进最终设置，避免父组件读到旧状态。
  const handleConfirm = () => {
    let nextSettings = gameSettings;
    if (isMultiplayer) {
      const keysToCommit = ['globalPick', 'tagBan', 'syncMode', 'nonstopMode'];
      nextSettings = { ...gameSettings };
      keysToCommit.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(localSettings, key)) {
          nextSettings[key] = localSettings[key];
        }
      });
      onSettingsChange(nextSettings);
    }
    // 在确认时触发重启（如果提供），并关闭弹窗
    if (typeof onRestart === 'function') onRestart();
    onClose(nextSettings);
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content settings-popup">
        <div className="popup-header group-header" style={{ justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex'}}>
            <h2 style={{ margin: 0 }}>{text.title}</h2>
            <div className="header-subtitle" style={{ alignSelf: 'flex-end' }}>{text.subtitle}</div>
          </div>
            <div className="header-actions">
            <button className="header-btn clear" onClick={handleClearCache} title={text.clearCache}>
              <i className="fas fa-trash"></i>
            </button>
            <button className="header-btn close" onClick={handleClose} title={text.close}>
              <i className="fas fa-xmark"></i>
            </button>
            <button className="header-btn confirm" onClick={handleConfirm} title={text.confirm}>
              <i className="fas fa-check"></i>
            </button>
            </div>
        </div>
        
        <div className="settings-popup-content">
          <div className="settings-scroll-area">
            
            {isMultiplayer && (
              <div className="settings-group multiplayer-modes-group">
                <div className="group-header">
                    <h3 className="group-title">{text.multiplayerTitle}</h3>
                    <div className="group-subtitle">{text.multiplayerSubtitle}</div>
                  </div>
                <div className="multiplayer-modes-grid">
                  {/* 角色全局BP */}
                  <div 
                    className={`mode-card ${localSettings.globalPick ? 'active mode-red' : ''}`}
                    onClick={() => setLocalSettings(s => ({ ...s, globalPick: !s.globalPick }))}
                  >
                    <span className="mode-title">{text.globalPickTitle}</span>
                    <p className="mode-desc">{text.globalPickDesc}</p>
                  </div>

                  {/* 标签全局BP */}
                  <div 
                    className={`mode-card ${localSettings.tagBan ? 'active mode-orange' : ''}`}
                    onClick={() => setLocalSettings(s => ({ ...s, tagBan: !s.tagBan }))}
                  >
                    <span className="mode-title">{text.tagBanTitle}</span>
                    <p className="mode-desc">{text.tagBanDesc}</p>
                  </div>

                  {/* 同步模式 */}
                  <div 
                    className={`mode-card ${localSettings.syncMode ? 'active mode-cyan' : ''}`}
                    onClick={() => setLocalSettings(s => ({ ...s, syncMode: !s.syncMode }))}
                  >
                    <span className="mode-title">{text.syncModeTitle}</span>
                    <p className="mode-desc">{text.syncModeDesc}</p>
                  </div>

                  {/* 血战模式 */}
                  <div 
                    className={`mode-card ${localSettings.nonstopMode ? 'active mode-pink' : ''}`}
                    onClick={() => setLocalSettings(s => ({ ...s, nonstopMode: !s.nonstopMode }))}
                  >
                    <span className="mode-title">{text.nonstopModeTitle}</span>
                    <p className="mode-desc">{text.nonstopModeDesc}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Group 1: Presets */}
            <div className="settings-group">
              <div className="group-header">
                <h3 className="group-title">{text.presetTitle}</h3>
                <div className="group-subtitle">{text.presetSubtitle}</div>
                <div className="group-header-actions">
                    <button
                    className="action-btn"
                    onClick={() => {
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameSettings, null, 2));
                        const dlAnchorElem = document.createElement('a');
                        dlAnchorElem.setAttribute("href", dataStr);
                        dlAnchorElem.setAttribute("download", "gameSettings.json");
                        document.body.appendChild(dlAnchorElem);
                        dlAnchorElem.click();
                        document.body.removeChild(dlAnchorElem);
                    }}
                    >
                    <i className="fas fa-download"></i> {text.exportConfig}
                    </button>
                    <button
                    className="action-btn"
                    onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json,application/json';
                        input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                            const imported = JSON.parse(event.target.result);
                            Object.entries(imported).forEach(([key, value]) => {
                                onSettingsChange(key, value);
                            });
                            alert(text.settingsImported);
                            } catch (err) {
                            alert(text.invalidJson);
                            }
                        };
                        reader.readAsText(file);
                        };
                        input.click();
                    }}
                    >
                    <i className="fas fa-upload"></i> {text.importConfig}
                    </button>
                </div>
              </div>
              <div className="presets-grid">
                {PRESET_KEYS.map(preset => (
                   <button 
                    key={preset}
                    className="preset-card"
                    onClick={() => {
                        if (preset === '木柜子痴') alert('😅');
                        if (text.presetMessages[preset]) alert(text.presetMessages[preset]);
                        applyPresetConfig(preset === '米哈游高手' ? '米哈游高手' : preset);
                    }}
                  >
                    {text.presets[preset] || preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Group 2: Game Rules */}
            <div className="settings-group">
              <div 
                className="group-header" 
                onClick={() => setIsGuessSettingsOpen(!isGuessSettingsOpen)}
                style={{ 
                    cursor: 'pointer', 
                    justifyContent: 'space-between',
                    marginBottom: isGuessSettingsOpen ? '16px' : '0',
                    borderBottom: isGuessSettingsOpen ? '1px solid #f0f0f0' : 'none',
                    paddingBottom: isGuessSettingsOpen ? '12px' : '0',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <h3 className="group-title">{text.guessTitle}</h3>
                    <div className="group-subtitle">{text.guessSubtitle}</div>
                </div>
                <i 
                    className="fas fa-chevron-down" 
                    style={{ 
                        transform: isGuessSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                ></i>
              </div>

              <div className={`settings-group-content ${isGuessSettingsOpen ? 'open' : ''}`}>
                <div className="settings-group-content-inner">
              {/* Row 1: Search, Rounds, Time */}
              <div className="settings-row compact-row">
                <div className="setting-item-compact">
                    <label className="settings-label" title={text.subjectSearchTitle}>{text.subjectSearch}</label>
                    <ToggleSwitch 
                      checked={gameSettings.subjectSearch}
                      onChange={(val) => onSettingsChange('subjectSearch', val)}
                    />
                </div>

                <div className="setting-item-compact">
                    <label className="settings-label" title={text.maxAttemptsTitle}  style={{ marginLeft: "58.5px" }}>{text.maxAttempts}</label>
                    <div className="compact-input-container" title={`${text.range} 1-15`}>
                        <input 
                            className="compact-input"
                            type="number"
                            value={gameSettings.maxAttempts || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    onSettingsChange('maxAttempts', '');
                                    return;
                                }
                                const num = parseInt(val);
                                if (!isNaN(num)) onSettingsChange('maxAttempts', Math.min(15, Math.max(1, num)));
                            }}
                            onBlur={() => {
                                if (!gameSettings.maxAttempts) onSettingsChange('maxAttempts', 10);
                            }}
                        />
                    </div>
                </div>

                <div className="setting-item-compact">
                    <label className="settings-label" title={text.timeLimitTitle} style={{ marginLeft: "1px" }}>{text.timeLimit}</label>
                    <div className="compact-input-container" title={`${text.range} 0, 15-120`} style={{ marginLeft: "1px" }}>
                        <input 
                            className={`compact-input ${!gameSettings.timeLimit ? 'is-disabled' : ''}`}
                            type="text"
                            value={gameSettings.timeLimit || ''}
                            placeholder="∞"
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '0') {
                                    onSettingsChange('timeLimit', null);
                                    return;
                                }
                                const num = parseInt(val);
                                if (!isNaN(num)) {
                                    onSettingsChange('timeLimit', num);
                                }
                            }}
                            onBlur={() => {
                                if (gameSettings.timeLimit) {
                                    if (gameSettings.timeLimit < 15) onSettingsChange('timeLimit', 15);
                                    if (gameSettings.timeLimit > 120) onSettingsChange('timeLimit', 120);
                                }
                            }}
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                </div>
              </div>

              {/* Row 2: Hints */}
              <div className="settings-row compact-row">
                <div className="setting-item-compact">
                    <label className="settings-label" title={text.textHintsTitle} style={{ marginLeft: "1px" }}>{text.textHints}</label>
                    {[0, 1, 2].map((idx) => (
                        <div key={idx} className="compact-input-container" title={`${text.range} 1-${gameSettings.maxAttempts || 15}`}>
                            <input
                                className={`compact-input ${(!hintInputs[idx] || hintInputs[idx] === '0') ? 'is-disabled' : ''}`}
                                type="text"
                                value={hintInputs[idx] || ''}
                                placeholder="-"
                                onChange={e => {
                                  const newInputs = [...hintInputs];
                                  let val = e.target.value;
                                  if (val === '' || val === '0') {
                                    newInputs[idx] = '';
                                  } else {
                                    if (/^\d*$/.test(val)) {
                                        let numVal = Number(val);
                                        const max = gameSettings.maxAttempts || 15;
                                        if (numVal > max) numVal = max;
                                        
                                        val = String(Math.floor(numVal));
                                        if (idx > 0 && newInputs[idx-1] && Number(val) >= Number(newInputs[idx-1])) {
                                            for (let i = idx; i < 3; i++) newInputs[i] = '';
                                        } else {
                                            newInputs[idx] = val;
                                        }
                                    }
                                  }
                                  setHintInputs(newInputs);
                                  
                                  const arr = [];
                                  for (let i = 0; i < 3; i++) {
                                    const n = parseInt(newInputs[i], 10);
                                    if (!isNaN(n) && (i === 0 || n < (arr[i-1] || 999))) {
                                      arr.push(n);
                                    } else {
                                      break;
                                    }
                                  }
                                  onSettingsChange('useHints', arr);
                                }}
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    ))}
                </div>

                <div className="setting-item-compact">
                  <label className="settings-label" title={`${text.imageHintTitle} ${text.range} 0-${gameSettings.maxAttempts || 15}`}>{text.imageHint}</label>
                  <div className="compact-input-container" title={`${text.range} 0-${gameSettings.maxAttempts || 15}`}>
                    <input 
                      className={`compact-input ${!gameSettings.useImageHint ? 'is-disabled' : ''}`}
                      type="number"
                      min="0"
                      max={gameSettings.maxAttempts || 15}
                      value={gameSettings.useImageHint || ''}
                      placeholder="-"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === '0') {
                          onSettingsChange('useImageHint', 0);
                          return;
                        }
                        const num = parseInt(val);
                        const max = gameSettings.maxAttempts || 15;
                        if (!isNaN(num)) onSettingsChange('useImageHint', Math.min(max, Math.max(0, num)));
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
              </div>
                </div>
              </div>
            </div>

            {/* Group 3: Question Scope */}
            <div className="settings-group">
              <div 
                className="group-header" 
                onClick={() => setIsAnswerSettingsOpen(!isAnswerSettingsOpen)}
                style={{ 
                    cursor: 'pointer', 
                    justifyContent: 'space-between',
                    marginBottom: isAnswerSettingsOpen ? '16px' : '0',
                    borderBottom: isAnswerSettingsOpen ? '1px solid #f0f0f0' : 'none',
                    paddingBottom: isAnswerSettingsOpen ? '12px' : '0',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <h3 className="group-title">{text.answerTitle}</h3>
                    <div className="group-subtitle">{text.answerSubtitle}</div>
                </div>
                <i 
                    className="fas fa-chevron-down" 
                    style={{ 
                        transform: isAnswerSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                ></i>
              </div>

              <div className={`settings-group-content ${isAnswerSettingsOpen ? 'open' : ''}`}>
                <div className="settings-group-content-inner">
              {/* Row 1: Subject Filter & Related Games */}
              <div className="settings-row compact-row">
                <div className="setting-item-compact" style={{ gap: '16px' }}>
                    <label className="settings-label" style={{ marginBottom: 0, whiteSpace: 'nowrap'}} title={text.subjectFilterTitle}>{text.subjectFilter}</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <select 
                          className="settings-select"
                          value={gameSettings.metaTags[0] || ''}
                          onChange={(e) => {
                            const newMetaTags = [...gameSettings.metaTags];
                            const value = e.target.value;
                            newMetaTags[0] = value;
                            if (exclusiveMetaCategories.includes(value)) {
                              newMetaTags[1] = '';
                              newMetaTags[2] = '';
                            }
                            onSettingsChange('metaTags', newMetaTags);
                          }}
                        >
                          {CATEGORY_OPTIONS.map(option => (
                            <option key={option.value || 'anime'} value={option.value}>{optionLabel(option)}</option>
                          ))}
                        </select>

                        <select 
                          className="settings-select"
                          value={gameSettings.metaTags[1] || ''}
                          disabled={isExclusiveMetaCategory}
                          onChange={(e) => {
                            const newMetaTags = [...gameSettings.metaTags];
                            newMetaTags[1] = e.target.value;
                            onSettingsChange('metaTags', newMetaTags);
                          }}
                        >
                          {SOURCE_OPTIONS.map(option => (
                            <option key={option.value || 'all-source'} value={option.value}>{optionLabel(option)}</option>
                          ))}
                        </select>

                        <select 
                          className="settings-select"
                          value={gameSettings.metaTags[2] || ''}
                          disabled={isExclusiveMetaCategory}
                          onChange={(e) => {
                            const newMetaTags = [...gameSettings.metaTags];
                            newMetaTags[2] = e.target.value;
                            onSettingsChange('metaTags', newMetaTags);
                          }}
                        >
                          {GENRE_OPTIONS.map(option => (
                            <option key={option.value || 'all-genre'} value={option.value}>{optionLabel(option)}</option>
                          ))}
                        </select>
                    </div>
                </div>
              </div>

              {/* Row 2: Year Range */}
              <div className="settings-row compact-row">
                <div className="setting-item-compact" style={{ gap: '16px' }}>
                    <label className="settings-label" title={text.unavailableWithIndex}>{text.yearRange}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div className="compact-input-container" style={{ width: '78px' }} title={`${text.range} 1800-2038`}>
                            <input 
                              className="compact-input"
                              type="number" 
                              value={gameSettings.startYear || ''}
                              onChange={(e) => {
                                const newStart = e.target.value === '' ? 1800 : parseInt(e.target.value);
                                const currentEnd = gameSettings.endYear || 2038;
                                let newEnd = currentEnd;
                                if (!isNaN(newStart) && newStart > currentEnd) {
                                  newEnd = Math.min(2038, newStart);
                                }
                                onSettingsChange('startYear', newStart);
                                if (newEnd !== currentEnd) onSettingsChange('endYear', newEnd);
                              }}
                              min="1800"
                              max="2038"
                              disabled={gameSettings.useIndex}
                            />
                        </div>
                        <span>-</span>
                        <div className="compact-input-container" style={{ width: '78px' }} title={`${text.range} 1900-2038`}>
                            <input 
                              className="compact-input"
                              type="number" 
                              value={gameSettings.endYear || ''}
                              onChange={(e) => {
                                const newEnd = e.target.value === '' ? 2038 : parseInt(e.target.value);
                                const currentStart = gameSettings.startYear || 1800;
                                let newStart = currentStart;
                                if (!isNaN(newEnd) && newEnd < currentStart) {
                                  newStart = Math.max(1800, newEnd);
                                }
                                onSettingsChange('endYear', newEnd);
                                if (newStart !== currentStart) onSettingsChange('startYear', newStart);
                              }}
                              min="1900"
                              max="2038"
                              disabled={gameSettings.useIndex}
                            />
                        </div>
                    </div>
                </div>
              </div>

              {/* Row 3: Popularity Range */}
              <div className="settings-row compact-row">
                <div className="setting-item-compact" style={{ gap: '16px' }}>
                    <label className="settings-label" title={text.popularityTitle}>{text.popularityRange}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="toggle-text-switch">
                            <span 
                                className={!gameSettings.useSubjectPerYear ? 'active' : ''} 
                                onClick={() => !gameSettings.useIndex && onSettingsChange('useSubjectPerYear', false)}
                                style={gameSettings.useIndex ? { cursor: 'not-allowed', color: '#bdbdbd' } : { cursor: 'pointer' }}
                                title={gameSettings.useIndex ? text.disabledByIndex : ''}
                            >{text.totalRank}</span>
                            <span 
                                className={gameSettings.useSubjectPerYear ? 'active' : ''} 
                                onClick={() => !gameSettings.useIndex && onSettingsChange('useSubjectPerYear', true)}
                                style={gameSettings.useIndex ? { cursor: 'not-allowed', color: '#bdbdbd' } : { cursor: 'pointer' }}
                                title={gameSettings.useIndex ? text.disabledByIndex : ''}
                            >{text.yearlyRank}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="compact-input-container" style={{ width: '60px' }} title={text.topN}>
                                <input 
                                    className="compact-input"
                                    type="number" 
                                    value={gameSettings.topNSubjects === undefined ? '' : gameSettings.topNSubjects}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? 100 : Math.max(0, parseInt(e.target.value));
                                        onSettingsChange('topNSubjects', value);
                                    }}
                                    min="0"
                                    max="1000"
                                    disabled={gameSettings.useIndex}
                                />
                            </div>
                            <span style={{ fontSize: '13px', marginLeft: '8px' }}>{text.worksUnit}</span>
                        </div>
                    </div>
                </div>
              </div>

              {/* Row 4: Character Count */}
              <div className="settings-row compact-row">
                <div className="setting-item-compact" style={{ gap: '10px', alignItems: 'center' }}>
                    <label className="settings-label"  title={text.characterCountTitle}>{text.characterCount}</label>
                    <div className="compact-input-container" title={`${text.range} >=0`} style={{ minWidth: '90px' }}>
                        <input 
                            className="compact-input"
                            type="number"
                            value={gameSettings.characterNum ?? ''}
                            placeholder={text.characterCountPlaceholder}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '0') {
                                    onSettingsChange('characterNum', 1);
                                } else {
                                    onSettingsChange('characterNum', Math.max(1, Math.min(99, parseInt(val))));
                                }
                            }}
                        />
                    </div>
                    <span style={{ fontSize: '13px', color: '#4b5563' }}>{text.mainOnly}</span>
                    <ToggleSwitch 
                        checked={gameSettings.mainCharacterOnly}
                        onChange={(val) => {
                            onSettingsChange('mainCharacterOnly', val);
                        }}
                    />
                </div>
              </div>

              {/* Row 5: Tag Count */}
              <div className="settings-row compact-row">
                <div className="setting-item-compact" style={{ gap: '16px' }}>
                    <label className="settings-label" title={text.tagCountTitle}>{text.tagCount}</label>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '13px', color: '#4b5563' }}>{text.character}</span>
                            <div className="compact-input-container" style={{ width: '50px' }} title={`${text.range} 1-10`}>
                                <input 
                                    className="compact-input"
                                    type="number"
                                    value={gameSettings.characterTagNum || ''}
                                    onChange={(e) => onSettingsChange('characterTagNum', Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '13px', color: '#4b5563' }}>{text.subject}</span>
                            <div className="compact-input-container" style={{ width: '50px' }} title={`${text.range} 1-10`}>
                                <input 
                                    className="compact-input"
                                    type="number"
                                    value={gameSettings.subjectTagNum || ''}
                                    onChange={(e) => onSettingsChange('subjectTagNum', Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                                />
                            </div>
                        </div>
                    </div>
                </div>
              </div>

              {/* Row 6: Catalog & Extra Subjects */}
              <div className="settings-row compact-row" style={{ alignItems: 'center' }}>
                <div className="setting-item-compact" style={{ gap: '16px' }}>
                    <label className="settings-label"  title={text.useIndexTitle}>{text.useIndex}</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'left' }}>
                        <div className="compact-input-container">
                            <input 
                                className="compact-input"
                                type="text"
                                value={indexInputValue}
                                placeholder={text.indexId}
                                onChange={(e) => setIndexInputValue(e.target.value)}
                            />
                        </div>
                        <button className="action-btn" onClick={handleImport} style={{ padding: '6px 12px', height: '32px' }}>{text.import}</button>
                    </div>
                </div>

                <div className="setting-item-compact offset-lg" style={{ flex: 1, gap: '16px' }}>
                    <label className="settings-label" style={{ whiteSpace: 'nowrap' }}>{text.extraSubjects}</label>
                    <div className="search-container-compact" ref={searchContainerRef} >
                            <input 
                                className="large-input"
                                type="text"
                                style={{ width: '214px' }}
                                placeholder={text.searchSubjects}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch();
                                }}
                            />
                        {(isSearching || searchResults.length > 0) && (
                            <div className="search-results-list">
                                {isSearching && <div className="search-result-item">{text.searching}</div>}
                                {!isSearching && searchResults.map((subject) => (
                                <div 
                                    key={subject.id} 
                                    className="search-result-item"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAddSubject(subject);
                                    }}
                                >
                                    <span className="result-title">{subject.name}</span>
                                    <span className="result-meta">
                                      {locale === 'en'
                                        ? getSubjectTypeLabel(subject.type)
                                        : `${subject.name_cn || ''} (${getSubjectTypeLabel(subject.type)})`}
                                    </span>
                                </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
              </div>

              {/* Combined Display Area */}
              {(gameSettings.useIndex || gameSettings.addedSubjects.length > 0) && (
                  <div className="combined-display-area">
                      {gameSettings.useIndex && indexInfo && (
                          <div className="catalog-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <a
                              href={`https://bangumi.tv/index/${gameSettings.indexId}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 500 }}
                            >
                              {indexInfo.title}
                            </a>
                            <span style={{ color: '#888' }}>{text.totalWorks(indexInfo.total)}</span>
                            <button
                              className="tag-remove-btn"
                              title={text.removeIndex}
                              onClick={() => { onSettingsChange('useIndex', false); onSettingsChange('indexId', ''); }}
                            >×</button>
                          </div>
                      )}
                      
                      {gameSettings.addedSubjects.length > 0 && (
                          <div className="extra-subjects-list">
                              {gameSettings.addedSubjects.map((subject) => (
                                  <div key={subject.id} className="subject-tag-large">
                                      <a href={`https://bangumi.tv/subject/${subject.id}`} target="_blank" rel="noopener noreferrer">{subject.name}</a>
                                      <button 
                                          className="tag-remove-btn"
                                          onClick={() => handleRemoveSubject(subject.id)}
                                      >
                                          ×
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}
                </div>
              </div>
            </div>

            {canUseBgmAccel && (
              <div className="settings-group">
                <div className="settings-row compact-row">
                  <div className="setting-item-compact">
                    <label
                      className="settings-label"
                      title={text.bgmAccelTitle}
                    >
                      {text.bgmAccel}
                    </label>
                    <ToggleSwitch
                      checked={bgmAccel}
                      onChange={handleBgmAccelChange}
                    />
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>{text.bgmAccelNote}</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {isMultiplayer && !hideRestart && (
          <div className="popup-footer-new">
              <div className="footer-left">
                <span className="footer-hint">{text.footerHint}</span>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPopup;
