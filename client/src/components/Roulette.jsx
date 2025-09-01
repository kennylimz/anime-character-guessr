import { useState, useEffect } from "react";
import "../styles/Roulette.css";
import axios from "axios";

const serverUrl = "https://anime-character-guessr.netlify.app";

const Roulette = ({ defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [flipped, setFlipped] = useState(Array(10).fill(false));
  const [selected, setSelected] = useState(null);
  const [rouletteData, setRouletteData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialAvatarId, setInitialAvatarId] = useState(() => {
    return sessionStorage.getItem("avatarId") !== null;
  });

  useEffect(() => {
    if (isExpanded && rouletteData.length === 0) {
      setLoading(true);
      axios
        .get(`${serverUrl}/roulette`)
        .then((res) => {
          setRouletteData(res.data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isExpanded, rouletteData.length]);

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  const handleCardClick = (idx) => {
    if (!flipped[idx]) {
      // Flip the card if not already flipped
      setSelected(idx);
      if (rouletteData[idx] && rouletteData[idx].id !== undefined) {
        sessionStorage.setItem("avatarId", rouletteData[idx].id);
        sessionStorage.setItem("avatarImage", rouletteData[idx].image_grid);
      }
      setFlipped((prev) => {
        const next = [...prev];
        next[idx] = true;
        return next;
      });
    } else {
      // Select the card if already flipped
      setSelected(idx);
      if (rouletteData[idx] && rouletteData[idx].id !== undefined) {
        sessionStorage.setItem("avatarId", rouletteData[idx].id);
        sessionStorage.setItem("avatarImage", rouletteData[idx].image_grid);
      }
    }
  };

  return (
    <div className="roulette-container">
      <div className="roulette-header" onClick={toggleExpand}>
        <h3>Random Avatar Draw</h3>
        <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
          {isExpanded ? "▼" : "▶"}
        </span>
      </div>
      {isExpanded && (
        <div className="roulette-content">
          <div className="roulette-textfield">
            You can pick an avatar (or just enter the game)
          </div>
          {loading ? (
            <div>Loading...</div>
          ) : error ? (
            <div style={{ color: "red" }}>{error}</div>
          ) : initialAvatarId && selected === null ? (
            <div className="roulette-textfield">You have already drawn…</div>
          ) : (
            <div className="roulette-card-grid">
              {rouletteData.map((char, idx) => {
                return (
                  <div
                    className={`roulette-card tier-${char.tier} ${
                      flipped[idx] ? " flipped" : ""
                    }${selected === idx ? " selected" : ""}`}
                    key={char.id}
                    onClick={() => handleCardClick(idx)}
                  >
                    <div className="roulette-card-inner">
                      <div className="roulette-card-front" />
                      <div className="roulette-card-back">
                        <img
                          src={char.image_medium}
                          alt="avatar"
                          className="roulette-card-img"
                        />
                      </div>
                    </div>
                    {/* Bottom corners for selected style */}
                    {selected === idx && (
                      <>
                        <div className="corner bl" />
                        <div className="corner br" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {initialAvatarId && selected === null ? null : (
            <button
              className="roulette-cancel-btn"
              onClick={() => {
                setSelected(null);
                sessionStorage.setItem("avatarId", 0);
              }}
            >
              Cancel Selection
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Roulette;
