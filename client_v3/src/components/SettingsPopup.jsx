import '../styles/popups.css';
import { getIndexInfo, searchSubjects } from '../utils/anime';
import { useState, useEffect, useRef } from 'react';
import axiosCache from '../utils/cached-axios';

function SettingsPopup({ gameSettings, onSettingsChange, onClose, onRestart, hideRestart = false }) {
  const [indexInputValue, setIndexInputValue] = useState('');
  const [indexInfo, setIndexInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef(null);

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
        alert('目录不存在或者FIFA了');
      } else {
        alert('导入失败，请稍后重试');
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
      alert('请输入目录ID');
      return;
    }
    try {
      const info = await getIndexInfo(indexInputValue);
      setIndexInputValue(indexInputValue);
      setIndexInfo(info);
      onSettingsChange('indexId', indexInputValue);
    } catch (error) {
      console.error('Failed to fetch index info:', error);
      if (error.message === 'Index not found') {
        alert('目录不存在或者FIFA了');
      } else {
        alert('导入失败，请稍后重试');
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
    const newAddedSubjects = [...gameSettings.addedSubjects, subject];
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
    alert('缓存已清空！');
  }

  return (
    <div className="popup-overlay">
      <div className="popup-content">
       {hideRestart ? (
          <button className="popup-close multiplayer-confirm" onClick={onClose}>确认修改</button>
        ) : (
          <button className="popup-close" onClick={onClose}>×</button>
        )}
        <div className="popup-header">
          <h2>设置</h2>
        </div>
        <div className="popup-body">
          <div className="settings-content">
            <div className="settings-section">
              <h3>预设</h3>
              <div className="presets-buttons">
                <button 
                  className="preset-button"
                  onClick={async () => {
                    onSettingsChange('startYear', new Date().getFullYear()-5);
                    onSettingsChange('endYear', new Date().getFullYear());
                    onSettingsChange('topNSubjects', 20);
                    onSettingsChange('useSubjectPerYear', false);
                    onSettingsChange('metaTags', ["", "", ""]);
                    onSettingsChange('useIndex', false);
                    onSettingsChange('addedSubjects', []);
                    onSettingsChange('mainCharacterOnly', true);
                    onSettingsChange('characterNum', 3);
                    onSettingsChange('maxAttempts', 10);
                    await setIndex("");
                    onSettingsChange('enableHints', true);
                    onSettingsChange('includeGame', false);
                    onSettingsChange('subjectSearch', true);
                    onSettingsChange('subjectTagNum', 8);
                    onSettingsChange('characterTagNum', 6);
                  }}
                >
                  入门
                </button>
                <button 
                  className="preset-button"
                  onClick={async () => {
                    onSettingsChange('startYear', new Date().getFullYear()-20);
                    onSettingsChange('endYear', new Date().getFullYear());
                    onSettingsChange('topNSubjects', 5);
                    onSettingsChange('useSubjectPerYear', true);
                    onSettingsChange('metaTags', ["", "", ""]);
                    onSettingsChange('useIndex', false);
                    onSettingsChange('addedSubjects', []);
                    onSettingsChange('mainCharacterOnly', false);
                    onSettingsChange('characterNum', 6);
                    onSettingsChange('maxAttempts', 10);
                    await setIndex("");
                    onSettingsChange('enableHints', false);
                    onSettingsChange('includeGame', false);
                    onSettingsChange('subjectSearch', false);
                    onSettingsChange('subjectTagNum', 8);
                    onSettingsChange('characterTagNum', 6);
                  }}
                >
                  冻鳗高手
                </button>
                <button 
                  className="preset-button"
                  onClick={async () => {
                    onSettingsChange('startYear', 2000);
                    onSettingsChange('endYear', 2015);
                    onSettingsChange('topNSubjects', 5);
                    onSettingsChange('useSubjectPerYear', true);
                    onSettingsChange('metaTags', ["", "", ""]);
                    onSettingsChange('useIndex', false);
                    onSettingsChange('addedSubjects', []);
                    onSettingsChange('mainCharacterOnly', true);
                    onSettingsChange('characterNum', 6);
                    onSettingsChange('maxAttempts', 10);
                    await setIndex("");
                    onSettingsChange('enableHints', false);
                    onSettingsChange('includeGame', false);
                    onSettingsChange('subjectSearch', false);
                    onSettingsChange('subjectTagNum', 8);
                    onSettingsChange('characterTagNum', 6);
                  }}
                >
                  老番享受者
                </button>
                <button 
                  className="preset-button"
                  onClick={async () => {
                    onSettingsChange('startYear', 2005);
                    onSettingsChange('endYear', new Date().getFullYear());
                    onSettingsChange('topNSubjects', 75);
                    onSettingsChange('useSubjectPerYear', false);
                    onSettingsChange('metaTags', ["", "", ""]);
                    onSettingsChange('addedSubjects', []);
                    onSettingsChange('mainCharacterOnly', true);
                    onSettingsChange('characterNum', 10);
                    onSettingsChange('maxAttempts', 7);
                    await setIndex("");
                    onSettingsChange('enableHints', false);
                    onSettingsChange('includeGame', false);
                    onSettingsChange('subjectSearch', true);
                    onSettingsChange('subjectTagNum', 8);
                    onSettingsChange('characterTagNum', 5);
                  }}
                >
                  瓶子严选
                </button>
                <button 
                  className="preset-button"
                  onClick={async () => {
                    alert('😅');
                    onSettingsChange('startYear', new Date().getFullYear()-10);
                    onSettingsChange('endYear', new Date().getFullYear());
                    onSettingsChange('topNSubjects', 50);
                    onSettingsChange('useSubjectPerYear', false);
                    onSettingsChange('metaTags', ["", "", ""]);
                    onSettingsChange('addedSubjects', []);
                    onSettingsChange('mainCharacterOnly', true);
                    onSettingsChange('characterNum', 6);
                    onSettingsChange('maxAttempts', 10);
                    await setIndex("75522");
                    onSettingsChange('enableHints', false);
                    onSettingsChange('includeGame', false);
                    onSettingsChange('subjectSearch', false);
                    onSettingsChange('subjectTagNum', 8);
                    onSettingsChange('characterTagNum', 6);
                  }}
                >
                  木柜子痴
                </button>
                <button 
                  className="preset-button"
                  onClick={async () => {
                    alert('那很有生活了😅');
                    onSettingsChange('startYear', new Date().getFullYear()-10);
                    onSettingsChange('endYear', new Date().getFullYear());
                    onSettingsChange('topNSubjects', 50);
                    onSettingsChange('useSubjectPerYear', false);
                    onSettingsChange('metaTags', ["", "", ""]);
                    onSettingsChange('addedSubjects', []);
                    onSettingsChange('mainCharacterOnly', false);
                    onSettingsChange('characterNum', 10);
                    onSettingsChange('maxAttempts', 10);
                    await setIndex("75442");
                    onSettingsChange('enableHints', false);
                    onSettingsChange('includeGame', true);
                    onSettingsChange('subjectSearch', false);
                    onSettingsChange('subjectTagNum', 3);
                    onSettingsChange('characterTagNum', 6);
                  }}
                >
                  二游高手+
                </button>
                
              </div>
            </div>

            <div className="settings-section">
              <h3>范围设置</h3>
              
              <div className="settings-subsection">
                <div className="settings-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label>时间：</label>
                  <input 
                    type="number" 
                    value={gameSettings.startYear || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 1900 : parseInt(e.target.value);
                      onSettingsChange('startYear', value);
                    }}
                    min="1900"
                    max="2100"
                    disabled={gameSettings.useIndex}
                  />
                  <span>-</span>
                  <input 
                    type="number" 
                    value={gameSettings.endYear || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 2100 : parseInt(e.target.value);
                      onSettingsChange('endYear', value);
                    }}
                    min="1900"
                    max="2100"
                    disabled={gameSettings.useIndex}
                  />
                  <div style={{ marginLeft: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label>关联游戏条目</label>
                    <span className="tooltip-trigger">
                      ?
                      <span className="tooltip-text">
                        计算登场作品（年份、分数）时会包括游戏。<br/>
                        但是，答案角色还是只会从动画中选取，因为游戏的热度榜有bug。<br/>
                        如果想要猜游戏角色，可以自创一个目录或者添加额外作品。
                      </span>
                    </span>
                    <input 
                      type="checkbox"
                      checked={gameSettings.includeGame}
                      onChange={(e) => {
                        onSettingsChange('includeGame', e.target.checked);
                      }}
                      style={{ marginRight: '50px', marginLeft: '0px' }}
                    />
                  </div>
                </div>
                <div className="filter-row">
                  <div className="filter-item">
                    <label>分类：</label>
                    <select 
                      className="settings-select"
                      value={gameSettings.metaTags[0] || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const newMetaTags = [...gameSettings.metaTags];
                        newMetaTags[0] = value;
                        onSettingsChange('metaTags', newMetaTags);
                      }}
                      // disabled={gameSettings.useIndex}
                    >
                      <option value="">全部</option>
                      <option value="TV">TV</option>
                      <option value="WEB">WEB</option>
                      <option value="OVA">OVA</option>
                      <option value="剧场版">剧场版</option>
                      <option value="动态漫画">动态漫画</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="filter-item">
                    <label>来源：</label>
                    <select 
                      className="settings-select"
                      value={gameSettings.metaTags[1] || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const newMetaTags = [...gameSettings.metaTags];
                        newMetaTags[1] = value;
                        onSettingsChange('metaTags', newMetaTags);
                      }}
                      // disabled={gameSettings.useIndex}
                    >
                      <option value="">全部</option>
                      <option value="原创">原创</option>
                      <option value="漫画改">漫画改</option>
                      <option value="游戏改">游戏改</option>
                      <option value="小说改">小说改</option>
                    </select>
                  </div>
                  <div className="filter-item">
                    <label>类型：</label>
                    <select 
                      className="settings-select"
                      value={gameSettings.metaTags[2] || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const newMetaTags = [...gameSettings.metaTags];
                        newMetaTags[2] = value;
                        onSettingsChange('metaTags', newMetaTags);
                      }}
                      // disabled={gameSettings.useIndex}
                    >
                      <option value="">全部</option>
                      <option value="科幻">科幻</option>
                      <option value="喜剧">喜剧</option>
                      <option value="百合">百合</option>
                      <option value="校园">校园</option>
                      <option value="惊悚">惊悚</option>
                      <option value="后宫">后宫</option>
                      <option value="机战">机战</option>
                      <option value="悬疑">悬疑</option>
                      <option value="恋爱">恋爱</option>
                      <option value="奇幻">奇幻</option>
                      <option value="推理">推理</option>
                      <option value="运动">运动</option>
                      <option value="耽美">耽美</option>
                      <option value="音乐">音乐</option>
                      <option value="战斗">战斗</option>
                      <option value="冒险">冒险</option>
                      <option value="萌系">萌系</option>
                      <option value="穿越">穿越</option>
                      <option value="玄幻">玄幻</option>
                      <option value="乙女">乙女</option>
                      <option value="恐怖">恐怖</option>
                      <option value="历史">历史</option>
                      <option value="日常">日常</option>
                      <option value="剧情">剧情</option>
                      <option value="武侠">武侠</option>
                      <option value="美食">美食</option>
                      <option value="职场">职场</option>
                    </select>
                  </div>
                  <span className="tooltip-trigger">
                    ?
                    <span className="tooltip-text">
                      这行选项同时会影响登场作品的信息<br/>
                      比如不想让剧场版计入登场数据，可以只勾选"TV"。<br/>
                      当"使用目录"生效时，这行选项不会影响正确答案的抽取，只会影响表格内显示的信息。
                    </span>
                  </span>
                </div>
                <div className="settings-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label>Bangumi热度排行榜{gameSettings.useSubjectPerYear ? '每年' : '共计'}</label>
                  <input 
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
                  <label>部</label>
                  <div style={{ marginLeft: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="toggle-switch-container" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <label style={{ marginRight: '8px', color: !gameSettings.useSubjectPerYear ? '#1890ff' : '#666' }}>总作品数</label>
                      <div 
                        className="toggle-switch" 
                        style={{
                          width: '40px',
                          height: '20px',
                          backgroundColor: gameSettings.useSubjectPerYear ? '#1890ff' : '#ccc',
                          borderRadius: '10px',
                          position: 'relative',
                          cursor: gameSettings.useIndex ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.3s',
                        }}
                        onClick={() => !gameSettings.useIndex && onSettingsChange('useSubjectPerYear', !gameSettings.useSubjectPerYear)}
                      >
                        <div 
                          style={{
                            width: '16px',
                            height: '16px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: gameSettings.useSubjectPerYear ? '22px' : '2px',
                            transition: 'left 0.3s',
                          }}
                        />
                      </div>
                      <label style={{ marginLeft: '8px', color: gameSettings.useSubjectPerYear ? '#1890ff' : '#666' }}>每年作品数</label>
                      <span className="tooltip-trigger">
                        ?
                        <span className="tooltip-text">
                          启用时会先抽取某一年份，再从中抽取作品。<br/>
                          削弱了新番热度的影响。<br/>利好老二次元！
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="settings-row">
                  <label>使用目录</label>
                  <span className="tooltip-trigger">
                    ?
                    <span className="tooltip-text">
                      勾选时，正确答案只会从目录（+额外作品）中抽取。
                    </span>
                  </span>
                  <input 
                    type="checkbox"
                    checked={gameSettings.useIndex}
                    onChange={(e) => {
                      onSettingsChange('useIndex', e.target.checked);
                      if (!e.target.checked) {
                        // Reset when disabling index
                        onSettingsChange('metaTags', ["", "", ""]);
                        onSettingsChange('addedSubjects', []);
                        onSettingsChange('indexId', null);
                        setIndexInfo(null);
                        setIndexInputValue('');
                      }
                    }}
                    style={{ marginRight: '50px', marginLeft: '0px' }}
                  />
                  {gameSettings.useIndex && (
                    <>
                      <div className="settings-row">
                        <div className="index-input-group">
                          <span className="index-prefix">https://bangumi.tv/index/</span>
                          <input 
                            type="text"
                            value={indexInputValue}
                            onChange={(e) => {
                              setIndexInputValue(e.target.value);
                            }}
                          />
                          <button className="import-button" onClick={handleImport}>导入</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {gameSettings.useIndex && indexInfo && (
                  <div className="settings-row index-info">
                    <div className="index-info-content">
                      <span className="index-title">{indexInfo.title}</span>
                      <span className="index-total">共 {indexInfo.total} 部作品</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-subsection">
                <h4>添加额外作品</h4>
                <div className="settings-row">
                  <div className="search-box" ref={searchContainerRef}>
                    <input 
                      type="text"
                      placeholder="搜索作品..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                    />
                    <button 
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || isSearching}
                    >
                      {isSearching ? '搜索中...' : '搜索'}
                    </button>
                  </div>
                </div>
                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((subject) => (
                      <div 
                        key={subject.id} 
                        className="search-result-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddSubject(subject);
                        }}
                      >
                        <span className="subject-title">{subject.name}</span>
                        <span className="subject-meta">{subject.name_cn || ''}</span>
                        <span className="subject-type">{subject.type}</span>
                      </div>
                    ))}
                  </div>
                )}
                {gameSettings.addedSubjects.length > 0 && (
                  <div className="added-subjects">
                    <h5>已添加的作品</h5>
                    {gameSettings.addedSubjects.map((subject) => (
                      <div key={subject.id} className="added-subject-item">
                        <div className="subject-info">
                          <span className="subject-title">{subject.name}</span>
                          <span className="subject-meta">{subject.name_cn || ''}（{subject.type}）</span>
                        </div>
                        <button 
                          className="remove-button"
                          onClick={() => handleRemoveSubject(subject.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="settings-subsection">
                <div className="settings-row">
                  <label>仅主角：</label>
                  <input 
                    type="checkbox"
                    checked={gameSettings.mainCharacterOnly}
                    onChange={(e) => {
                      onSettingsChange('mainCharacterOnly', e.target.checked);
                    }}
                    style={{ marginRight: '50px', marginLeft: '0px' }}
                  />
                </div>
                {!gameSettings.mainCharacterOnly && (
                  <div className="settings-row">
                    <label>每个作品的角色数：</label>
                    <input 
                      type="number"
                      value={gameSettings.characterNum || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 1 : parseInt(e.target.value);
                        onSettingsChange('characterNum', value);
                      }}
                      min="1"
                      max="10"
                    />
                  </div>
                )}
                <div className="settings-row">
                  <label>角色标签数：</label>
                  <input 
                    type="number"
                    value={gameSettings.characterTagNum || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                      onSettingsChange('characterTagNum', value);
                    }}
                    min="0"
                    max="10"
                  />
                </div>
                <div className="settings-row">
                  <label>作品标签数：</label>
                  <input 
                    type="number"
                    value={gameSettings.subjectTagNum || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                      onSettingsChange('subjectTagNum', value);
                    }}
                    min="0"
                    max="10"
                  />
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>游戏设置</h3>
              <div className="settings-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label>作品搜索</label>
                <input 
                  type="checkbox"
                  checked={gameSettings.subjectSearch}
                  onChange={(e) => {
                    onSettingsChange('subjectSearch', e.target.checked);
                  }}
                  style={{ marginRight: '50px', marginLeft: '0px' }}
                />
                <label>启用提示</label>
                <input 
                  type="checkbox"
                  checked={gameSettings.enableHints}
                  onChange={(e) => {
                    onSettingsChange('enableHints', e.target.checked);
                  }}
                  style={{ marginRight: '50px', marginLeft: '0px' }}
                />
                <label>主播模式</label>
                <span className="tooltip-trigger">
                  ?
                  <span className="tooltip-text">
                    tag {'=>'} tag.replace('乳', 'R')
                  </span>
                </span>
                <input 
                  type="checkbox"
                  checked={gameSettings.enableTagCensor}
                  onChange={(e) => {
                    onSettingsChange('enableTagCensor', e.target.checked);
                  }}
                  style={{ marginRight: '50px', marginLeft: '0px' }}
                />
              </div>
              <div className="settings-row">
                <label>每局次数：</label>
                <input 
                  type="number"
                  value={gameSettings.maxAttempts || ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 10 : Math.max(5, Math.min(15, parseInt(e.target.value) || 5));
                    onSettingsChange('maxAttempts', value);
                  }}
                  min="5"
                  max="15"
                />
              </div>

              <div className="settings-row">
                <label>*时间限制：</label>
                <input
                  type="checkbox"
                  checked={gameSettings.timeLimit !== null}
                  onChange={(e) => onSettingsChange('timeLimit', e.target.checked ? 60 : null)}
                  style={{ marginRight: '50px', marginLeft: '0px' }}
                />
                {gameSettings.timeLimit !== null && (
                  <div className="settings-row">
                    <input
                      type="number"
                      min="30"
                      max="120"
                      value={gameSettings.timeLimit}
                      onChange={(e) => {
                        const value = Math.max(30, Math.min(120, parseInt(e.target.value) || 30));
                        onSettingsChange('timeLimit', value);
                      }}
                    />
                    <label>秒/轮</label>
                  </div>
                )}
              </div>
              <div className="settings-row">
                <label>（带*的功能可能有bug）</label>
              </div>
              
            </div>
          </div>
        </div>
        <div className="popup-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!hideRestart && (
            <>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button className="restart-button" onClick={onRestart} style={{ marginRight: '10px' }}>
                  重新开始
                </button>
                <label style={{ fontSize: '0.8rem' }}>*设置改动点了才会生效！否则下一把生效</label>
              </div>
              <button className="clear-cache-button" onClick={handleClearCache}>
                清空缓存
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPopup; 
