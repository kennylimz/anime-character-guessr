import "../styles/GuessesTable.css";
import { useState } from "react";
import ModifiedTagDisplay from "./ModifiedTagDisplay";
import { subjectsWithExtraTags } from "../data/extra_tag_subjects";
import tagTranslations from "../utils/tag_list.json";

function GuessesTable({ guesses, gameSettings, answerCharacter }) {
  const [clickedExpandTags, setClickedExpandTags] = useState(new Set());
  const [externalTagMode, setExternalTagMode] = useState(false);

  // Determine if any guess could have extra tags
  const hasAnyExtraTags = guesses.some(
    (guess) =>
      Array.isArray(guess.appearanceIds) &&
      guess.appearanceIds.some((id) => subjectsWithExtraTags.has(id))
  );

  const getGenderEmoji = (gender) => {
    switch (gender) {
      case "male":
        return "♂️";
      case "female":
        return "♀️";
      default:
        return "❓";
    }
  };

  const handleExpandTagClick = (guessIndex, tagIndex) => {
    const key = `${guessIndex}-${tagIndex}`;
    setClickedExpandTags((prev) => {
      const newSet = new Set(prev);
      newSet.add(key);
      return newSet;
    });
  };

  const handleToggleMode = () => {
    setExternalTagMode((prev) => !prev);
  };

  return (
    <div className="table-container">
      {/* Only show toggle if any guess could have extra tags */}
      {hasAnyExtraTags && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={handleToggleMode}
            style={{
              padding: "8px 24px",
              borderRadius: "24px",
              border: "none",
              background: externalTagMode ? "#4a90e2" : "#e0e0e0",
              color: externalTagMode ? "#fff" : "#333",
              fontWeight: "bold",
              fontSize: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              cursor: "pointer",
              transition: "background 0.2s, color 0.2s",
              outline: "none",
            }}
            onMouseOver={(e) => {
              e.target.style.background = externalTagMode
                ? "#006a91"
                : "#d0d0d0";
            }}
            onMouseOut={(e) => {
              e.target.style.background = externalTagMode
                ? "#0084B4"
                : "#e0e0e0";
            }}
          >
            More Tags
          </button>
        </div>
      )}
      <table
        className={`guesses-table${
          externalTagMode ? " external-tag-mode" : ""
        }`}
      >
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            {externalTagMode ? (
              <>
                <th>Gender?</th>
                <th></th>
              </>
            ) : (
              <>
                <th>Gender</th>
                <th>Popularity</th>
                <th>
                  Works Count
                  <br />
                  Highest Rating
                </th>
                <th>
                  Latest Appearance
                  <br />
                  Earliest Appearance
                </th>
              </>
            )}
            <th>Tags</th>
            <th>Shared Appearances</th>
          </tr>
        </thead>
        <tbody>
          {guesses.map((guess, guessIndex) => (
            <tr key={guessIndex}>
              <td>
                <img
                  src={guess.icon}
                  alt="character"
                  className="character-icon"
                />
              </td>
              <td>
                <div
                  className={`character-name-container ${
                    guess.isAnswer ? "correct" : ""
                  }`}
                >
                  {guess.guessrName && (
                    <div
                      className="character-guessr-name"
                      style={{ fontSize: "12px", color: "#888" }}
                    >
                      From:{guess.guessrName}
                    </div>
                  )}
                  <div className="character-name">{guess.name}</div>
                  <div className="character-name-cn">{guess.nameCn}</div>
                </div>
              </td>
              <td>
                <span
                  className={`feedback-cell ${
                    guess.genderFeedback === "yes" ? "correct" : ""
                  }`}
                >
                  {getGenderEmoji(guess.gender)}
                </span>
              </td>
              {externalTagMode ? (
                <td>
                  <ModifiedTagDisplay
                    guessCharacter={guess}
                    answerCharacter={answerCharacter}
                  />
                </td>
              ) : (
                <>
                  <td>
                    <span
                      className={`feedback-cell ${
                        guess.popularityFeedback === "="
                          ? "correct"
                          : guess.popularityFeedback === "+" ||
                            guess.popularityFeedback === "-"
                          ? "partial"
                          : ""
                      }`}
                    >
                      {guess.popularity}
                      {guess.popularityFeedback === "+" ||
                      guess.popularityFeedback === "++"
                        ? " ↓"
                        : guess.popularityFeedback === "-" ||
                          guess.popularityFeedback === "--"
                        ? " ↑"
                        : ""}
                    </span>
                  </td>
                  <td>
                    <div className="appearance-container">
                      <div
                        className={`feedback-cell appearance-count ${
                          guess.appearancesCountFeedback === "="
                            ? "correct"
                            : guess.appearancesCountFeedback === "+" ||
                              guess.appearancesCountFeedback === "-"
                            ? "partial"
                            : guess.appearancesCountFeedback === "?"
                            ? "unknown"
                            : ""
                        }`}
                      >
                        {guess.appearancesCount}
                        {guess.appearancesCountFeedback === "+" ||
                        guess.appearancesCountFeedback === "++"
                          ? " ↓"
                          : guess.appearancesCountFeedback === "-" ||
                            guess.appearancesCountFeedback === "--"
                          ? " ↑"
                          : ""}
                      </div>
                      <div
                        className={`feedback-cell appearance-rating ${
                          guess.ratingFeedback === "="
                            ? "correct"
                            : guess.ratingFeedback === "+" ||
                              guess.ratingFeedback === "-"
                            ? "partial"
                            : guess.ratingFeedback === "?"
                            ? "unknown"
                            : ""
                        }`}
                      >
                        {guess.highestRating === -1
                          ? "None"
                          : guess.highestRating}
                        {guess.ratingFeedback === "+" ||
                        guess.ratingFeedback === "++"
                          ? " ↓"
                          : guess.ratingFeedback === "-" ||
                            guess.ratingFeedback === "--"
                          ? " ↑"
                          : ""}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="appearance-container">
                      <div
                        className={`feedback-cell latestAppearance ${
                          guess.latestAppearanceFeedback === "="
                            ? "correct"
                            : guess.latestAppearanceFeedback === "+" ||
                              guess.latestAppearanceFeedback === "-"
                            ? "partial"
                            : guess.latestAppearanceFeedback === "?"
                            ? "unknown"
                            : ""
                        }`}
                      >
                        {guess.latestAppearance === -1
                          ? "None"
                          : guess.latestAppearance}
                        {guess.latestAppearanceFeedback === "+" ||
                        guess.latestAppearanceFeedback === "++"
                          ? " ↓"
                          : guess.latestAppearanceFeedback === "-" ||
                            guess.latestAppearanceFeedback === "--"
                          ? " ↑"
                          : ""}
                      </div>
                      <div
                        className={`feedback-cell earliestAppearance ${
                          guess.earliestAppearanceFeedback === "="
                            ? "correct"
                            : guess.earliestAppearanceFeedback === "+" ||
                              guess.earliestAppearanceFeedback === "-"
                            ? "partial"
                            : guess.earliestAppearanceFeedback === "?"
                            ? "unknown"
                            : ""
                        }`}
                      >
                        {guess.earliestAppearance === -1
                          ? "None"
                          : guess.earliestAppearance}
                        {guess.earliestAppearanceFeedback === "+" ||
                        guess.earliestAppearanceFeedback === "++"
                          ? " ↓"
                          : guess.earliestAppearanceFeedback === "-" ||
                            guess.earliestAppearanceFeedback === "--"
                          ? " ↑"
                          : ""}
                      </div>
                    </div>
                  </td>
                </>
              )}
              <td>
                <div className="meta-tags-container">
                  {guess.metaTags.map((tag, tagIndex) => {
                    if (tagTranslations[tag]) tag = tagTranslations[tag];
                    const isExpandTag = tag === "Expand";
                    const tagKey = `${guessIndex}-${tagIndex}`;
                    const isClicked = clickedExpandTags.has(tagKey);

                    return (
                      <span
                        key={tagIndex}
                        className={`meta-tag ${
                          guess.sharedMetaTags.includes(tag) ? "shared" : ""
                        } ${isExpandTag ? "expand-tag" : ""}`}
                        onClick={
                          isExpandTag
                            ? () => handleExpandTagClick(guessIndex, tagIndex)
                            : undefined
                        }
                        style={
                          isExpandTag && !isClicked
                            ? { color: "#0084B4", cursor: "pointer" }
                            : undefined
                        }
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td>
                <span
                  className={`shared-appearances ${
                    guess.sharedAppearances.count > 0 ? "has-shared" : ""
                  }`}
                >
                  {guess.sharedAppearances.first}
                  {guess.sharedAppearances.count > 1 &&
                    ` +${guess.sharedAppearances.count - 1}`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GuessesTable;
