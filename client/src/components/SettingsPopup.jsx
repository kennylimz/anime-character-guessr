import "../styles/popups.css";
import { getIndexInfo, searchSubjects } from "../utils/bangumi";
import { useState, useEffect, useRef } from "react";
import axiosCache from "../utils/cached-axios";
import { getPresetConfig } from "../data/presets";

function SettingsPopup({
  gameSettings,
  onSettingsChange,
  onClose,
  onRestart,
  hideRestart = false,
}) {
  const [indexInputValue, setIndexInputValue] = useState("");
  const [indexInfo, setIndexInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef(null);
  const [hintInputs, setHintInputs] = useState(["8", "5", "3"]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      // Add a small delay to allow click events to complete
      setTimeout(() => {
        if (
          searchContainerRef.current &&
          !searchContainerRef.current.contains(event.target)
        ) {
          setSearchResults([]);
        }
      }, 100);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
        .then((info) => setIndexInfo(info))
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (
      Array.isArray(gameSettings.useHints) &&
      gameSettings.useHints.length > 0
    ) {
      // Always keep 3 inputs, fill with '' if less than 3
      const arr = gameSettings.useHints.map(String);
      while (arr.length < 3) arr.push("");
      setHintInputs(arr);
    } else {
      setHintInputs(["8", "5", "3"]);
    }
  }, [gameSettings.useHints]);

  const setIndex = async (indexId) => {
    if (!indexId) {
      onSettingsChange("useIndex", false);
      onSettingsChange("indexId", null);
      setIndexInputValue("");
      setIndexInfo(null);
      return;
    }

    try {
      const info = await getIndexInfo(indexId);
      setIndexInputValue(indexId);
      setIndexInfo(info);
      onSettingsChange("useIndex", true);
      onSettingsChange("indexId", indexId);
    } catch (error) {
      console.error("Failed to fetch index info:", error);
      if (error.message === "Index not found") {
        alert("Directory does not exist or was deleted");
      } else {
        alert("Import failed, please try again later");
      }
      // Reset index settings on error
      onSettingsChange("useIndex", false);
      onSettingsChange("indexId", null);
      setIndexInputValue("");
      setIndexInfo(null);
    }
  };

  const handleImport = async () => {
    if (!indexInputValue) {
      alert("Please enter the directory ID");
      return;
    }
    try {
      const info = await getIndexInfo(indexInputValue);
      setIndexInputValue(indexInputValue);
      setIndexInfo(info);
      onSettingsChange("indexId", indexInputValue);
    } catch (error) {
      console.error("Failed to fetch index info:", error);
      if (error.message === "Index not found") {
        alert("Directory does not exist or was deleted");
      } else {
        alert("Import failed, please try again later");
      }
      // Reset index settings on error
      onSettingsChange("useIndex", false);
      onSettingsChange("indexId", null);
      setIndexInputValue("");
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
      console.error("Search failed:", error);
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
      },
    ];
    onSettingsChange("addedSubjects", newAddedSubjects);

    // Clear search
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveSubject = (id) => {
    // Remove the subject from gameSettings
    const newAddedSubjects = gameSettings.addedSubjects.filter(
      (subject) => subject.id !== id
    );
    onSettingsChange("addedSubjects", newAddedSubjects);
  };

  const handleClearCache = () => {
    axiosCache.clearCache();
    alert("Cache cleared!");
  };

  const applyPresetConfig = async (presetName) => {
    const presetConfig = getPresetConfig(presetName);
    if (!presetConfig) return;

    // 处理所有普通配置项
    Object.entries(presetConfig).forEach(([key, value]) => {
      if (key !== "indexId") {
        // 特殊处理indexId
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

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        {hideRestart ? (
          <button className="popup-close multiplayer-confirm" onClick={onClose}>
            确认修改
          </button>
        ) : (
          <button className="popup-close" onClick={onClose}>
            <i class="fas fa-xmark"></i>
          </button>
        )}
        <div className="popup-header">
          <h2>Settings</h2>
        </div>
        <div className="popup-body">
          <div className="settings-content">
            <div className="settings-section">
              <h3>Presets</h3>
              <div className="settings-import-export-row">
                <button
                  className="preset-button preset-button-export"
                  onClick={() => {
                    const dataStr =
                      "data:text/json;charset=utf-8," +
                      encodeURIComponent(JSON.stringify(gameSettings, null, 2));
                    const dlAnchorElem = document.createElement("a");
                    dlAnchorElem.setAttribute("href", dataStr);
                    dlAnchorElem.setAttribute("download", "gameSettings.json");
                    document.body.appendChild(dlAnchorElem);
                    dlAnchorElem.click();
                    document.body.removeChild(dlAnchorElem);
                  }}
                >
                  Export Settings
                </button>
                <button
                  className="preset-button preset-button-import"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".json,application/json";
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
                          alert("Settings imported!");
                        } catch (err) {
                          alert("Import failed, invalid JSON file");
                        }
                      };
                      reader.readAsText(file);
                    };
                    input.click();
                  }}
                >
                  Import Settings
                </button>
              </div>
              <div className="presets-buttons">
                <button
                  className="preset-button"
                  onClick={() => applyPresetConfig("Beginner")}
                >
                  Beginner
                </button>
                <button
                  className="preset-button"
                  onClick={() => applyPresetConfig("Frozen Eel Expert")}
                >
                  Frozen Eel Expert
                </button>
                <button
                  className="preset-button"
                  onClick={() => applyPresetConfig("Old Series Enthusiast")}
                >
                  Old Series Enthusiast
                </button>
                <button
                  className="preset-button"
                  onClick={() => applyPresetConfig("Bottle’s Selection")}
                >
                  Bottle’s Selection
                </button>
                <button
                  className="preset-button"
                  onClick={() => {
                    alert("😅");
                    applyPresetConfig("Wooden Cabinet Fan");
                  }}
                >
                  Wooden Cabinet Fan
                </button>
                <button
                  className="preset-button"
                  onClick={() => {
                    alert("那很有生活了😅");
                    applyPresetConfig("Second Game Expert");
                  }}
                >
                  Second Game Expert
                </button>
                <button
                  className="preset-button"
                  onClick={() => {
                    applyPresetConfig("米哈游高手");
                  }}
                >
                  miHoYo Expert
                </button>
                <button
                  className="preset-button"
                  onClick={() => {
                    alert("风暴要火");
                    applyPresetConfig("MOBA Cake Master");
                  }}
                >
                  MOBA Cake Master
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h3>Game Settings</h3>
              <div
                className="settings-row"
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <label>Search Subjects</label>
                <input
                  type="checkbox"
                  checked={gameSettings.subjectSearch}
                  onChange={(e) => {
                    onSettingsChange("subjectSearch", e.target.checked);
                  }}
                  style={{ marginRight: "50px", marginLeft: "0px" }}
                />
                <div
                  style={{
                    marginLeft: "30px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <label>Include Game Entries</label>
                  <span className="tooltip-trigger">
                    ?
                    <span className="tooltip-text">
                      When calculating appearing works (year, score), games will
                      be included.
                      <br />
                      However, answer characters will only be selected from
                      animations, as the game popularity ranking has bugs.
                      <br />
                      If you want to guess game characters, you can create a
                      custom directory or add extra works.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={gameSettings.includeGame}
                    onChange={(e) => {
                      onSettingsChange("includeGame", e.target.checked);
                    }}
                    style={{ marginRight: "50px", marginLeft: "0px" }}
                  />
                </div>
              </div>
              <div className="settings-row">
                <label>Enable Hints</label>
                <input
                  type="checkbox"
                  checked={
                    Array.isArray(gameSettings.useHints) &&
                    gameSettings.useHints.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setHintInputs(["8", "5", "3"]);
                      onSettingsChange("useHints", [8, 5, 3]);
                    } else {
                      setHintInputs(["8", "5", "3"]);
                      onSettingsChange("useHints", []);
                    }
                  }}
                  style={{ marginRight: "20px", marginLeft: "0px" }}
                />
                {Array.isArray(gameSettings.useHints) &&
                  gameSettings.useHints.length > 0 && (
                    <>
                      <label style={{ marginLeft: "10px" }}>
                        Hint Appearance Timing (Remaining Attempts)
                      </label>
                      {[0, 1, 2].map((idx) => (
                        <input
                          key={idx}
                          type="number"
                          min="1"
                          max={gameSettings.maxAttempts || 10}
                          value={hintInputs[idx] || ""}
                          onChange={(e) => {
                            const newInputs = [...hintInputs];
                            let val = e.target.value;
                            if (
                              val === "" ||
                              isNaN(Number(val)) ||
                              Number(val) < 1
                            ) {
                              newInputs[idx] = "";
                            } else {
                              val = String(Math.floor(Number(val)));
                              // Enforce strictly decreasing order
                              if (
                                idx > 0 &&
                                newInputs[idx - 1] &&
                                Number(val) >= Number(newInputs[idx - 1])
                              ) {
                                // Clear this and all subsequent inputs
                                for (let i = idx; i < 3; i++) newInputs[i] = "";
                              } else {
                                newInputs[idx] = val;
                              }
                            }
                            setHintInputs(newInputs);
                            // Only save non-empty, valid numbers, and in strictly decreasing order
                            const arr = [];
                            for (let i = 0; i < 3; i++) {
                              const n = parseInt(newInputs[i], 10);
                              if (!isNaN(n) && (i === 0 || n < arr[i - 1])) {
                                arr.push(n);
                              } else {
                                break;
                              }
                            }
                            onSettingsChange("useHints", arr);
                          }}
                          style={{
                            marginLeft: idx === 0 ? "8px" : "4px",
                            width: "60px",
                          }}
                          placeholder={`🚫`}
                        />
                      ))}
                    </>
                  )}
              </div>
              <div className="settings-row">
                <label>When remaining attempts are</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={gameSettings.useImageHint}
                  onChange={(e) => {
                    const value = Math.max(
                      0,
                      Math.min(10, parseInt(e.target.value) || 0)
                    );
                    onSettingsChange("useImageHint", value);
                  }}
                />
                <label>, show image hints (0 to disable)</label>
              </div>
              <div className="settings-row">
                <label>Attempts per Game</label>
                <input
                  type="number"
                  value={gameSettings.maxAttempts || ""}
                  onChange={(e) => {
                    const value =
                      e.target.value === ""
                        ? 10
                        : Math.max(
                            1,
                            Math.min(15, parseInt(e.target.value) || 1)
                          );
                    onSettingsChange("maxAttempts", value);
                  }}
                  min="1"
                  max="15"
                />
              </div>

              <div className="settings-row">
                <label>*Time Limit</label>
                <input
                  type="checkbox"
                  checked={gameSettings.timeLimit !== null}
                  onChange={(e) =>
                    onSettingsChange("timeLimit", e.target.checked ? 60 : null)
                  }
                  style={{ marginRight: "50px", marginLeft: "0px" }}
                />
                {gameSettings.timeLimit !== null && (
                  <div className="settings-row">
                    <input
                      type="number"
                      min="30"
                      max="120"
                      value={gameSettings.timeLimit}
                      onChange={(e) => {
                        const value = Math.max(
                          30,
                          Math.min(120, parseInt(e.target.value) || 30)
                        );
                        onSettingsChange("timeLimit", value);
                      }}
                    />
                    <label>seconds per round</label>
                  </div>
                )}
              </div>
              <div className="settings-row">
                <label>(*Features may have bugs)</label>
              </div>
            </div>

            <div className="settings-section">
              <h3>Range Settings</h3>

              <div className="settings-subsection">
                <div
                  className="settings-row"
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <label>Year</label>
                  <input
                    type="number"
                    value={gameSettings.startYear || ""}
                    onChange={(e) => {
                      const value =
                        e.target.value === "" ? 1900 : parseInt(e.target.value);
                      onSettingsChange("startYear", value);
                    }}
                    min="1900"
                    max="2100"
                    disabled={gameSettings.useIndex}
                  />
                  <span>-</span>
                  <input
                    type="number"
                    value={gameSettings.endYear || ""}
                    onChange={(e) => {
                      const value =
                        e.target.value === "" ? 2100 : parseInt(e.target.value);
                      onSettingsChange("endYear", value);
                    }}
                    min="1900"
                    max="2100"
                    disabled={gameSettings.useIndex}
                  />
                </div>
                <div className="filter-row">
                  <div className="filter-item">
                    <label>Category</label>
                    <select
                      className="settings-select"
                      value={gameSettings.metaTags[0] || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        const newMetaTags = [...gameSettings.metaTags];
                        newMetaTags[0] = value;
                        onSettingsChange("metaTags", newMetaTags);
                      }}
                      // disabled={gameSettings.useIndex}
                    >
                      <option value="">All</option>
                      <option value="TV">TV</option>
                      <option value="WEB">WEB</option>
                      <option value="OVA">OVA</option>
                      <option value="Movie">Movie</option>
                      <option value="Motion Comic">Motion Comic</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div className="filter-item">
                    <label>Source</label>
                    <select
                      className="settings-select"
                      value={gameSettings.metaTags[1] || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        const newMetaTags = [...gameSettings.metaTags];
                        newMetaTags[1] = value;
                        onSettingsChange("metaTags", newMetaTags);
                      }}
                      // disabled={gameSettings.useIndex}
                    >
                      <option value="">All</option>
                      <option value="Original">Original</option>
                      <option value="Manga Adaptation">Manga Adaptation</option>
                      <option value="Game Adaptation">Game Adaptation</option>
                      <option value="Novel Adaptation">Novel Adaptation</option>
                    </select>
                  </div>
                  <div className="filter-item">
                    <label>Genre</label>
                    <select
                      className="settings-select"
                      value={gameSettings.metaTags[2] || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        const newMetaTags = [...gameSettings.metaTags];
                        newMetaTags[2] = value;
                        onSettingsChange("metaTags", newMetaTags);
                      }}
                      // disabled={gameSettings.useIndex}
                    >
                      <option value="">All</option>
                      <option value="Sci-Fi">Sci-Fi</option>
                      <option value="Comedy">Comedy</option>
                      <option value="Yuri">Yuri</option>
                      <option value="School">School</option>
                      <option value="Thriller">Thriller</option>
                      <option value="Harem">Harem</option>
                      <option value="Mecha">Mecha</option>
                      <option value="Mystery">Mystery</option>
                      <option value="Romance">Romance</option>
                      <option value="Fantasy">Fantasy</option>
                      <option value="Detective">Detective</option>
                      <option value="Sports">Sports</option>
                      <option value="Boys' Love">Boys' Love</option>
                      <option value="Music">Music</option>
                      <option value="Battle">Battle</option>
                      <option value="Adventure">Adventure</option>
                      <option value="Moe">Moe</option>
                      <option value="Time Travel">Time Travel</option>
                      <option value="Xuanhuan">Xuanhuan</option>
                      <option value="Otome">Otome</option>
                      <option value="Horror">Horror</option>
                      <option value="History">History</option>
                      <option value="Slice of Life">Slice of Life</option>
                      <option value="Drama">Drama</option>
                      <option value="Martial Arts">Martial Arts</option>
                      <option value="Gourmet">Gourmet</option>
                      <option value="Workplace">Workplace</option>
                    </select>
                  </div>
                  <span className="tooltip-trigger">
                    ?
                    <span className="tooltip-text">
                      These options also affect information of appearing works.
                      <br />
                      For example, if you don’t want movies counted, select only
                      “TV”.
                      <br />
                      When "Use Index" is enabled, these options won’t affect
                      answer selection, only table display.
                    </span>
                  </span>
                </div>
                <div
                  className="settings-row"
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <label>
                    Bangumi Popularity Ranking
                    {gameSettings.useSubjectPerYear ? "Per Year" : "Total"}
                  </label>
                  <input
                    type="number"
                    value={
                      gameSettings.topNSubjects === undefined
                        ? ""
                        : gameSettings.topNSubjects
                    }
                    onChange={(e) => {
                      const value =
                        e.target.value === ""
                          ? 100
                          : Math.max(0, parseInt(e.target.value));
                      onSettingsChange("topNSubjects", value);
                    }}
                    min="0"
                    max="1000"
                    disabled={gameSettings.useIndex}
                  />
                  <label>Works</label>
                  <div
                    style={{
                      marginLeft: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      className="toggle-switch-container"
                      style={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <label
                        style={{
                          marginRight: "8px",
                          color: !gameSettings.useSubjectPerYear
                            ? "#1890ff"
                            : "#666",
                        }}
                      >
                        Total Works
                      </label>
                      <div
                        className="toggle-switch"
                        style={{
                          width: "40px",
                          height: "20px",
                          backgroundColor: gameSettings.useSubjectPerYear
                            ? "#1890ff"
                            : "#ccc",
                          borderRadius: "10px",
                          position: "relative",
                          cursor: gameSettings.useIndex
                            ? "not-allowed"
                            : "pointer",
                          transition: "background-color 0.3s",
                        }}
                        onClick={() =>
                          !gameSettings.useIndex &&
                          onSettingsChange(
                            "useSubjectPerYear",
                            !gameSettings.useSubjectPerYear
                          )
                        }
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            backgroundColor: "white",
                            borderRadius: "50%",
                            position: "absolute",
                            top: "2px",
                            left: gameSettings.useSubjectPerYear
                              ? "22px"
                              : "2px",
                            transition: "left 0.3s",
                          }}
                        />
                      </div>
                      <label
                        style={{
                          marginLeft: "8px",
                          color: gameSettings.useSubjectPerYear
                            ? "#1890ff"
                            : "#666",
                        }}
                      >
                        Works Per Year
                      </label>
                      <span className="tooltip-trigger">
                        ?
                        <span className="tooltip-text">
                          When enabled, a year is selected first, then works
                          from that year.
                          <br />
                          Reduces influence of new works’ popularity.
                          <br />
                          Good for older anime fans!
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="settings-row">
                  <label>Use Index</label>
                  <span className="tooltip-trigger">
                    ?
                    <span className="tooltip-text">
                      When checked, correct answers will only be selected from
                      the index (+ extra works).
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={gameSettings.useIndex}
                    onChange={(e) => {
                      onSettingsChange("useIndex", e.target.checked);
                      if (!e.target.checked) {
                        // Reset when disabling index
                        onSettingsChange("metaTags", ["", "", ""]);
                        onSettingsChange("addedSubjects", []);
                        onSettingsChange("indexId", null);
                        setIndexInfo(null);
                        setIndexInputValue("");
                      }
                    }}
                    style={{ marginRight: "50px", marginLeft: "0px" }}
                  />
                  {gameSettings.useIndex && (
                    <>
                      <div className="settings-row">
                        <div className="index-input-group">
                          <span className="index-prefix">
                            https://bangumi.tv/index/
                          </span>
                          <input
                            type="text"
                            value={indexInputValue}
                            onChange={(e) => {
                              setIndexInputValue(e.target.value);
                            }}
                          />
                          <button
                            className="import-button"
                            onClick={handleImport}
                          >
                            Import
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {gameSettings.useIndex && indexInfo && (
                  <div className="settings-row index-info">
                    <div className="index-info-content">
                      <a
                        className="index-title"
                        href={`https://bangumi.tv/index/${gameSettings.indexId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {indexInfo.title}
                      </a>
                      <span className="index-total">
                        Total {indexInfo.total} works
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-subsection">
                <h4>Add Extra Works</h4>
                <div className="settings-row">
                  <div className="search-box" ref={searchContainerRef}>
                    <input
                      type="text"
                      placeholder="Search Works..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSearch();
                        }
                      }}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || isSearching}
                    >
                      {isSearching ? "Searching..." : "Search"}
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
                        <span className="subject-meta">
                          {subject.name_cn || ""}
                        </span>
                        <span className="subject-type">{subject.type}</span>
                      </div>
                    ))}
                  </div>
                )}
                {gameSettings.addedSubjects.length > 0 && (
                  <div className="added-subjects">
                    <h5>
                      Added Works (If you only want to guess these, set ranking
                      works above to 0)
                    </h5>
                    {gameSettings.addedSubjects.map((subject) => (
                      <div key={subject.id} className="added-subject-item">
                        <div className="subject-info">
                          <a
                            className="subject-title"
                            href={`https://bangumi.tv/subject/${subject.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {subject.name}
                          </a>
                          <span className="subject-meta">
                            {subject.name_cn || ""}（{subject.type}）
                          </span>
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
                  <label>Main Characters Only</label>
                  <input
                    type="checkbox"
                    checked={gameSettings.mainCharacterOnly}
                    onChange={(e) => {
                      onSettingsChange("mainCharacterOnly", e.target.checked);
                    }}
                    style={{ marginRight: "50px", marginLeft: "0px" }}
                  />
                </div>
                {!gameSettings.mainCharacterOnly && (
                  <div className="settings-row">
                    <label>Number of Characters per Work</label>
                    <input
                      type="number"
                      value={gameSettings.characterNum || ""}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? 1 : parseInt(e.target.value);
                        onSettingsChange("characterNum", value);
                      }}
                      min="1"
                      max="10"
                    />
                  </div>
                )}
                <div className="settings-row">
                  <label>Character Tag Count</label>
                  <input
                    type="number"
                    value={gameSettings.characterTagNum || ""}
                    onChange={(e) => {
                      const value =
                        e.target.value === ""
                          ? 0
                          : Math.max(
                              0,
                              Math.min(10, parseInt(e.target.value) || 0)
                            );
                      onSettingsChange("characterTagNum", value);
                    }}
                    min="0"
                    max="10"
                  />
                </div>
                <div className="settings-row">
                  <label>Work Tag Count</label>
                  <input
                    type="number"
                    value={gameSettings.subjectTagNum || ""}
                    onChange={(e) => {
                      const value =
                        e.target.value === ""
                          ? 0
                          : Math.max(
                              0,
                              Math.min(10, parseInt(e.target.value) || 0)
                            );
                      onSettingsChange("subjectTagNum", value);
                    }}
                    min="0"
                    max="10"
                  />
                </div>
                <div
                  className="settings-row"
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <label>Common Tags Priority</label>
                  <span className="tooltip-trigger">
                    ?
                    <span className="tooltip-text">
                      Prioritize displaying common (green) tags, may increase
                      processing time.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={gameSettings.commonTags}
                    onChange={(e) => {
                      onSettingsChange("commonTags", e.target.checked);
                    }}
                    style={{ marginRight: "50px", marginLeft: "0px" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="popup-footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {!hideRestart && (
            <>
              <div style={{ display: "flex", alignItems: "center" }}>
                <button
                  className="restart-button"
                  onClick={onRestart}
                  style={{ marginRight: "10px" }}
                >
                  Restart
                </button>
                <label style={{ fontSize: "0.8rem" }}>
                  *Changes only take effect if clicked; otherwise take effect
                  next game
                </label>
              </div>
              <button className="clear-cache-button" onClick={handleClearCache}>
                Clear Cache
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPopup;
