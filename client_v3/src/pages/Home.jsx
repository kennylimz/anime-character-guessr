import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import '../styles/Home.css';

const Home = () => {
  const [roomCount, setRoomCount] = useState(0);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    fetch(`${serverUrl}/room-count`)
      .then(response => response.json())
      .then(data => setRoomCount(data.count))
      .catch(error => console.error('Error fetching room count:', error));
  }, []);

  return (
    <div className="home-container">
      <div className="game-modes">
        <Link to="/singleplayer" className="mode-button">
          <h2>单人</h2>
        </Link>
        <Link to="/multiplayer" className="mode-button">
          <h2>多人</h2>
          <small>当前房间数: {roomCount}/259</small>
        </Link>
      </div>
      <div className="home-footer">
        <p>
          一个猜动漫角色的游戏,
          建议使用桌面端浏览器游玩。
          <br/>
          灵感来源<a href="https://blast.tv/counter-strikle"> BLAST.tv </a>,
          数据来源<a href="https://bgm.tv/"> Bangumi </a>。<br />
          <a href="https://space.bilibili.com/87983557">@作者</a>：“感谢 Bangumi 管理员的优化支持，以及各位网友贡献的代码。感谢大家这段时间的热情和支持。”<br/>
          角色标签有大佬帮忙持续更新，<b>已可对现有角色标签投票</b>。<br/>
          有好的预设或目录可以B站私信<a href="https://space.bilibili.com/87983557">作者</a>，可能被采纳成为每日推荐或者常驻预设。<br/>
          想加入一个童年回忆的主题……
        </p>
      </div>
    </div>
  );
};

export default Home; 
