import '../styles/popups.css';

const HELP_TEXT = {
  zh: {
    title: '为什么我在这里？',
    body: (
      <>
        猜一个神秘动漫角色。搜索角色，然后做出猜测。<br/>
        每次猜测后，你会获得你猜的角色的信息。<br/>
        绿色高亮：正确或非常接近；黄色高亮：有点接近。<br/>
        "↑": 应该往高了猜；"↓": 应该往低了猜<br/>
        <br/>
        有bug或者建议？欢迎B站私信我。
      </>
    )
  },
  en: {
    title: 'Why am I here?',
    body: (
      <>
        Guess the mystery anime character. Search for a character, then submit a guess.<br/>
        After each guess, you will see information about the character you guessed.<br/>
        Green means correct or very close; yellow means somewhat close.<br/>
        "↑" means guess higher; "↓" means guess lower.<br/>
        <br/>
        Some tags comes in Chinese, please use the translation of your browser.
      </>
    )
  }
};

function HelpPopup({ onClose, locale = 'zh' }) {
  const text = HELP_TEXT[locale] || HELP_TEXT.zh;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}><i className="fas fa-xmark"></i></button>
        <div className="popup-header">
          <h2>{text.title}</h2>
        </div>
        <div className="popup-body">
          <div className="help-content">
            <div className="help-text">
              {text.body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpPopup; 
