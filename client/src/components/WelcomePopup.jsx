import "../styles/popups.css";
import SearchBar from "./SearchBar";
import banner from "../../public/assets/welcome-banner.svg";

function WelcomePopup({ onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}>
          <i className="fas fa-xmark"></i>
        </button>
        <div className="popup-header">
          <h2>
            Welcome to the translation project for anime character guessr!
          </h2>
        </div>
        <div className="popup-header">
          <img
            src={banner}
            alt="welcome"
            style={{ width: "auto", height: "500px" }}
          />
        </div>
        <div className="popup-body">
          <div className="welcome-content">
            <div className="welcome-text">
              <p>
                This project focuses on translating the game originally
                developed by{" "}
                <a href="https://github.com/kennylimz">kennylimz</a> into
                english and beyond! 🚀
              </p>
              <p>
                It is still very early in development, so expect bugs and wrong
                translations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePopup;
