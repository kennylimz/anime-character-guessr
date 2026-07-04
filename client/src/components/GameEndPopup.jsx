import '../styles/popups.css';
import subaruIcon from '/assets/subaru.jpg';
import { useState } from 'react';
import TagContributionPopup from './TagContributionPopup';
import { idToTags } from '../data/id_tags';

function renderSummaryWithTags(summary, text) {
  if (!summary || typeof summary !== 'string') return summary;

  const nodes = [];
  let i = 0;
  let key = 0;

  const pushText = (text) => {
    if (!text) return;
    nodes.push(<span key={`t-${key++}`}>{text}</span>);
  };

  while (i < summary.length) {
    const nextMask = summary.indexOf('[mask]', i);
    const nextUrl = summary.indexOf('[url=', i);
    const candidates = [nextMask, nextUrl].filter((n) => n !== -1);
    const next = candidates.length ? Math.min(...candidates) : -1;

    if (next === -1) {
      pushText(summary.slice(i));
      break;
    }

    if (next > i) {
      pushText(summary.slice(i, next));
    }

    // [mask]...[/mask]
    if (next === nextMask) {
      const start = next + '[mask]'.length;
      const end = summary.indexOf('[/mask]', start);
      if (end === -1) {
        // 不完整标签：按纯文本处理剩余内容
        pushText(summary.slice(next));
        break;
      }
      const inner = summary.slice(start, end);
      nodes.push(
        <span
          key={`m-${key++}`}
          className="summary-mask"
          tabIndex={0}
          aria-label={text.maskAriaLabel}
          title={text.maskTitle}
        >
          {inner}
        </span>
      );
      i = end + '[/mask]'.length;
      continue;
    }

    // [url=https://...]text[/url]
    if (next === nextUrl) {
      const closeBracket = summary.indexOf(']', next);
      if (closeBracket === -1) {
        pushText(summary.slice(next));
        break;
      }
      const urlRaw = summary.slice(next + '[url='.length, closeBracket).trim();
      const end = summary.indexOf('[/url]', closeBracket + 1);
      if (end === -1) {
        pushText(summary.slice(next));
        break;
      }
      const label = summary.slice(closeBracket + 1, end);
      const isSafeHttp = /^https?:\/\//i.test(urlRaw);
      if (isSafeHttp) {
        nodes.push(
          <a
            key={`u-${key++}`}
            className="summary-link"
            href={urlRaw}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        );
      } else {
        // 非 http(s) 链接：降级为纯文本，避免注入
        pushText(label);
      }
      i = end + '[/url]'.length;
      continue;
    }

    // 兜底：避免死循环
    pushText(summary.slice(next, next + 1));
    i = next + 1;
  }

  return nodes;
}

const GAME_END_TEXT = {
  zh: {
    win: '🎉 给你猜对了，有点东西',
    lose: '😢 已经结束咧',
    contributeTags: '贡献标签',
    reportBug: '反馈Bug',
    appearances: '出演作品：',
    moreWorks: (count) => `...等 ${count} 部作品`,
    tags: '角色标签：',
    summary: '角色简介：',
    maskAriaLabel: '隐藏内容，悬停或聚焦以显示',
    maskTitle: '悬停显示'
  },
  en: {
    win: '🎉 Correct. Good job.',
    lose: '😢 Game over.',
    contributeTags: 'Contribute Tags',
    reportBug: 'Report Bug',
    appearances: 'Appearances:',
    moreWorks: (count) => `... (${count} subjects total)`,
    tags: 'Tags:',
    summary: 'Intro:',
    maskAriaLabel: 'Hidden content. Hover or focus to reveal.',
    maskTitle: 'Hover to reveal'
  }
};

function GameEndPopup({ result, answer, onClose, locale = 'zh' }) {
  const text = GAME_END_TEXT[locale] || GAME_END_TEXT.zh;
  const [showTagPopup, setShowTagPopup] = useState(false);

  if (showTagPopup) {
    return (
      <TagContributionPopup
        character={answer}
        locale={locale}
        onClose={() => {
          setShowTagPopup(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}><i className="fas fa-xmark"></i></button>
        <div className="popup-header">
          <h2>{result === 'win' ? text.win : text.lose}</h2>
        </div>
        <div className="popup-body">
          <div className="answer-character">
            <img
              src={answer.image}
              alt={answer.name}
              className="answer-character-image"
            />
            <div className="answer-character-info">
              <div className="character-name-container">
                <a
                  href={`https://bgm.tv/character/${answer.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="character-link"
                  style={{ display: 'block', textAlign: 'left' }}
                >
                  <div className="answer-character-name" style={{ textAlign: 'left' }} translate="no">{answer.name}</div>
                  <div className={locale === 'en' ? 'answer-character-name-en' : 'answer-character-name-cn'} style={{ textAlign: 'left' }}>
                    {locale === 'en' && answer.nameEn && answer.nameEn !== answer.nameCn ? (
                      <span translate="no">{answer.nameEn}</span>
                    ) : (
                      <span>{locale === 'en' ? (answer.nameEn || answer.nameCn) : answer.nameCn}</span>
                    )}
                  </div>
                </a>
                <div className="button-container">
                  <div className="button-group-vertical">
                    <button
                      className="contribute-tag-btn"
                      onClick={() => setShowTagPopup(true)}
                    >
                      {text.contributeTags}
                    </button>
                    <button
                      className="contribute-tag-btn"
                      onClick={() => window.open('https://github.com/kennylimz/anime-character-guessr/issues/new', '_blank', 'noopener,noreferrer')}
                    >
                      {text.reportBug}
                    </button>
                  </div>
                  <img src={subaruIcon} alt="" className="button-icon" />
                </div>
              </div>

              {/* 角色出演作品 */}
              {answer.appearances && answer.appearances.length > 0 && (
                <div className="answer-appearances">
                  <h3>{text.appearances}</h3>
                  <ul className="appearances-list">
                    {((locale === 'en' ? answer.appearances : (answer.appearancesCn || answer.appearances)) || [])
                      .slice(0, 3).map((appearance, index) => (
                        <li key={index}>{appearance}</li>
                    ))}
                    {answer.appearances.length > 3 && (
                      <li>{text.moreWorks(answer.appearances.length)}</li>
                    )}
                  </ul>
                </div>
              )}

              {/* 角色标签 */}
              {idToTags[answer.id] && idToTags[answer.id].length > 0 && (
                <div className="answer-tags">
                  <h3>{text.tags}</h3>
                  <div className="tags-container" lang={locale === 'en' ? 'zh-CN' : undefined} translate={locale === 'en' ? 'yes' : undefined}>
                    {idToTags[answer.id].map((tag, index) => (
                      <span key={index} className="character-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 角色简介 */}
              {answer.summary && (
                <div className="answer-summary">
                  <h3>{text.summary}</h3>
                  <div className="summary-content">{renderSummaryWithTags(answer.summary, text)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameEndPopup;
