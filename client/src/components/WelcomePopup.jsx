import '../styles/popups.css';
import announcements from '../data/announcements';
import UpdateAnnouncement from './UpdateAnnouncement';
import FeedbackBoard from './FeedbackBoard';

const WELCOME_TEXT = {
  zh: {
    titleMain: '二刺猿笑傳',
    titleSub: '猜猜唄',
    qqTitle: '加入QQ群',
    qqAlt: 'QQ群',
    contact: (
      <b>
        如果您有任何建议或问题，欢迎加入我们的<a href="https://qm.qq.com/q/2sWbSsCwBu" target="_blank" rel="noopener noreferrer">QQ群</a>或<a href="https://github.com/kennylimz/anime-character-guessr/issues/new" target="_blank" rel="noopener noreferrer">提交Issue</a>！
      </b>
    )
  },
  en: {
    titleMain: 'Anime Character',
    titleSub: 'Guessr',
    qqTitle: 'Join QQ Group',
    qqAlt: 'QQ Group',
    contact: (
      <b>
        If you have any suggestions or questions, welcome to join our <a href="https://qm.qq.com/q/2sWbSsCwBu" target="_blank" rel="noopener noreferrer">QQ Group</a> or <a href="https://github.com/kennylimz/anime-character-guessr/issues/new" target="_blank" rel="noopener noreferrer">submit an Issue</a>!
      </b>
    )
  }
};

function WelcomePopup({ onClose, locale = 'zh' }) {
  const text = WELCOME_TEXT[locale] || WELCOME_TEXT.zh;

  return (
    <div className="popup-overlay">
      <div className="popup-content welcome-popup">
        <button className="popup-close" onClick={onClose} aria-label="Close"><i className="fas fa-xmark"></i></button>
        <div className="popup-header welcome-header">
          <div className="welcome-header-inner">
            <div className="title-container">
              <div className="title-line title-line-main" data-text={text.titleMain}>{text.titleMain}</div>
              <div className="title-line title-line-separator" data-text="A N I M E &nbsp; C H A R A C T E R &nbsp; G U E S S R &nbsp;">A N I M E &nbsp; C H A R A C T E R &nbsp; G U E S S R &nbsp;</div>
              <div className="title-line title-line-sub" data-text={text.titleSub}>{text.titleSub}</div>
            </div>

            <div className="title-divider" aria-hidden="true" />

            <div className="welcome-qq">
              <a href="https://qm.qq.com/q/2sWbSsCwBu" target="_blank" rel="noopener noreferrer" title={text.qqTitle}>
                <img src="/assets/qqgroup.png" alt={text.qqAlt} className="welcome-qq-img" />
              </a>
            </div>
          </div>
        </div>
        <div className="popup-body">
          <div className="welcome-content">
            <div className="welcome-text">
              <p style={{ fontSize: '15px', lineHeight: '1.6', margin: '10px 0' }}>{text.contact}</p>
              
              <hr style={{margin: '10px 0', border: '0', borderTop: '1px solid rgba(0,0,0,0.1)'}} />
              
              <FeedbackBoard 
                defaultExpanded={false}
                locale={locale}
              />

              <hr style={{margin: '10px 0', border: '0', borderTop: '1px solid rgba(0,0,0,0.1)'}} />
              
              <UpdateAnnouncement 
                announcements={announcements} 
                defaultExpanded={false}
                initialVisibleCount={1}
                locale={locale}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePopup;
