import { useState, useEffect } from 'react';
import '../styles/GuessesTable.css';
import axios from 'axios';
import { subjectsWithExtraTags } from '../data/extra_tag_subjects';

function ModifiedTagDisplay({ guessCharacter, answerCharacter }) {
  const [guessTagData, setGuessTagData] = useState(null);
  const [answerTagData, setAnswerTagData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTagData = async () => {
      try {
        setLoading(true);
        let guessData = null;
        let answerData = null;
        for (const subjectId of guessCharacter.appearanceIds) {
          if (subjectsWithExtraTags.has(subjectId)) {
            const response = await axios.get(`/data/extra_tags/${subjectId}.json`);
            guessData = response.data[guessCharacter.id];
            break;
          }
        }
        for (const subjectId of answerCharacter.appearanceIds) {
          if (subjectsWithExtraTags.has(subjectId)) {
            const response = await axios.get(`/data/extra_tags/${subjectId}.json`);
            answerData = response.data[answerCharacter.id];
            break;
          }
        }
        setGuessTagData(guessData);
        setAnswerTagData(answerData);
      } catch (err) {
        console.error('Error fetching tag data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (guessCharacter && answerCharacter) {
      fetchTagData();
    }
  }, [guessCharacter, answerCharacter]);

  if (loading) {
    return <div className="modified-tag-display loading">加载中……</div>;
  }

  if (error) {
    return <div className="modified-tag-display error">出错了: {error}</div>;
  }

  if (!guessTagData) {
    return <div className="modified-tag-display empty">没有标签……<br/>（可能是作者尚未录入）</div>;
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
