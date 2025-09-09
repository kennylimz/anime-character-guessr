import { useState, useEffect } from 'react';
import '../styles/Roulette.css';
import axios from 'axios';

const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const Roulette = ({ defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [flipped, setFlipped] = useState(Array(10).fill(false));
  const [selected, setSelected] = useState(null);
  const [rouletteData, setRouletteData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialAvatarId, setInitialAvatarId] = useState(() => {
    return sessionStorage.getItem('avatarId') !== null;
  });
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (isExpanded && rouletteData.length === 0) {
      setLoading(true);
      axios.get(`${serverUrl}/roulette`)
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

  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      alert('请输入兑换码');
      return;
    }

    setRedeeming(true);
    try {
      const response = await axios.get(`${serverUrl}/redeem?code=${encodeURIComponent(redeemCode.trim())}`);
      
      if (response.data.avatarId && response.data.avatarImage) {
        sessionStorage.setItem('avatarId', response.data.avatarId);
        sessionStorage.setItem('avatarImage', response.data.avatarImage);
        
        // Reset states
        setSelected(null);
        setRedeemCode('');
        
        alert('兑换成功！');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        alert('兑换码无效或已过期');
      } else {
        alert('兑换失败，请稍后重试');
      }
      console.error('Redeem error:', error);
    } finally {
      setRedeeming(false);
    }
  };

  const handleCardClick = (idx) => {
    if (!flipped[idx]) {
      // Flip the card if not already flipped
      setSelected(idx);
      if (rouletteData[idx] && rouletteData[idx].id !== undefined) {
        sessionStorage.setItem('avatarId', rouletteData[idx].id);
        sessionStorage.setItem('avatarImage', rouletteData[idx].image_grid);
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
        sessionStorage.setItem('avatarId', rouletteData[idx].id);
        sessionStorage.setItem('avatarImage', rouletteData[idx].image_grid);
      }
    }
  };

  return (
    <div className="roulette-container">
      <div className="roulette-header" onClick={toggleExpand}>
        <h3>莫名其妙的抽卡</h3>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="roulette-content">
          <div className="roulette-textfield">
            可以挑一个头像（当然也可以直接进游戏）
          </div>
          {loading ? (
            <div>加载中...</div>
          ) : error ? (
            <div style={{ color: 'red' }}>{error}</div>
          ) : (
            initialAvatarId && selected === null ? (
              <div className="roulette-textfield">
                你已经抽过了……
              </div>
            ) : 
            (
              <div className="roulette-card-grid">
                {rouletteData.map((char, idx) => {
                  return (
                    <div
                      className={`roulette-card tier-${char.tier} ${flipped[idx] ? ' flipped' : ''}${selected === idx ? ' selected' : ''}`}
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
            )
          )}
          {initialAvatarId && selected === null ? null : (
            <button className="roulette-cancel-btn" onClick={() => {
              setSelected(null);
              sessionStorage.setItem('avatarId', 0);
            }}>
              取消选择
            </button>
          )}
          <div className="roulette-exchange-section">
            <input 
              type="text" 
              placeholder="头像兑换码" 
              className="roulette-exchange-input"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRedeem()}
              disabled={redeeming}
            />
            <button 
              className="roulette-exchange-btn"
              onClick={handleRedeem}
              disabled={redeeming}
            >
              {redeeming ? '兑换中...' : '兑换'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roulette;

