import "../styles/popups.css";

function HelpPopup({ onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}>
          <i class="fas fa-xmark"></i>
        </button>
        <div className="popup-header">
          <h2>Why am I here?</h2>
        </div>
        <div className="popup-body">
          <div className="help-content">
            <div className="help-text">
              Guess a mysterious anime character. Search for a character and
              make a guess.
              <br />
              After each guess, you will receive information about the character
              you guessed.
              <br />
              Green highlight: correct or very close; Yellow highlight: somewhat
              close.
              <br />
              "↑": guess higher; "↓": guess lower
              <br />
              <br />
              Found a bug or have suggestions? Feel free to DM me on Bilibili.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpPopup;
