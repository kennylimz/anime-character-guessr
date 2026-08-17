import { useRef, useState, useEffect } from 'react';
import axios from '../utils/cached-axios';
import { fixImageUrl } from '../utils/imageUrl.js';
import { searchSubjects, getCharactersBySubjectId, getCharacterDetails } from '../utils/bangumi';
import '../styles/search.css';
import { submitGuessCharacterCount } from '../utils/db';
import { getBgmApiUrl } from '../utils/bgmApi.js';

const SEARCH_TEXT = {
  zh: {
    searchCharacters: '搜索想猜的角色...',
    searchSubjects: '搜索想猜的作品...',
    searching: '搜索中...',
    loadingCharacters: '加载角色中...',
    noImage: '无图片',
    back: '返回',
    loadingMore: '加载中...',
    more: '更多',
    searchingButton: '在搜了...',
    guessingButton: '在猜了...',
    characterButton: '搜角色',
    subjectButton: '搜作品',
    subjectDisabledTip: '搜作品已被关闭，如需使用请前往设置更改'
  },
  en: {
    searchCharacters: 'Search characters...',
    searchSubjects: 'Search works...',
    searching: 'Searching...',
    loadingCharacters: 'Loading characters...',
    noImage: 'No image',
    back: 'Back',
    loadingMore: 'Loading...',
    more: 'More',
    searchingButton: 'Searching...',
    guessingButton: 'Guessing...',
    characterButton: 'Char',
    subjectButton: 'Work',
    subjectDisabledTip: 'Subject search is disabled. Go to Settings to change.'
  }
};

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

