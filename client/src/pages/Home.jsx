import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import '../styles/Home.css';
import WelcomePopup from '../components/WelcomePopup';

const HOME_TEXT = {
  zh: {
    singleplayer: '单人',
    multiplayer: '多人',
    roomCount: '当前房间数',
    showAnnouncements: '显示公告',
    status: '服务状态',
    howToPlay: '玩法简介',
    repository: 'GitHub仓库',
    qqGroup: '加入QQ群',
    newToy: '作者的新玩具',
    description: '一个猜动漫/游戏角色的网站，建议使用桌面端浏览器游玩',
    inspiredBy: '灵感来源',
    dataSource: '数据来源',
    languageLabel: '语言',
    chinese: '中文',
    english: 'English'
  },
  en: {
    singleplayer: 'Singleplayer',
    multiplayer: 'Multiplayer',
    roomCount: 'Active rooms',
    dataSource: 'Data from',
    bangumi: 'Bangumi',
    tagTranslationNote: 'Some parts are not translated. Please use the translation feature of your browser.',
    languageLabel: 'Language',
    chinese: '中文',
    english: 'English'
  }
};

const Home = ({ locale = 'zh' }) => {
  const isEnglish = locale === 'en';
  const text = HOME_TEXT[locale] || HOME_TEXT.zh;
  const [roomCount, setRoomCount] = useState(0);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_BGM_API_URL || 'https://api.bgm.tv';
    if (!apiBaseUrl.startsWith('https://api.bgm.tv')) return;

    let mountTimeoutId;
    let fetchTimeoutId;
    const controller = new AbortController();

    const startTest = () => {
      fetchTimeoutId = setTimeout(() => controller.abort(), 5000);

      fetch(`https://api.bgm.tv/v0/characters/132476?t=${Date.now()}`, { 
        cache: 'no-store',
        signal: controller.signal
      })
        .then(() => clearTimeout(fetchTimeoutId))
        .catch(error => {
          clearTimeout(fetchTimeoutId);
          const isConnectionClosed = 
            error?.name === 'AbortError' || 
            error?.message?.includes('Connection Closed') || 
            error?.code === 'ERR_CONNECTION_CLOSED' || 
            error?.code === 'ERR_CONNECTION_TIMED_OUT' ||
            String(error).includes('Connection Closed') || 
            String(error).includes('ERR_CONNECTION_CLOSED') || 
            String(error).includes('ERR_CONNECTION_TIMED_OUT') ||
            String(error).toLowerCase().includes('closed') ||
            String(error).toLowerCase().includes('timeout') ||
            String(error).toLowerCase().includes('timed out') ||
            String(error).toLowerCase().includes('failed to fetch');
          
          if (isConnectionClosed) {
            window.dispatchEvent(new CustomEvent('bgm-api-blocked-home'));
          }
        });
    };

    // Delay 100ms to ensure App's event listeners are fully mounted and active
    mountTimeoutId = setTimeout(startTest, 100);

    return () => {
      clearTimeout(mountTimeoutId);
      clearTimeout(fetchTimeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || '';
    let mounted = true;

    const fetchRoomCount = () => {
      fetch(`${serverUrl}/room-count`)
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch');
          return response.json();
        })
        .then(data => { if (mounted) setRoomCount(data.count); })
        .catch(error => console.error('Error fetching room count:', error));
    };

    // initial fetch
    fetchRoomCount();
    // refresh every 5 seconds
    const intervalId = setInterval(fetchRoomCount, 5000);

    if (!isEnglish) {
      setShowWelcomePopup(true);
    }

    return () => { mounted = false; clearInterval(intervalId); };
  }, [isEnglish]);

  const handleCloseWelcomePopup = () => {
    setShowWelcomePopup(false);
  };

  if (isEnglish) {
    return (
      <div className="home-container home-container-en" lang="en" translate="no">
        <div className="language-switch" aria-label={text.languageLabel}>
          <Link to="/" className="language-option">{text.chinese}</Link>
          <Link to="/en" className="language-option active">{text.english}</Link>
        </div>

        <div className="center-block center-block-en">
          <div className="game-modes game-modes-en">
            <Link to="/singleplayer?lang=en" className="mode-button">
              <h2>{text.singleplayer}</h2>
            </Link>
            <Link to="/multiplayer?lang=en" className="mode-button">
              <h2>{text.multiplayer}</h2>
              <small>{text.roomCount}: {roomCount}</small>
            </Link>
          </div>
          <p className="home-data-source">
            {text.dataSource}{' '}
            <a href="https://bgm.tv/" target="_blank" rel="noopener noreferrer">
              {text.bangumi}
            </a>
          </p>
          <p className="home-tag-note">{text.tagTranslationNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container" lang="zh-CN" translate="no">
      <div className="language-switch" aria-label={text.languageLabel}>
        <Link to="/" className="language-option active">{text.chinese}</Link>
        <Link to="/en" className="language-option">{text.english}</Link>
      </div>

      {showWelcomePopup && (
        <WelcomePopup onClose={handleCloseWelcomePopup} locale={locale} />
      )}

      <div className="center-block">
      <div className="game-modes">
        <Link to="/singleplayer" className="mode-button">
          <h2>{text.singleplayer}</h2>
        </Link>
        <Link to="/multiplayer" className="mode-button">
          <h2>{text.multiplayer}</h2>
          <small>{text.roomCount}: {roomCount}</small>
        </Link>
      </div>
      </div>

      <div className="home-footer">
        <div className="button-group-grid">
          <a
            href="#"
            className="fotter-btn"
            onClick={e => { e.preventDefault(); setShowWelcomePopup(true); }}
          >
            <i className="fas fa-bullhorn" style={{marginRight: '8px'}}></i>{text.showAnnouncements}
          </a>
          <a
            href="https://status.baka.website/status/ccb"
            target="_blank"
            rel="noopener noreferrer"
            className="fotter-btn"
          >
            <i className="fas fa-server" style={{marginRight: '8px'}}></i>{text.status}
          </a>
          <a 
            href="https://www.bilibili.com/video/BV14CVRzUELs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="fotter-btn"
          >
            <i className="fab fa-bilibili" style={{marginRight: '8px'}}></i>{text.howToPlay}
          </a>
          <a 
            href="https://github.com/kennylimz/anime-character-guessr" 
            target="_blank" 
            rel="noopener noreferrer"
            className="fotter-btn"
          >
            <i className="fab fa-github" style={{marginRight: '8px'}}></i>{text.repository}
          </a>
          <a 
            href="https://qm.qq.com/q/2sWbSsCwBu" 
            target="_blank" 
            rel="noopener noreferrer"
            className="fotter-btn"
          >
            <i className="fab fa-qq" style={{marginRight: '8px'}}></i>{text.qqGroup}
          </a>
          <a 
            href="https://www.bilibili.com/video/BV1MstxzgEhg/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="fotter-btn"
          >
            <i className="fas fa-desktop" style={{marginRight: '8px'}}></i>{text.newToy}
          </a>
        </div>
        <p>
          {/* <a href="https://vertikarl.github.io/anime-character-guessr-english/"> ENGLISH ver. </a> */}
          {text.description}
          <br/>
          {text.inspiredBy}<a href="https://blast.tv/counter-strikle"> BLAST.tv </a> &nbsp;
          {text.dataSource}<a href="https://bgm.tv/"> Bangumi </a>
        </p>
      </div>
    </div>
  );
};

export default Home;
