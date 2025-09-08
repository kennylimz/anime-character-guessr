import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import '../styles/Home.css';
import UpdateAnnouncement from '../components/UpdateAnnouncement';
import WelcomePopup from '../components/WelcomePopup';
import announcements from '../data/announcements';

const Home = () => {
  const [roomCount, setRoomCount] = useState(0);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    fetch(`${serverUrl}/room-count`)
      .then(response => response.json())
      .then(data => setRoomCount(data.count))
      .catch(error => console.error('Error fetching room count:', error));
    
    // Show welcome popup when component mounts
    setShowWelcomePopup(true);
  }, []);

  const handleCloseWelcomePopup = () => {
    setShowWelcomePopup(false);
  };

  return (
    <div className="home-container">
      {showWelcomePopup && (
        <WelcomePopup onClose={handleCloseWelcomePopup} />
      )}
      
      <div className="game-modes">
        <Link to="/singleplayer" className="mode-button">
          <h2>单人</h2>
        </Link>
        <Link to="/multiplayer" className="mode-button">
          <h2>多人</h2>
          <small>当前房间数: {roomCount}/259</small>
        </Link>
      </div>
      
      <UpdateAnnouncement 
        announcements={announcements} 
        defaultExpanded={false}
        initialVisibleCount={1}
      />
      
      <div className="home-footer">
        <p>
          <a href="https://vertikarl.github.io/anime-character-guessr-english/"> ENGLISH ver. </a>
          <br/>
          一个猜动漫/游戏角色的网站，建议使用桌面端浏览器游玩。
          <br/>
          <a href="https://www.bilibili.com/video/BV14CVRzUELs">玩法简介视频</a>，灵感来源<a href="https://blast.tv/counter-strikle"> BLAST.tv </a>,
          数据来源<a href="https://bgm.tv/"> Bangumi </a>。<br />
          <a href="https://space.bilibili.com/87983557">@作者</a>："感谢 <a href="https://github.com/trim21">Bangumi 管理员</a> 的优化支持，
          以及各位<a href="https://github.com/kennylimz/anime-character-guessr/graphs/contributors">网友</a>贡献的代码和数据。
          感谢大家这段时间的热情和支持。"<br/>
          想找朋友一起玩？QQ群：467740403<br/>
          作者的新玩具：<a href="https://www.bilibili.com/video/BV1MstxzgEhg/">一个桌面挂件</a>
        </p>
      </div>
    </div>
  );
};

export default Home; 
