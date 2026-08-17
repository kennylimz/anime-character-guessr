import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import SinglePlayer from './pages/SinglePlayer';
import Multiplayer from './pages/Multiplayer';

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
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
