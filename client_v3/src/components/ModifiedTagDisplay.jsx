import { useState, useEffect } from 'react';
import '../styles/GuessesTable.css';

function ModifiedTagDisplay({ guessCharacterId, answerCharacterId }) {
  const [guessTagData, setGuessTagData] = useState(null);
  const [answerTagData, setAnswerTagData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTagData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/extra_tags.json');
        if (!response.ok) {
          throw new Error('Failed to fetch tag data');
        }
        const data = await response.json();
        const guessData = data[guessCharacterId];
        const answerData = data[answerCharacterId];
        setGuessTagData(guessData || null);
        setAnswerTagData(answerData || null);
      } catch (err) {
        console.error('Error fetching tag data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (guessCharacterId && answerCharacterId) {
      fetchTagData();
    }
  }, [guessCharacterId, answerCharacterId]);

  if (loading) {
    return <div className="modified-tag-display loading">加载中……</div>;
  }

  if (error) {
    return <div className="modified-tag-display error">出错了: {error}</div>;
  }

  if (!guessTagData) {
    return <div className="modified-tag-display empty">没有标签……</div>;
  }

  return (
    <div className="modified-tag-display horizontal-sections">
      {Object.entries(guessTagData).map(([section, tags], idx, arr) => (
        <div key={section} className="tag-section-horizontal">
          <div className="meta-tags-container horizontal">
            {Object.entries(tags).map(([tagKey, tagContent]) => {
              // Check if answer character has the same section and tag
              const isShared = !!(
                answerTagData &&
                answerTagData[section] &&
                Object.prototype.hasOwnProperty.call(answerTagData[section], tagKey)
              );
              return (
                <span
                  key={tagKey}
                  className={`meta-tag external-tag${isShared ? ' shared-tag' : ''}`}
                  dangerouslySetInnerHTML={{ __html: tagContent }}
                />
              );
            })}
          </div>
          <div className="tag-section-title-below">{section}</div>
          {idx < arr.length - 1 && <div className="tag-section-divider" />}
        </div>
      ))}
    </div>
  );
}

export default ModifiedTagDisplay;
