import React from 'react';
import '../styles/popups.css';

const BgmBlockerPopup = ({ mode, onClose, locale = 'zh' }) => {
  const isEnglish = locale === 'en';

  const handleRedirect = () => {
    // Redirect to the mainland China accelerated endpoint (keeping pathname/hash/search)
    window.location.href = 'https://ccb.baka.website' + window.location.pathname + window.location.search + window.location.hash;
  };

  const text = {
    zh: {
      homeMsg: '注意到您正在使用中国大陆网络访问本端点，将导致无法游玩，请更换网络环境或移步至中国大陆加速端点游玩。',
      gameMsg: '因网络问题无法加载题目，您可能正在使用中国大陆网络访问本端点，请更换网络环境或移步至中国大陆加速端点游玩。',
      ignore: '无视风险，继续游玩',
      retry: '检测有误或我已更换环境',
      redirect: '跳转至中国大陆加速端点'
    },
    en: {
      homeMsg: 'We noticed you are accessing this endpoint from Mainland China, which will cause playability issues. Please change your network or head to the Mainland China accelerated endpoint.',
      gameMsg: 'Failed to load due to network issues. You might be accessing this endpoint from Mainland China. Please change your network or head to the Mainland China accelerated endpoint.',
      ignore: 'Ignore Risk, Continue',
      retry: 'Incorrect Check or Changed Network',
      redirect: 'Go to Accelerated Endpoint'
    }
  }[locale] || {
    homeMsg: '注意到您正在使用中国大陆网络访问本端点，将导致无法游玩，请更换网络环境或移步至中国大陆加速端点游玩。',
    gameMsg: '因网络问题无法加载题目，您可能正在使用中国大陆网络访问本端点，请更换网络环境或移步至中国大陆加速端点游玩。',
    ignore: '无视风险，继续游玩',
    retry: '检测有误或我已更换环境',
    redirect: '跳转至中国大陆加速端点'
  };

  return (
    <div className="popup-overlay" style={{ zIndex: 9999 }}>
      <div className="popup-content welcome-popup" style={{ maxWidth: '480px' }}>
        <button className="popup-close" onClick={onClose} aria-label={isEnglish ? 'Close' : '关闭'}>
          <i className="fas fa-xmark"></i>
        </button>
        
        <div className="popup-header welcome-header" style={{ paddingBottom: '10px' }}>
          <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '22px', margin: '0' }}>
            ⚠️ {isEnglish ? 'Network Advisory' : '网络提示'}
          </h2>
        </div>
        
        <div className="popup-body" style={{ padding: '0 10px 10px 10px' }}>
          <p style={{ margin: '20px 0 30px 0', fontSize: '16.5px', lineHeight: '1.7', color: '#1e293b', fontWeight: '500', textAlign: 'center' }}>
            {mode === 'home' ? text.homeMsg : text.gameMsg}
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              className="submit-tags-btn" 
              onClick={handleRedirect}
              style={{ padding: '12px', fontSize: '15px' }}
            >
              {text.redirect}
            </button>
            <button 
              className="contribute-tag-btn" 
              onClick={onClose}
              style={{ width: '100%', padding: '12px', fontSize: '15px', border: '1px solid #cbd5e1' }}
            >
              {mode === 'home' ? text.ignore : text.retry}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BgmBlockerPopup;
