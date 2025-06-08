import { useState } from 'react';
import '../styles/Leaderboard.css';
import leaderboardCharacters from '../data/leaderboard_characters';
import weeklyCharacters from '../data/leaderboard_characters_weekly';

const Leaderboard = ({ defaultExpanded = false }) => {
  const [isExpanded1, setIsExpanded1] = useState(defaultExpanded);
  const [isExpanded2, setIsExpanded2] = useState(defaultExpanded);

  const characters1 = weeklyCharacters;
  const characters2 = leaderboardCharacters;

  // Podium: 2nd, 1st, 3rd (left, center, right)
  const podiumOrder1 = [characters1[1], characters1[0], characters1[2]];
  const podiumOrder2 = [characters2[1], characters2[0], characters2[2]];

  const toggleExpand1 = () => setIsExpanded1((prev) => !prev);
  const toggleExpand2 = () => setIsExpanded2((prev) => !prev);

  return (
    <>
      <div className="leaderboard-container">
        <div className="leaderboard-header" onClick={toggleExpand1}>
          <h3>热门出题角色周榜（5.26-6.8）</h3>
          <span>奶龙王朝了😅</span>
          <span className={`expand-icon ${isExpanded1 ? 'expanded' : ''}`}>{isExpanded1 ? '▼' : '▶'}</span>
        </div>
        {isExpanded1 && (
          <div className="leaderboard-content">
            <div className="leaderboard-podium">
              {podiumOrder1.map((char) => (
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
              {characters1.slice(3).map((char) => (
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
      <div className="leaderboard-container">
        <div className="leaderboard-header" onClick={toggleExpand2}>
          <h3>热门出题角色总榜（截至6.8）</h3>
          <span className={`expand-icon ${isExpanded2 ? 'expanded' : ''}`}>{isExpanded2 ? '▼' : '▶'}</span>
        </div>
        {isExpanded2 && (
          <div className="leaderboard-content">
            <div className="leaderboard-podium">
              {podiumOrder2.map((char) => (
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
              {characters2.slice(3).map((char) => (
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
    </>
  );
};

export default Leaderboard; 
