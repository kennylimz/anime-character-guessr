import { useRef, useState, useEffect } from 'react';
import axios from '../utils/cached-axios';
import { searchSubjects, getCharactersBySubjectId, getCharacterDetails } from '../utils/bangumi';
import '../styles/search.css';

function SearchBar({ onCharacterSelect, isGuessing, gameEnd, subjectSearch }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchMode, setSearchMode] = useState('character'); // 'character' or 'subject'
  const [selectedSubject, setSelectedSubject] = useState(null);
  const searchContainerRef = useRef(null);
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
    if (!searchQuery.trim()) return;
    
    // Always use initial search parameters when reset is true
    const currentLimit = reset ? INITIAL_LIMIT : MORE_LIMIT;
    const currentOffset = reset ? 0 : offset;
    const loadingState = reset ? setIsSearching : setIsLoadingMore;
    
    loadingState(true);
    try {
      const response = await axios.post(
        `https://api.bgm.tv/v0/search/characters?limit=${currentLimit}&offset=${currentOffset}`,
        {
          keyword: searchQuery.trim()
        }
      );
      
      const newResults = response.data.data.map(character => ({
        id: character.id,
        image: character.images?.grid || null,
        name: character.name,
        nameCn: character.infobox.find(item => item.key === "简体中文名")?.value || character.name,
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
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchSubjects(searchQuery);
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
          image: character.images?.grid,
          name: character.name,
          nameCn: details.nameCn,
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
        <div className="search-dropdown">
          {isSearching ? (
            <div className="search-loading">搜索中...</div>
          ) : (
            searchResults.map((subject) => (
              <div
                key={subject.id}
                className="search-result-item"
                onClick={() => handleSubjectSelect(subject)}
              >
                {subject.image ? (
                  <img 
                    src={subject.image} 
                    alt={subject.name} 
                    className="result-character-icon"
                  />
                ) : (
                  <div className="result-character-icon no-image">
                    无图片
                  </div>
                )}
                <div className="result-character-info">
                  <div className="result-character-name">{subject.name}</div>
                  <div className="result-character-name-cn">{subject.name_cn}</div>
                  <div className="result-subject-type">{subject.type}</div>
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    return (
      <div className="search-dropdown">
        {selectedSubject && (
          <div className="selected-subject-header">
            <span>{selectedSubject.name_cn || selectedSubject.name}</span>
            <button 
              className="back-to-subjects"
              onClick={() => {
                setSelectedSubject(null);
                handleSubjectSearch();
              }}
            >
              返回
            </button>
          </div>
        )}
        {isSearching ? (
          <div className="search-loading">加载角色中...</div>
        ) : (
          <>
            {searchResults.map((character) => (
              <div
                key={character.id}
                className="search-result-item"
                onClick={() => handleCharacterSelect(character)}
              >
                {character.image ? (
                  <img 
                    src={character.image} 
                    alt={character.name} 
                    className="result-character-icon"
                  />
                ) : (
                  <div className="result-character-icon no-image">
                    无图片
                  </div>
                )}
                <div className="result-character-info">
                  <div className="result-character-name">{character.name}</div>
                  <div className="result-character-name-cn">{character.nameCn}</div>
                </div>
              </div>
            ))}
            {hasMore && searchMode === 'character' && (
              <div 
                className="search-result-item load-more"
                onClick={handleLoadMore}
              >
                {isLoadingMore ? '加载中...' : '更多'}
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
            disabled={isGuessing || gameEnd}
            placeholder={searchMode === 'character' ? "搜索角色..." : "搜索作品..."}
          />
          {renderSearchResults()}
        </div>
        <button 
          className={`search-button ${searchMode === 'character' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('character');
            if (searchQuery.trim()) handleSearch(true);
          }}
          disabled={!searchQuery.trim() || isSearching || isGuessing || gameEnd}
        >
          {isSearching && searchMode === 'character' ? '在搜了...' : isGuessing ? '在猜了...' : '搜角色'}
        </button>
        {subjectSearch && (
          <button 
            className={`search-button ${searchMode === 'subject' ? 'active' : ''}`}
            onClick={() => {
              setSearchMode('subject');
              if (searchQuery.trim()) handleSubjectSearch();
            }}
            disabled={!searchQuery.trim() || isSearching || isGuessing || gameEnd}
          >
            {isSearching && searchMode === 'subject' ? '在搜了...' : '搜作品'}
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchBar; 