function SearchBar({ onCharacterSelect, isGuessing, gameEnd, subjectSearch, gameSettings, finishInit = true, locale = 'zh', placeholder }) {
  const text = SEARCH_TEXT[locale] || SEARCH_TEXT.zh;
  const getSubjectTypeLabel = (type) => SUBJECT_TYPE_LABELS[locale]?.[type] || type;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchMode, setSearchMode] = useState('character'); // 'character' or 'subject'
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1); // 当前键盘选中的项目索引
  const [isLoadingNewResults, setIsLoadingNewResults] = useState(false); // 标记是否正在加载更多结果
  const [showSubjectTip, setShowSubjectTip] = useState(false);

  const handleDisabledSubjectClick = (e) => {
    if (e) e.preventDefault();
    setShowSubjectTip(true);
    setTimeout(() => setShowSubjectTip(false), 2500);
  };
  
  // DOM引用
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const selectedItemRef = useRef(null);
  
  const INITIAL_LIMIT = 10;
  const MORE_LIMIT = 5;

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setSearchResults([]);
        setOffset(0);
        setHasMore(true);
        setSelectedSubject(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 快捷键聚焦搜索框（按空格键）
  useEffect(() => {
    function handleKeyDown(e) {
      // 当用户按下空格键且不在输入框中时，聚焦到搜索输入框
      if (e.key === ' ' && document.activeElement.tagName !== 'INPUT' && 
          document.activeElement.tagName !== 'TEXTAREA' && !isGuessing && !gameEnd && finishInit) {
        e.preventDefault();
        searchInputRef.current.focus();
      }
    }
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGuessing, gameEnd, finishInit]);

  // 自动滚动，确保选中项在视图中可见
  useEffect(() => {
    if (selectedItemIndex >= 0 && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth', 
        block: 'nearest'
      });
    }
  }, [selectedItemIndex]);

  // 键盘导航处理
  useEffect(() => {
    function handleKeyboardNavigation(e) {
      // 只在搜索结果存在且搜索框聚焦时处理键盘导航
      if (searchResults.length === 0 || document.activeElement !== searchInputRef.current) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedItemIndex(prevIndex => {
            const maxIndex = searchMode === 'character' && hasMore ? 
              searchResults.length : searchResults.length - 1;
            // 不再循环到顶部，如果已经到底部就保持在底部
            return prevIndex < maxIndex ? prevIndex + 1 : maxIndex;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedItemIndex(prevIndex => 
            // 不再循环到底部，如果已经到顶部就保持在顶部
            prevIndex > 0 ? prevIndex - 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedItemIndex === -1) {
            return;
          }
          
          if (searchMode === 'subject' && !selectedSubject) {
            // 如果在作品搜索模式且选择的是作品
            if (selectedItemIndex < searchResults.length) {
              handleSubjectSelect(searchResults[selectedItemIndex]);
            }
          } else if (selectedItemIndex === searchResults.length && hasMore && searchMode === 'character') {
            // 如果选择的是"加载更多"
            setIsLoadingNewResults(true); // 标记正在加载更多结果
            handleLoadMore();
          } else if (selectedItemIndex < searchResults.length) {
            // 如果选择的是角色
            handleCharacterSelect(searchResults[selectedItemIndex]);
          }
          break;
        default:
          break;
      }
    }

    document.addEventListener('keydown', handleKeyboardNavigation);
    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation);
    };
  }, [searchResults, selectedItemIndex, searchMode, hasMore, selectedSubject]);

  // 当搜索结果变化时，处理选中索引的重置或保持
  useEffect(() => {
    // 如果是加载更多的情况，将选中索引设置到新加载内容的第一项
    if (isLoadingNewResults) {
      const previousLength = selectedItemIndex; // 之前选中的是"加载更多"，其索引等于之前结果的长度
      setSelectedItemIndex(previousLength); // 设置到新内容的第一项
      setIsLoadingNewResults(false);
    } else {
      // 正常情况下重置选中索引
      setSelectedItemIndex(-1);
    }
  }, [searchResults]);

  // Reset pagination when search query changes
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    setSearchResults([]);
    setSelectedSubject(null);
  }, [searchQuery]);

  // Force character search mode when subjectSearch is false
  useEffect(() => {
    if (!subjectSearch && searchMode === 'subject') {
      setSearchMode('character');
      setSearchResults([]);
      setOffset(0);
      setHasMore(true);
      setSelectedSubject(null);
    }
  }, [subjectSearch]);

  // Debounced search function for character search only
  useEffect(() => {
    if (searchMode !== 'character') return;
    
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        setOffset(0);
        setHasMore(true);
        handleSearch(true);
      } else {
        setSearchResults([]);
        setOffset(0);
        setHasMore(true);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchMode]);

  const handleSearch = async (reset = false) => {
    if (!searchQuery.trim() || !finishInit) return;
    
    // Always use initial search parameters when reset is true
    const currentLimit = reset ? INITIAL_LIMIT : MORE_LIMIT;
    const currentOffset = reset ? 0 : offset;
    const loadingState = reset ? setIsSearching : setIsLoadingMore;
    
    loadingState(true);
    try {
      const response = await axios.post(
        `${getBgmApiUrl()}/v0/search/characters?limit=${currentLimit}&offset=${currentOffset}`,
        {
          keyword: searchQuery.trim()
        }
      );
      
      const newResults = response.data.data.map(character => ({
        id: character.id,
        image: fixImageUrl(character.images?.grid || null),
        name: character.name,
        nameCn: character.infobox.find(item => item.key === "简体中文名")?.value || character.name,
        nameEn: (() => {
          const aliases = character.infobox.find(item => item.key === '别名')?.value;
          if (aliases && Array.isArray(aliases)) {
            const englishName = aliases.find(alias => alias.k === '英文名');
            if (englishName) {
              return englishName.v;
            } else {
              const romaji = aliases.find(alias => alias.k === '罗马字');
              if (romaji) {
                return romaji.v;
              }
            }
          }
          return character.name;
        })(),
        gender: character.gender || '?',
        popularity: character.stat.collects+character.stat.comments
      }));

      if (reset) {
        setSearchResults(newResults);
        setOffset(INITIAL_LIMIT);
      } else {
        setSearchResults(prev => [...prev, ...newResults]);
        setOffset(currentOffset + MORE_LIMIT);
      }
      
      setHasMore(newResults.length === currentLimit);
    } catch (error) {
      console.error('Search failed:', error);
      if (reset) {
        setSearchResults([]);
      }
    } finally {
      loadingState(false);
    }
  };

  const handleSubjectSearch = async () => {
    if (!searchQuery.trim() || !finishInit) return;
    setIsSearching(true);
    try {
      const results = await searchSubjects(searchQuery, gameSettings);
      setSearchResults(results);
      setHasMore(false);
    } catch (error) {
      console.error('Subject search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubjectSelect = async (subject) => {
    setIsSearching(true);
    setSelectedSubject(subject);
    try {
      const characters = await getCharactersBySubjectId(subject.id);
      const formattedCharacters = await Promise.all(characters.map(async character => {
        const details = await getCharacterDetails(character.id);
        return {
          id: character.id,
          image: fixImageUrl(character.images?.grid),
          name: character.name,
          nameCn: details.nameCn,
          nameEn: details.nameEn,
          gender: details.gender,
          popularity: details.popularity
        };
      }));
      setSearchResults(formattedCharacters);
    } catch (error) {
      console.error('Failed to fetch characters:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = () => {
    if (searchMode === 'character') {
      handleSearch(false);
    }
  };

  const handleCharacterSelect = (character) => {
    if (!finishInit) return;
    submitGuessCharacterCount(character.id, character.nameCn || character.name);
    onCharacterSelect(character);
    setSearchQuery('');
    setSearchResults([]);
    setOffset(0);
    setHasMore(true);
    setSelectedSubject(null);
    setSearchMode('character');
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) return null;

    if (searchMode === 'subject' && !selectedSubject) {
      return (
        <div className="search-dropdown" ref={searchDropdownRef}>
          {isSearching ? (
            <div className="search-loading">{text.searching}</div>
          ) : (
            searchResults.map((subject, index) => (
              <div
                key={subject.id}
                className={`search-result-item ${selectedItemIndex === index ? 'selected' : ''}`}
                onClick={() => handleSubjectSelect(subject)}
                ref={selectedItemIndex === index ? selectedItemRef : null}
              >
                {subject.image ? (
                  <img 
                    src={subject.image} 
                    alt={subject.name} 
                    className="result-character-icon"
                  />
                ) : (
                  <div className="result-character-icon no-image">
                    {text.noImage}
                  </div>
                )}
                <div className="result-character-info">
                  <div className="result-character-name">{subject.name}</div>
                  {locale !== 'en' && (
                    <div className="result-character-name-cn">{subject.name_cn}</div>
                  )}
                  <div className="result-subject-type">{getSubjectTypeLabel(subject.type)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    return (
      <div className="search-dropdown" ref={searchDropdownRef}>
        {selectedSubject && (
          <div className="selected-subject-header">
            <span>{locale === 'en' ? selectedSubject.name : (selectedSubject.name_cn || selectedSubject.name)}</span>
            <button 
              className="back-to-subjects"
              onClick={() => {
                setSelectedSubject(null);
                handleSubjectSearch();
              }}
            >
              {text.back}
            </button>
          </div>
        )}
        {isSearching ? (
          <div className="search-loading">{text.loadingCharacters}</div>
        ) : (
          <>
            {searchResults.map((character, index) => (
              <div
                key={character.id}
                className={`search-result-item ${selectedItemIndex === index ? 'selected' : ''}`}
                onClick={() => handleCharacterSelect(character)}
                ref={selectedItemIndex === index ? selectedItemRef : null}
              >
                {character.image ? (
                  <img 
                    src={character.image} 
                    alt={character.name} 
                    className="result-character-icon"
                  />
                ) : (
                  <div className="result-character-icon no-image">
                    {text.noImage}
                  </div>
                )}
                <div className="result-character-info">
                  <div className="result-character-name" translate="no">{character.name}</div>
                  <div
                    className="result-character-name-cn"
                    translate={locale === 'en' && character.nameEn && character.nameEn !== character.nameCn ? 'no' : undefined}
                  >
                    {locale === 'en' ? (character.nameEn || character.nameCn) : character.nameCn}
                  </div>
                </div>
              </div>
            ))}
            {hasMore && searchMode === 'character' && (
              <div 
                className={`search-result-item load-more ${selectedItemIndex === searchResults.length ? 'selected' : ''}`}
                onClick={handleLoadMore}
                ref={selectedItemIndex === searchResults.length ? selectedItemRef : null}
              >
                {isLoadingMore ? text.loadingMore : text.more}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="search-section">
      <div className="search-box">
        <div className="search-input-container" ref={searchContainerRef}>
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isGuessing || gameEnd || !finishInit}
            placeholder={searchMode === 'character' ? (placeholder || text.searchCharacters) : text.searchSubjects}
            ref={searchInputRef}
          />
          {renderSearchResults()}
        </div>
        <button 
          className={`search-button ${searchMode === 'character' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('character');
            if (searchQuery.trim()) handleSearch(true);
          }}
          disabled={!searchQuery.trim() || isSearching || isGuessing || gameEnd || !finishInit}
        >
          {isSearching && searchMode === 'character' ? text.searchingButton : isGuessing ? text.guessingButton : text.characterButton}
        </button>
        <div 
          className="subject-search-wrapper"
          onMouseEnter={() => { if (!subjectSearch) setShowSubjectTip(true); }}
          onMouseLeave={() => { if (!subjectSearch) setShowSubjectTip(false); }}
          onClick={!subjectSearch ? handleDisabledSubjectClick : undefined}
        >
          {showSubjectTip && !subjectSearch && (
            <div className="subject-disabled-tooltip">
              {text.subjectDisabledTip}
            </div>
          )}
          <button 
            className={`search-button ${searchMode === 'subject' ? 'active' : ''} ${!subjectSearch ? 'disabled-mode' : ''}`}
            onClick={() => {
              if (!subjectSearch) return;
              setSearchMode('subject');
              if (searchQuery.trim()) handleSubjectSearch();
            }}
            disabled={!subjectSearch || !searchQuery.trim() || isSearching || isGuessing || gameEnd || !finishInit}
            title={!subjectSearch ? text.subjectDisabledTip : undefined}
          >
            {isSearching && searchMode === 'subject' ? text.searchingButton : text.subjectButton}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SearchBar; 
