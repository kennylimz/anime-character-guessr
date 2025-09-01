import { useRef, useState, useEffect } from "react";
import axios from "../utils/cached-axios";
import {
  searchSubjects,
  getCharactersBySubjectId,
  getCharacterDetails,
} from "../utils/bangumi";
import "../styles/search.css";
import { submitGuessCharacterCount } from "../utils/db";

function SearchBar({ onCharacterSelect, isGuessing, gameEnd, subjectSearch }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchMode, setSearchMode] = useState("character"); // 'character' or 'subject'
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1); // Index of currently selected item on keyboard
  const [isLoadingNewResults, setIsLoadingNewResults] = useState(false); // Flag indicating whether more results are being loaded

  // DOM references
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const selectedItemRef = useRef(null);

  const INITIAL_LIMIT = 10;
  const MORE_LIMIT = 5;

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setSearchResults([]);
        setOffset(0);
        setHasMore(true);
        setSelectedSubject(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Shortcut key to focus search input (press spacebar)
  useEffect(() => {
    function handleKeyDown(e) {
      // When the user presses the spacebar and is not in an input, focus on the search input
      if (
        e.key === " " &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA" &&
        !isGuessing &&
        !gameEnd
      ) {
        e.preventDefault();
        searchInputRef.current.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGuessing, gameEnd]);

  // Auto-scroll to ensure the selected item is visible
  useEffect(() => {
    if (selectedItemIndex >= 0 && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedItemIndex]);

  // Keyboard navigation handling
  useEffect(() => {
    function handleKeyboardNavigation(e) {
      // Only handle keyboard navigation when search results exist and input is focused
      if (
        searchResults.length === 0 ||
        document.activeElement !== searchInputRef.current
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedItemIndex((prevIndex) => {
            const maxIndex =
              searchMode === "character" && hasMore
                ? searchResults.length
                : searchResults.length - 1;
            // Do not loop to the top; if at the bottom, stay at bottom
            return prevIndex < maxIndex ? prevIndex + 1 : maxIndex;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedItemIndex((prevIndex) =>
            // Do not loop to the bottom; if at the top, stay at top
            prevIndex > 0 ? prevIndex - 1 : 0
          );
          break;
        case "Enter":
          e.preventDefault();
          if (selectedItemIndex === -1) {
            return;
          }

          if (searchMode === "subject" && !selectedSubject) {
            // If in subject search mode and a subject is selected
            if (selectedItemIndex < searchResults.length) {
              handleSubjectSelect(searchResults[selectedItemIndex]);
            }
          } else if (
            selectedItemIndex === searchResults.length &&
            hasMore &&
            searchMode === "character"
          ) {
            // If "Load More" is selected
            setIsLoadingNewResults(true); // Flag indicating more results are being loaded
            handleLoadMore();
          } else if (selectedItemIndex < searchResults.length) {
            // If a character is selected
            handleCharacterSelect(searchResults[selectedItemIndex]);
          }
          break;
        default:
          break;
      }
    }

    document.addEventListener("keydown", handleKeyboardNavigation);
    return () => {
      document.removeEventListener("keydown", handleKeyboardNavigation);
    };
  }, [searchResults, selectedItemIndex, searchMode, hasMore, selectedSubject]);

  // When search results change, handle reset or maintain selected index
  useEffect(() => {
    // If loading more, set selected index to first new item
    if (isLoadingNewResults) {
      const previousLength = selectedItemIndex; // Previously selected was "Load More", index equals previous results length
      setSelectedItemIndex(previousLength); // Set to first new item
      setIsLoadingNewResults(false);
    } else {
      // Reset selected index normally
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
    if (!subjectSearch && searchMode === "subject") {
      setSearchMode("character");
      setSearchResults([]);
      setOffset(0);
      setHasMore(true);
      setSelectedSubject(null);
    }
  }, [subjectSearch]);

  // Debounced search function for character search only
  useEffect(() => {
    if (searchMode !== "character") return;

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
          keyword: searchQuery.trim(),
        }
      );

      const newResults = response.data.data.map((character) => ({
        id: character.id,
        image: character.images?.grid || null,
        name: character.name,
        nameCn:
          character.infobox.find((item) => item.key === "简体中文名")?.value ||
          character.name,
        gender: character.gender || "?",
        popularity: character.stat.collects + character.stat.comments,
      }));

      if (reset) {
        setSearchResults(newResults);
        setOffset(INITIAL_LIMIT);
      } else {
        setSearchResults((prev) => [...prev, ...newResults]);
        setOffset(currentOffset + MORE_LIMIT);
      }

      setHasMore(newResults.length === currentLimit);
    } catch (error) {
      console.error("Search failed:", error);
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
      console.error("Subject search failed:", error);
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
      const formattedCharacters = await Promise.all(
        characters.map(async (character) => {
          const details = await getCharacterDetails(character.id);
          return {
            id: character.id,
            image: character.images?.grid,
            name: character.name,
            nameCn: details.nameCn,
            gender: details.gender,
            popularity: details.popularity,
          };
        })
      );
      setSearchResults(formattedCharacters);
    } catch (error) {
      console.error("Failed to fetch characters:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = () => {
    if (searchMode === "character") {
      handleSearch(false);
    }
  };

  const handleCharacterSelect = (character) => {
    submitGuessCharacterCount(character.id, character.nameCn || character.name);
    onCharacterSelect(character);
    setSearchQuery("");
    setSearchResults([]);
    setOffset(0);
    setHasMore(true);
    setSelectedSubject(null);
    setSearchMode("character");
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) return null;

    if (searchMode === "subject" && !selectedSubject) {
      return (
        <div className="search-dropdown" ref={searchDropdownRef}>
          {isSearching ? (
            <div className="search-loading">Searching...</div>
          ) : (
            searchResults.map((subject, index) => (
              <div
                key={subject.id}
                className={`search-result-item ${
                  selectedItemIndex === index ? "selected" : ""
                }`}
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
                  <div className="result-character-icon no-image">No image</div>
                )}
                <div className="result-character-info">
                  <div className="result-character-name">{subject.name}</div>
                  <div className="result-character-name-cn">
                    {subject.name_cn}
                  </div>
                  <div className="result-subject-type">{subject.type}</div>
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
            <span>{selectedSubject.name_cn || selectedSubject.name}</span>
            <button
              className="back-to-subjects"
              onClick={() => {
                setSelectedSubject(null);
                handleSubjectSearch();
              }}
            >
              Back
            </button>
          </div>
        )}
        {isSearching ? (
          <div className="search-loading">Loading characters...</div>
        ) : (
          <>
            {searchResults.map((character, index) => (
              <div
                key={character.id}
                className={`search-result-item ${
                  selectedItemIndex === index ? "selected" : ""
                }`}
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
                  <div className="result-character-icon no-image">No image</div>
                )}
                <div className="result-character-info">
                  <div className="result-character-name">{character.name}</div>
                  <div className="result-character-name-cn">
                    {character.nameCn}
                  </div>
                </div>
              </div>
            ))}
            {hasMore && searchMode === "character" && (
              <div
                className={`search-result-item load-more ${
                  selectedItemIndex === searchResults.length ? "selected" : ""
                }`}
                onClick={handleLoadMore}
                ref={
                  selectedItemIndex === searchResults.length
                    ? selectedItemRef
                    : null
                }
              >
                {isLoadingMore ? "加载中..." : "More"}
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
            placeholder={
              searchMode === "character"
                ? "Search for a character to guess..."
                : "Search for a work to guess..."
            }
            ref={searchInputRef}
          />
          {renderSearchResults()}
        </div>
        <button
          className={`search-button ${
            searchMode === "character" ? "active" : ""
          }`}
          onClick={() => {
            setSearchMode("character");
            if (searchQuery.trim()) handleSearch(true);
          }}
          disabled={!searchQuery.trim() || isSearching || isGuessing || gameEnd}
        >
          {isSearching && searchMode === "character"
            ? "Searching..."
            : isGuessing
            ? "Guessing..."
            : "Search character"}
        </button>
        {subjectSearch && (
          <button
            className={`search-button ${
              searchMode === "subject" ? "active" : ""
            }`}
            onClick={() => {
              setSearchMode("subject");
              if (searchQuery.trim()) handleSubjectSearch();
            }}
            disabled={
              !searchQuery.trim() || isSearching || isGuessing || gameEnd
            }
          >
            {isSearching && searchMode === "subject"
              ? "Searching..."
              : "Search subject"}
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchBar;
