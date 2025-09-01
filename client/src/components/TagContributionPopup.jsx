import "../styles/popups.css";
import { useState, useRef, useEffect } from "react";
import {
  submitCharacterTags,
  proposeCustomTags,
  submitFeedbackTags,
} from "../utils/db";
import { idToTags } from "../data/id_tags.js";

function TagContributionPopup({ character, onClose }) {
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTags, setCustomTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeVoteTag, setActiveVoteTag] = useState(null);
  const [upvotedTags, setUpvotedTags] = useState(new Set());
  const [downvotedTags, setDownvotedTags] = useState(new Set());

  // Close vote box when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest(".vote-box") &&
        !event.target.closest(".existing-tag-btn")
      ) {
        setActiveVoteTag(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleTagVoteClick = (event, tag) => {
    console.log(character);
    event.stopPropagation();
    setActiveVoteTag(activeVoteTag === tag ? null : tag);
  };

  const handleVote = (tag, vote) => {
    // Remove from both sets first
    upvotedTags.delete(tag);
    downvotedTags.delete(tag);

    // Then add to appropriate set based on vote
    if (vote === "up") {
      upvotedTags.add(tag);
    } else if (vote === "down") {
      downvotedTags.add(tag);
    } else if (vote === "neutral") {
      upvotedTags.delete(tag);
      downvotedTags.delete(tag);
    }

    // Force a re-render by setting the state with the same Set
    setUpvotedTags(new Set(upvotedTags));
    setDownvotedTags(new Set(downvotedTags));
    setActiveVoteTag(null);
  };

  const getTagClassName = (tag) => {
    let className = "existing-tag-btn";
    if (upvotedTags.has(tag)) {
      className += " upvoted";
    } else if (downvotedTags.has(tag)) {
      className += " downvoted";
    }
    return className;
  };

  const MAX_TAGS = 6;
  const totalTags = selectedTags.length + customTags.length;

  const handleTagClick = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else if (totalTags < MAX_TAGS) {
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleCustomTagAdd = () => {
    const trimmedTag = customTagInput.trim();
    if (!trimmedTag) {
      setInputError("Tag cannot be empty");
      return;
    }
    if (trimmedTag.length > 8) {
      setInputError("Tag can be at most 8 characters");
      return;
    }
    if (customTags.includes(trimmedTag)) {
      setInputError("Tag already exists");
      return;
    }
    if (totalTags >= MAX_TAGS) {
      setInputError(`You can add at most ${MAX_TAGS} tags`);
      return;
    }
    setCustomTags((prev) => [...prev, trimmedTag]);
    setCustomTagInput("");
    setInputError("");
  };

  const handleCustomTagRemove = (tagToRemove) => {
    setCustomTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCustomTagAdd();
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Submit both selected and custom tags if they exist
      const submitPromises = [];

      if (selectedTags.length > 0) {
        submitPromises.push(submitCharacterTags(character.id, selectedTags));
      }

      if (customTags.length > 0) {
        submitPromises.push(proposeCustomTags(character.id, customTags));
      }

      // Submit tag feedback if there are any votes
      if (upvotedTags.size > 0 || downvotedTags.size > 0) {
        submitPromises.push(
          submitFeedbackTags(character.id, upvotedTags, downvotedTags)
        );
      }

      await Promise.all(submitPromises);

      alert("Thank you for your contribution!");
      onClose();
    } catch (error) {
      console.error("Error submitting tags:", error);
      alert("Submission failed, please try again later");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tagGroups = {
    "Hair Color": [
      "Black Hair",
      "Blonde Hair",
      "Blue Hair",
      "Brown Hair",
      "Silver Hair",
      "Red Hair",
      "Purple Hair",
      "Orange Hair",
      "Green Hair",
      "Pink Hair",
      "Highlights",
      "Two-tone Hair",
      "Rainbow Hair",
      "Multicolor Hair",
      "Yin-Yang Hair",
    ],
    Hairstyle: [
      "Long Straight",
      "Short Hair",
      "Ahoge",
      "Twin Tails",
      "长发",
      "Curly Hair",
      "黑Long Straight",
      "High Ponytail",
      "Ponytail",
      "Braided Hair",
      "Long Sideburns",
      "Straight Bangs",
      "Eye-covering Hair",
      "M-shaped Bangs",
      "Low Twin Tails",
      "Medium-long Hair",
      "Beard",
      "Gradient Hair",
      "Air Inlet Hairstyle",
      "Side Ponytail",
      "Shoulder-length Twin Tails",
      "Center Part",
      "Hime Cut",
      "Side Bangs",
      "Side Part",
      "Double Braids",
      "Low Ponytail",
      "Asymmetric Side Hair",
      "Thick Eyebrows",
      "High Forehead",
      "Long Curly Hair",
      "Bun Hair",
      "Bald",
      "Messy Hair",
      "Double Bun",
      "Long Bangs",
      "Updo",
      "Zigzag Bangs",
      "Tied Long Hair",
      "Single Braid",
      "Slicked-back Hair",
      "Double Helix Hair",
      "Short Bangs",
      "Dead Hair",
      "Two Ahoge",
    ],
    "Eye Color": [
      "Black Eyes",
      "Golden Eyes",
      "Blue Eyes",
      "Brown Eyes",
      "Gray Eyes",
      "Red Eyes",
      "Purple Eyes",
      "Orange Eyes",
      "Green Eyes",
      "Pink Eyes",
      "White",
      "Heterochromia",
      "Gradient Eyes",
      "Rainbow Eyes",
    ],
    Personality: [
      "Energetic",
      "Tsundere",
      "Gentle",
      "Contrasting Moe",
      "Airheaded",
      "Dark Personality",
      "Sharp-tongued",
      "Foolish",
      "Strong-willed",
      "Serious",
      "Quiet",
      "Sadistic",
      "Yandere",
      "Clumsy",
      "Ice Beauty",
      "Little Devil Type",
      "Chuunibyou",
      "Justice-loving",
      "Sans (No Emotions/Traits)",
      "Awkward",
      "Queen (Personality)",
      "Little Angel",
      "Naive",
      "Loyal Dog",
      "Madness",
      "Jealous",
      "Nice Guy",
      "Gunless",
      "Reclusive",
      "Lazy",
      "Masochist",
      "Naturally Dark",
      "Talkative",
      "Violent Girl",
      "Curious",
      "Innocent",
      "Crybaby",
      "Timid",
      "Reliable",
      "Shy",
      "Narcissistic",
      "Naughty",
      "Perverted",
      "Inferior",
      "Materialistic",
      "Naturally Friendly",
      "Quiet and Gentle",
      "Girlish Heart",
      "Hot-blooded",
      "Caring Guy",
      "Slow-witted",
      "Positive",
    ],
    Identity: [
      "High School Student",
      "Young Lady",
      "Honor Student",
      "Genius",
      "Organization Leader",
      "Orphan",
      "Princess",
      "Mixed-race",
      "Junior High Student",
      "University Student",
      "Elementary Student",
      "Minister",
      "Noble",
      "Otaku Girl",
      "Gangster",
      "Transfer Student",
      "Player",
      "BOSS",
      "Queen (Identity)",
      "Young Master",
      "Delinquent",
      "Student",
      "Double Identity",
      "Chinese",
      "Gal",
      "Foreigner",
      "Poor Student",
      "Time-traveler",
      "Monarch",
      "Prince",
      "Exchange Student",
    ],
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}>
          <i class="fas fa-xmark"></i>
        </button>
        <div className="popup-header">
          <h2>Contribute Tags for {character.nameCn}</h2>
        </div>
        <div className="popup-body">
          <div className="tag-contribution-container">
            <div className="character-preview">
              <img
                src={character.image}
                alt={character.name}
                className="character-preview-image"
              />
              <div className="character-preview-info">
                <div className="character-preview-name">{character.name}</div>
                <div className="character-preview-name-cn">
                  {character.nameCn}
                </div>
              </div>
              <div className="existing-tags">
                <h4>Existing Tags</h4>
                <div className="existing-tags-list">
                  {idToTags[character.id]?.map((tag) => (
                    <div key={tag} className="existing-tag-container">
                      <button
                        className={getTagClassName(tag)}
                        onClick={(e) => handleTagVoteClick(e, tag)}
                      >
                        {tag}
                      </button>
                      {activeVoteTag === tag && (
                        <div className="vote-box">
                          <button
                            onClick={() => handleVote(tag, "up")}
                            className="vote-btn"
                          >
                            👍
                          </button>
                          <button
                            onClick={() => handleVote(tag, "neutral")}
                            className="vote-btn"
                          >
                            👐🏼
                          </button>
                          <button
                            onClick={() => handleVote(tag, "down")}
                            className="vote-btn"
                          >
                            👎
                          </button>
                        </div>
                      )}
                    </div>
                  )) || <span className="no-tags">None</span>}
                </div>
              </div>
            </div>
            <div className="tag-input-section">
              <div className="tag-groups">
                {Object.entries(tagGroups).map(([groupName, tags]) => (
                  <div key={groupName} className="tag-group">
                    <h4 className="tag-group-title">{groupName}</h4>
                    <div className="tag-list">
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          className={`tag-suggestion ${
                            selectedTags.includes(tag) ? "selected" : ""
                          } ${
                            totalTags >= MAX_TAGS && !selectedTags.includes(tag)
                              ? "disabled"
                              : ""
                          }`}
                          onClick={() => handleTagClick(tag)}
                          disabled={
                            totalTags >= MAX_TAGS && !selectedTags.includes(tag)
                          }
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="tag-group">
                  <h4 className="tag-group-title">Custom Tags</h4>
                  <div className="custom-tag-input">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add Custom Tag (Max 8 Characters)"
                      maxLength={8}
                      className={inputError ? "has-error" : ""}
                      disabled={totalTags >= MAX_TAGS}
                      style={{
                        backgroundColor: "#ffffff",
                        color: "#000000",
                      }}
                    />
                    <button
                      onClick={handleCustomTagAdd}
                      disabled={totalTags >= MAX_TAGS}
                    >
                      Add
                    </button>
                  </div>
                  {inputError && (
                    <div className="input-error">{inputError}</div>
                  )}
                  {customTags.length > 0 && (
                    <div className="custom-tags-list">
                      {customTags.map((tag) => (
                        <div key={tag} className="custom-tag">
                          <span>{tag}</span>
                          <button onClick={() => handleCustomTagRemove(tag)}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="popup-footer">
          <button
            className="submit-tags-btn"
            disabled={
              (totalTags === 0 &&
                upvotedTags.size === 0 &&
                downvotedTags.size === 0) ||
              isSubmitting
            }
            onClick={handleSubmit}
          >
            {isSubmitting
              ? "Submitting..."
              : `Submit Tags (${totalTags}/${MAX_TAGS})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TagContributionPopup;
