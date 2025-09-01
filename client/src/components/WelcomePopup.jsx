import "../styles/popups.css";

function WelcomePopup({ onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}>
          <i className="fas fa-xmark"></i>
        </button>
        <div className="popup-header">
          <h2>
            Congratulations to the Shaw Team for winning the 3rd CCB Major!
          </h2>
        </div>
        <div className="popup-header">
          <img
            src="/assets/poster.png"
            alt="3队"
            style={{ width: "auto", height: "500px" }}
          />
        </div>
        <div className="popup-body">
          <div className="welcome-content">
            <div className="welcome-text">
              <p>
                Over a week of the 3rd<b>CCB Major</b>has successfully
                concluded, congratulations to Shaw (<b>Shaw</b> | <b>云霄</b> |{" "}
                <b>中华小当家</b>）获得冠军！
              </p>
              <p>
                Other finalists: Group Seven (<b>鲁迪乌斯</b> | <b>Chelseaaa</b>{" "}
                | <b>Ryo</b>），Cool (<b>doka</b> | <b>V.</b> |{" "}
                <b>表演制造者</b>）
              </p>
              <p>
                Viewers witnessed an unusually intense 100-minute final, where
                the Shaw team fell behind multiple times but bounced back,
                ultimately reaching match point first and claiming the
                championship!
              </p>
              <p>
                <a href="https://www.bilibili.com/video/BV1eyePzBEXC">
                  Final Replay
                </a>
              </p>
              <p>QQ Group：467740403</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePopup;
