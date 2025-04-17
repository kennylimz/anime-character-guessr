import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SinglePlayer from './pages/SinglePlayer';
import Multiplayer from './pages/Multiplayer';
import RoomManager from './pages/RoomManager';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/singleplayer" element={<SinglePlayer />} />
        <Route path="/multiplayer" element={<RoomManager />} />
        <Route path="/multiplayer/:roomId" element={<Multiplayer />} />
      </Routes>
    </Router>
  );
}

export default App;
