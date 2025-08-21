import '../styles/popups.css';

function WelcomePopup({ onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}><i className="fas fa-xmark"></i></button>
        <div className="popup-header">
          <h2>恭喜 老鸨组 获得第三届CCBMajor冠军！</h2>
        </div>
        <div className="popup-header">
            <img src="/assets/poster.png" alt="3队" style={{width: 'auto', height: '500px'}} />
        </div>
        <div className="popup-body">
          <div className="welcome-content">
            <div className="welcome-text">
              <p>一周多的第三届<b>CCB Major</b>已经圆满落幕，恭喜老鸨（<b>Shaw</b> | <b>云霄</b> | <b>中华小当家</b>）获得冠军！</p>
              <p>其他决赛圈选手：七组（<b>鲁迪乌斯</b> | <b>Chelseaaa</b> | <b>Ryo</b>），凉（<b>doka</b> | <b>V.</b> | <b>表演制造者</b>）</p>
              <p>直播间的观众们见证了一场长达100分钟的异常黏稠的决赛，老鸨组几度落后又几度黏住，最终率先取得赛点并夺冠！</p>
              <p><a href="https://www.bilibili.com/video/BV1eyePzBEXC">决赛录播</a></p>
              <p>QQ群：467740403</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePopup;
