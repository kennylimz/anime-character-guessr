import { useState, useEffect } from 'react';
import '../styles/Roulette.css';
import axios from 'axios';
import { fixImageUrl } from '../utils/imageUrl.js';

const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const ROULETTE_TEXT = {
  zh: {
    title: '莫名其妙的抽卡',
    description: '可以挑一个头像（当然也可以直接进游戏）',
    loading: '加载中...',
    alreadyPicked: '你已经抽过了……',
    cancel: '取消选择',
    redeemPlaceholder: '头像兑换码',
    redeeming: '兑换中...',
    redeem: '兑换',
    enterCode: '请输入兑换码',
    redeemSuccess: '兑换成功！',
    invalidCode: '兑换码无效或已过期',
    redeemFailed: '兑换失败，请稍后重试'
  },
  en: {
    title: 'Avatar Draw',
    description: 'Pick an avatar, or just enter the game.',
    loading: 'Loading...',
    alreadyPicked: 'You already picked one...',
    cancel: 'Clear selection',
    redeemPlaceholder: 'Avatar redeem code',
    redeeming: 'Redeeming...',
    redeem: 'Redeem',
    enterCode: 'Please enter a redeem code',
    redeemSuccess: 'Redeemed successfully.',
    invalidCode: 'The redeem code is invalid or expired',
    redeemFailed: 'Redeem failed. Please try again later.'
  }
};

const Roulette = ({ defaultExpanded = false, locale = 'zh' }) => {
  const text = ROULETTE_TEXT[locale] || ROULETTE_TEXT.zh;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [flipped, setFlipped] = useState(Array(10).fill(false));
  const [selected, setSelected] = useState(null);
  const [rouletteData, setRouletteData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialAvatarId] = useState(() => {
    return sessionStorage.getItem('avatarId') !== null;
  });
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (isExpanded && rouletteData.length === 0) {
      setLoading(true);
      axios.get(`${serverUrl}/api/roulette`)
        .then((res) => {
          const data = (res.data || []).map(char => ({
            ...char,
            image_medium: fixImageUrl(char.image_medium),
            image_grid: fixImageUrl(char.image_grid)
          }));
          setRouletteData(data);
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
      alert(text.enterCode);
      return;
    }

    setRedeeming(true);
    try {
      const response = await axios.get(`${serverUrl}/api/redeem?code=${encodeURIComponent(redeemCode.trim())}`);

      if (response.data.avatarId && response.data.avatarImage) {
        sessionStorage.setItem('avatarId', response.data.avatarId);
        sessionStorage.setItem('avatarImage', response.data.avatarImage);

        setSelected(null);
        setRedeemCode('');

        alert(text.redeemSuccess);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        alert(text.invalidCode);
      } else {
        alert(text.redeemFailed);
      }
      console.error('Redeem error:', error);
    } finally {
      setRedeeming(false);
    }
  };

  const handleCardClick = (idx) => {
    if (!flipped[idx]) {
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
        <h3>{text.title}</h3>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>{isExpanded ? '▼' : '▶'}</span>
      </div>
      {isExpanded && (
        <div className="roulette-content">
          <div className="roulette-textfield">
            {text.description}
          </div>
          {loading ? (
            <div>{text.loading}</div>
          ) : error ? (
            <div style={{ color: 'red' }}>{error}</div>
          ) : (
            initialAvatarId && selected === null ? (
              <div className="roulette-textfield">
                {text.alreadyPicked}
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
              {text.cancel}
            </button>
          )}
          <div className="roulette-exchange-section">
            <input
              type="text"
              placeholder={text.redeemPlaceholder}
              className="roulette-exchange-input"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
              disabled={redeeming}
            />
            <button
              className="roulette-exchange-btn"
              onClick={handleRedeem}
              disabled={redeeming}
            >
              {redeeming ? text.redeeming : text.redeem}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roulette;
