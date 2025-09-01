import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import "../styles/Home.css";
import UpdateAnnouncement from "../components/UpdateAnnouncement";
import WelcomePopup from "../components/WelcomePopup";
import announcements from "../data/announcements";

const Home = () => {
  const [roomCount, setRoomCount] = useState(0);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  useEffect(() => {
    const serverUrl = "https://anime-character-guessr.netlify.app";
    fetch(`${serverUrl}/room-count`)
      .then((response) => response.json())
      .then((data) => setRoomCount(data.count))
      .catch((error) => console.error("Error fetching room count:", error));

    // Show welcome popup when component mounts
    setShowWelcomePopup(true);
  }, []);

  const handleCloseWelcomePopup = () => {
    setShowWelcomePopup(false);
  };

  return (
    <div className="home-container">
      {showWelcomePopup && <WelcomePopup onClose={handleCloseWelcomePopup} />}

      <div className="game-modes">
        <Link to="/singleplayer" className="mode-button">
          <h2>Single Player</h2>
        </Link>
        <Link to="/multiplayer" className="mode-button">
          <h2>Multiplayer</h2>
          <small>Current Room Count: {roomCount}/259</small>
        </Link>
      </div>

      <UpdateAnnouncement
        announcements={announcements}
        defaultExpanded={false}
        initialVisibleCount={1}
      />

      <div className="home-footer">
        <p>
          A website for guessing anime/game characters, It is recommended to use
          a desktop browser to play.
          <br />
          <a href="https://www.bilibili.com/video/BV14CVRzUELs">
            Gameplay introduction video
          </a>
          ，Inspired by<a href="https://blast.tv/counter-strikle"> BLAST.tv </a>
          , Data source<a href="https://bgm.tv/"> Bangumi </a>。<br />
          <a href="https://space.bilibili.com/87983557">@Author</a>："Thanks to{" "}
          <a href="https://github.com/trim21">Bangumi 管理员</a> for
          optimization support， as well as{" "}
          <a href="https://github.com/kennylimz/anime-character-guessr/graphs/contributors">
            everyone’s
          </a>{" "}
          contributions of code and data. Thank you all for your enthusiasm and
          support during this time."
          <br />
          Want to find friends to play together?QQ-Group：467740403
          <br />
          Author’s new toy:：
          <a href="https://www.bilibili.com/video/BV1MstxzgEhg/">
            A desktop widget
          </a>
        </p>
      </div>
    </div>
  );
};

export default Home;
