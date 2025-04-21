import '../styles/popups.css';

function HelpPopup({ onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
        <div className="popup-header">
          <h2>为什么我在这里？</h2>
        </div>
        <div className="popup-body">
          <div className="help-content">
            <div className="help-text">
              猜一个神秘动漫角色。搜索角色，然后做出猜测。<br/>
              每次猜测后，你会获得你猜的角色的信息。<br/>
              绿色高亮：正确或非常接近；黄色高亮：有点接近。<br/>
              "↑": 应该往高了猜；"↓": 应该往低了猜<br/>
              <br/>
              有bug或者建议？欢迎B站私信我。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpPopup; 