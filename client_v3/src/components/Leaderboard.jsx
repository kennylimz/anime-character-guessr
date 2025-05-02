import { useState } from 'react';
import '../styles/Leaderboard.css';
import leaderboardCharacters from '../data/leaderboard_characters';

const Leaderboard = ({ defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const characters = leaderboardCharacters;

  // Podium: 2nd, 1st, 3rd (left, center, right)
  const podiumOrder = [characters[1], characters[0], characters[2]];

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header" onClick={toggleExpand}>
        <h3>热门常考真题（截至5.2）</h3>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="leaderboard-content">
          <div className="leaderboard-podium">
            {podiumOrder.map((char) => (
              <div
                className={`podium-place podium-place-${char.rank} ${char.rank === 1 ? 'podium-center' : ''}`}
                key={char.name}
              >
                <img
                  src={char.image}
                  alt={char.name}
                  className={`podium-image${char.rank === 1 ? ' podium-image-center' : ''}`}
                />
                <div className="podium-rank">#{char.rank}</div>
                <a
                  href={char.link}
                  className="podium-name podium-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {char.nameCn || char.name}
                </a>
              </div>
            ))}
          </div>
          <div className="leaderboard-list">
            {characters.slice(3).map((char) => (
              <div className="leaderboard-list-item" key={char.name}>
                <div className="list-rank">#{char.rank}</div>
                {/* Use char.image as grid image for now */}
                <img src={char.image} alt={char.name} className="list-image" />
                <a
                  href={char.link}
                  className="list-name podium-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {char.nameCn || char.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard; 
