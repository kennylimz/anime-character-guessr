import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import SinglePlayer from './pages/SinglePlayer';
import Multiplayer from './pages/Multiplayer';
import BgmBlockerPopup from './components/BgmBlockerPopup';

const PAGE_TITLES = {
  zh: '二刺猿笑传之猜猜呗',
  en: 'Anime Character Guessr'
};

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    const isEnglish = location.pathname === '/en' || new URLSearchParams(location.search).get('lang') === 'en';
    document.title = isEnglish ? PAGE_TITLES.en : PAGE_TITLES.zh;
  }, [location.pathname, location.search]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/en" element={<Home locale="en" />} />
      <Route path="/singleplayer" element={<SinglePlayer />} />
      <Route path="/multiplayer" element={<Multiplayer />} />
      <Route path="/multiplayer/:roomId" element={<Multiplayer />} />
    </Routes>
  );
}

function App() {
  const [blockerMode, setBlockerMode] = useState(null); // 'home' or 'game' or null

  useEffect(() => {
    const handleGameBlock = () => setBlockerMode('game');
    const handleHomeBlock = () => setBlockerMode('home');
    
    window.addEventListener('bgm-api-blocked', handleGameBlock);
    window.addEventListener('bgm-api-blocked-home', handleHomeBlock);
    
    return () => {
      window.removeEventListener('bgm-api-blocked', handleGameBlock);
      window.removeEventListener('bgm-api-blocked-home', handleHomeBlock);
    };
  }, []);

  return (
    <Router>
      <AppRoutes />
      {blockerMode && (
        <BgmBlockerPopup 
          mode={blockerMode} 
          onClose={() => setBlockerMode(null)} 
          locale={window.location.pathname.startsWith('/en') || new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'zh'}
        />
      )}
    </Router>
  );
}

export default App;
