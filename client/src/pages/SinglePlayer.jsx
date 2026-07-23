import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getRandomCharacter, getCharacterAppearances, generateFeedback } from '../utils/bangumi';
import SearchBar from '../components/SearchBar';
import GuessesTable from '../components/GuessesTable';
import SettingsPopup from '../components/SettingsPopup';
import HelpPopup from '../components/HelpPopup';
import GameEndPopup from '../components/GameEndPopup';
import SocialLinks from '../components/SocialLinks';
import GameInfo from '../components/GameInfo';
import Timer from '../components/Timer';
import FeedbackPopup from '../components/FeedbackPopup';
import TagContributionPopup from '../components/TagContributionPopup';
import logCollector from '../utils/logCollector';
import '../styles/game.css';
import '../styles/SinglePlayer.css';
import '../styles/social.css';
import axios from 'axios';
import { useLocalStorage } from 'usehooks-ts';

const SINGLE_PLAYER_TEXT = {
  zh: {
    initFailed: '游戏初始化失败，请刷新页面重试，或在设置里清理缓存',
    interesting: '有点意思',
    winTagContribution: '熟悉这个角色吗？欢迎贡献标签',
    loseTagContribution: '认识这个角色吗？欢迎贡献标签',
    guessFailed: '出错了，请重试',
    surrendered: '已投降！查看角色详情',
    feedbackTitle: 'Bug/标签反馈'
  },
  en: {
    initFailed: 'Failed to initialize the game. Refresh the page or clear cache in settings.',
    interesting: 'Interesting.',
    winTagContribution: 'Tag contributions are welcome.',
    loseTagContribution: 'Tag contributions are welcome.',
    guessFailed: 'Something went wrong. Please try again.',
    surrendered: 'Surrendered. Check the answer details.',
    feedbackTitle: 'Bug / tag feedback'
  }
};

function SinglePlayer() {
  const location = useLocation();
  const locale = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
  const isEnglish = locale === 'en';
  const text = SINGLE_PLAYER_TEXT[locale] || SINGLE_PLAYER_TEXT.zh;
  const [guesses, setGuesses] = useState([]);
  const [guessesLeft, setGuessesLeft] = useState(10);
  const [isGuessing, setIsGuessing] = useState(false);
  const [gameEnd, setGameEnd] = useState(false);
  const [gameEndPopup, setGameEndPopup] = useState(null);
  const [answerCharacter, setAnswerCharacter] = useState(null);
  const [settingsPopup, setSettingsPopup] = useState(false);
  const [helpPopup, setHelpPopup] = useState(false);
  const [finishInit, setFinishInit] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [shouldResetTimer, setShouldResetTimer] = useState(false);
  const [hints, setHints] = useState([]);
  const [imgHint, setImgHint] = useState(null);
  const [useImageHint, setUseImageHint] = useState(0);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [tagFeedbackCharacter, setTagFeedbackCharacter] = useState(null);
  const [isGameRestarting, setIsGameRestarting] = useState(false); // 防止重复点击"再玩一次"
  const [gameSettings, setGameSettings] = useLocalStorage('singleplayer-game-settings', {
    startYear: new Date().getFullYear()-10,
    endYear: new Date().getFullYear(),
    useSubjectPerYear: false,
    topNSubjects: 50,
    metaTags: ["", "", ""],
    useIndex: false,
    indexId: null,
    addedSubjects: [],
    mainCharacterOnly: true,
    characterNum: 6,
    maxAttempts: 10,
    useHints: [],
    useImageHint: 0,
    includeGame: false,
    timeLimit: null,
    subjectSearch: true,
    characterTagNum: 4,
    subjectTagNum: 4,
    commonTags: true
  });
  const [currentGameSettings, setCurrentGameSettings] = useState(gameSettings);

  // Initialize game
  useEffect(() => {
    let isMounted = true;

    const initializeGame = async () => {
      setInitFailed(false);
      try {
        if (gameSettings.addedSubjects.length > 0) {
          await axios.post(import.meta.env.VITE_SERVER_URL + '/api/subject-added', {
            addedSubjects: gameSettings.addedSubjects
          });
        }
      } catch (error) {
        console.error('Failed to update subject count:', error);
      }
      try {
        const character = await getRandomCharacter(gameSettings);
        setCurrentGameSettings({ ...gameSettings });
        if (isMounted) {
          setAnswerCharacter(character);
          setGuessesLeft(gameSettings.maxAttempts);
          // Prepare hints based on settings
          let hintTexts = [];
          if (Array.isArray(gameSettings.useHints) && gameSettings.useHints.length > 0 && character.summary) {
            const sentences = character.summary.replace('[mask]', '').replace('[/mask]','')
              .split(/[。、，。！？ ""]/).filter(s => s.trim());
            if (sentences.length > 0) {
              // Randomly select as many hints as needed
              const selectedIndices = new Set();
              while (selectedIndices.size < Math.min(gameSettings.useHints.length, sentences.length)) {
                selectedIndices.add(Math.floor(Math.random() * sentences.length));
              }
              hintTexts = Array.from(selectedIndices).map(i => "……"+sentences[i].trim()+"……");
            }
          }
          setHints(hintTexts);
          setUseImageHint(gameSettings.useImageHint);
          setImgHint(gameSettings.useImageHint > 0 ? character.image : null);
          console.log('初始化游戏', gameSettings);
          setFinishInit(true);
          setInitFailed(false);
        }
      } catch (error) {
        console.error('Failed to initialize game:', error);
        if (error?.isConnectionClosed || error?.code === 'ERR_CONNECTION_CLOSED' || error?.code === 'ERR_CONNECTION_TIMED_OUT' || error?.code === 'ECONNABORTED' || !error?.response ||
            String(error).toLowerCase().includes('closed') || String(error).toLowerCase().includes('timeout') || String(error).toLowerCase().includes('timed out') ||
            String(error).toLowerCase().includes('network') || String(error).toLowerCase().includes('fetch')) {
          setInitFailed(true);
          return;
        }
        if (isMounted) {
          const message = error?.response?.data?.message || error?.message || text.initFailed;
          alert(message);
          setInitFailed(true);
        }
      }
    };

    initializeGame();

    return () => {
      isMounted = false;
    };
  }, []);

  // Register app state provider for diagnostic logs
  useEffect(() => {
    logCollector.setAppStateProvider(() => ({
      mode: 'singleplayer',
      finishInit,
      initFailed,
      gameEnd,
      isGuessing,
      guessesLeft,
      guessesCount: guesses.length,
      hasAnswerCharacter: Boolean(answerCharacter),
      answerCharacterId: answerCharacter?.id || null,
      answerCharacterName: answerCharacter?.name || null,
      subjectSearchEnabled: currentGameSettings?.subjectSearch ?? true,
      maxAttempts: currentGameSettings?.maxAttempts,
      timeLimit: currentGameSettings?.timeLimit
    }));

    return () => {
      logCollector.setAppStateProvider(null);
    };
  }, [finishInit, initFailed, gameEnd, isGuessing, guessesLeft, guesses.length, answerCharacter, currentGameSettings]);

  const handleCharacterSelect = async (character) => {
    if (isGuessing || !answerCharacter) return;

    setIsGuessing(true);
    setShouldResetTimer(true);
    if (character.id === 56822 || character.id === 56823) {
      alert(text.interesting);
    }

    try {
      const appearances = await getCharacterAppearances(character.id, currentGameSettings);

      const guessData = {
        ...character,
        ...appearances
      };

      const isCorrect = guessData.id === answerCharacter.id;
      const newGuessesLeft = guessesLeft - 1;

      if (isCorrect) {
        setGuessesLeft(newGuessesLeft);
        setGuesses(prevGuesses => [...prevGuesses, {
          id: guessData.id,
          icon: guessData.image,
          name: guessData.name,
          nameCn: guessData.nameCn,
          nameEn: guessData.nameEn,
          gender: guessData.gender,
          genderFeedback: 'yes',
          latestAppearance: guessData.latestAppearance,
          latestAppearanceFeedback: '=',
          earliestAppearance: guessData.earliestAppearance,
          earliestAppearanceFeedback: '=',
          highestRating: guessData.highestRating,
          ratingFeedback: '=',
          appearancesCount: guessData.appearances.length,
          appearancesCountFeedback: '=',
          popularity: guessData.popularity,
          popularityFeedback: '=',
          appearanceIds: guessData.appearanceIds,
          appearances: guessData.appearances,
          appearancesCn: guessData.appearancesCn,
          sharedAppearances: {
            first: appearances.appearances[0] || '',
            firstOriginal: appearances.appearances[0] || '',
            firstCn: appearances.appearancesCn?.[0] || appearances.appearances[0] || '',
            count: appearances.appearances.length
          },
          metaTags: guessData.metaTags,
          sharedMetaTags: guessData.metaTags,
          isAnswer: true
        }]);

        setGameEnd(true);
        alert(text.winTagContribution);
        setGameEndPopup({
          result: 'win',
          answer: answerCharacter
        });
      } else if (newGuessesLeft <= 0) {
        const feedback = generateFeedback(guessData, answerCharacter, currentGameSettings);
        setGuessesLeft(newGuessesLeft);
        setGuesses(prevGuesses => [...prevGuesses, {
          id: guessData.id,
          icon: guessData.image,
          name: guessData.name,
          nameCn: guessData.nameCn,
          nameEn: guessData.nameEn,
          gender: guessData.gender,
          genderFeedback: feedback.gender.feedback,
          latestAppearance: guessData.latestAppearance,
          latestAppearanceFeedback: feedback.latestAppearance.feedback,
          earliestAppearance: guessData.earliestAppearance,
          earliestAppearanceFeedback: feedback.earliestAppearance.feedback,
          highestRating: guessData.highestRating,
          ratingFeedback: feedback.rating.feedback,
          appearancesCount: guessData.appearances.length,
          appearancesCountFeedback: feedback.appearancesCount.feedback,
          popularity: guessData.popularity,
          popularityFeedback: feedback.popularity.feedback,
          appearanceIds: guessData.appearanceIds,
          appearances: guessData.appearances,
          appearancesCn: guessData.appearancesCn,
          sharedAppearances: feedback.shared_appearances,
          metaTags: feedback.metaTags.guess,
          sharedMetaTags: feedback.metaTags.shared,
          isAnswer: false
        }]);

        setGameEnd(true);
        alert(text.loseTagContribution);
        setGameEndPopup({
          result: 'lose',
          answer: answerCharacter
        });
      } else {
        const feedback = generateFeedback(guessData, answerCharacter, currentGameSettings);
        setGuessesLeft(newGuessesLeft);
        setGuesses(prevGuesses => [...prevGuesses, {
          id: guessData.id,
          icon: guessData.image,
          name: guessData.name,
          nameCn: guessData.nameCn,
          nameEn: guessData.nameEn,
          gender: guessData.gender,
          genderFeedback: feedback.gender.feedback,
          latestAppearance: guessData.latestAppearance,
          latestAppearanceFeedback: feedback.latestAppearance.feedback,
          earliestAppearance: guessData.earliestAppearance,
          earliestAppearanceFeedback: feedback.earliestAppearance.feedback,
          highestRating: guessData.highestRating,
          ratingFeedback: feedback.rating.feedback,
          appearancesCount: guessData.appearances.length,
          appearancesCountFeedback: feedback.appearancesCount.feedback,
          popularity: guessData.popularity,
          popularityFeedback: feedback.popularity.feedback,
          appearanceIds: guessData.appearanceIds,
          appearances: guessData.appearances,
          appearancesCn: guessData.appearancesCn,
          sharedAppearances: feedback.shared_appearances,
          metaTags: feedback.metaTags.guess,
          sharedMetaTags: feedback.metaTags.shared,
          isAnswer: false
        }]);
      }
    } catch (error) {
      console.error('Error processing guess:', error);
      if (error?.isConnectionClosed || error?.code === 'ERR_CONNECTION_CLOSED' || error?.code === 'ERR_CONNECTION_TIMED_OUT' || error?.code === 'ECONNABORTED' || !error?.response ||
          String(error).toLowerCase().includes('closed') || String(error).toLowerCase().includes('timeout') || String(error).toLowerCase().includes('timed out') ||
          String(error).toLowerCase().includes('network') || String(error).toLowerCase().includes('fetch')) {
        return;
      }
      alert(text.guessFailed);
    } finally {
      setIsGuessing(false);
      setShouldResetTimer(false);
    }
  };

  const handleSettingsChange = (setting, value) => {
    setGameSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleRestartWithSettings = async () => {
    // 防止重复点击："再玩一次"按钮
    if (isGameRestarting) return;
    
    setIsGameRestarting(true);
    
    try {
      setGuesses([]);
      setGuessesLeft(gameSettings.maxAttempts);
      setIsGuessing(false);
      setGameEnd(false);
      setGameEndPopup(null);
      setAnswerCharacter(null);
      setSettingsPopup(false);
      setShouldResetTimer(true);
      setFinishInit(false);
      setInitFailed(false);
      setHints([]);

      try {
        if (gameSettings.addedSubjects.length > 0) {
          await axios.post(import.meta.env.VITE_SERVER_URL + '/api/subject-added', {
            addedSubjects: gameSettings.addedSubjects
          });
        }
      } catch (error) {
        console.error('Failed to update subject count:', error);
      }
      try {
        setCurrentGameSettings({ ...gameSettings });
        const character = await getRandomCharacter(gameSettings);
        setAnswerCharacter(character);
        // Prepare hints based on settings for new game
        let hintTexts = [];
        if (Array.isArray(gameSettings.useHints) && gameSettings.useHints.length > 0 && character.summary) {
          const sentences = character.summary.replace('[mask]', '').replace('[/mask]','')
            .split(/[。、，。！？ ""]/).filter(s => s.trim());
          if (sentences.length > 0) {
            const selectedIndices = new Set();
            while (selectedIndices.size < Math.min(gameSettings.useHints.length, sentences.length)) {
              selectedIndices.add(Math.floor(Math.random() * sentences.length));
            }
            hintTexts = Array.from(selectedIndices).map(i => "……"+sentences[i].trim()+"……");
          }
        }
        setHints(hintTexts);
        setUseImageHint(gameSettings.useImageHint);
        setImgHint(gameSettings.useImageHint > 0 ? character.image : null);
        console.log('初始化游戏', gameSettings);
        setFinishInit(true);
        setInitFailed(false);
      } catch (error) {
        console.error('Failed to initialize new game:', error);
        const message = error?.response?.data?.message || error?.message || text.initFailed;
        alert(message);
        setInitFailed(true);
      }
    } finally {
      setIsGameRestarting(false);
    }
  };

  const timeUpRef = useRef(false);

  const handleTimeUp = () => {
    if (timeUpRef.current) return; // prevent multiple triggers
    timeUpRef.current = true;

    setGuessesLeft(prev => {
      const newGuessesLeft = prev - 1;
      if (newGuessesLeft <= 0) {
        setGameEnd(true);
        setGameEndPopup({
          result: 'lose',
          answer: answerCharacter
        });
      }
      return newGuessesLeft;
    });
    setShouldResetTimer(true);
    setTimeout(() => {
      setShouldResetTimer(false);
      timeUpRef.current = false;
    }, 100);
  };

  const handleSurrender = () => {
    if (gameEnd) return;

    setGameEnd(true);
    setGameEndPopup({
      result: 'lose',
      answer: answerCharacter
    });
    alert(text.surrendered);
  };

  const handleFeedbackSubmit = async ({ type, description, includeLogs }) => {
    const payload = {
      bugType: type,
      description,
    };

    if (includeLogs) {
      payload.diagnosticData = logCollector.getDiagnosticData();
    }

    const serverUrl = import.meta.env.VITE_SERVER_URL || '';
    await axios.post(`${serverUrl}/api/bug-feedback`, payload);
  };

  return (
    <div className="single-player-container" lang={isEnglish ? 'en' : 'zh-CN'}>
      <SocialLinks
        onSettingsClick={() => setSettingsPopup(true)}
        onHelpClick={() => setHelpPopup(true)}
        onFeedbackClick={() => setShowFeedbackPopup(true)}
        showFeedbackInline={true}
        locale={locale}
      />

      <div className="search-bar">
        <SearchBar
          onCharacterSelect={handleCharacterSelect}
          isGuessing={isGuessing}
          gameEnd={gameEnd}
          subjectSearch={currentGameSettings.subjectSearch}
          finishInit={finishInit}
          locale={locale}
        />
      </div>

      {currentGameSettings.timeLimit && (
        <Timer
          timeLimit={currentGameSettings.timeLimit}
          onTimeUp={handleTimeUp}
          isActive={!gameEnd && !isGuessing}
          reset={shouldResetTimer}
        />
      )}

      <GameInfo
        gameEnd={gameEnd}
        guessesLeft={guessesLeft}
        onRestart={handleRestartWithSettings}
        answerCharacter={answerCharacter}
        finishInit={finishInit}
        initFailed={initFailed}
        hints={hints}
        useImageHint={useImageHint}
        imgHint = {imgHint}
        useHints={currentGameSettings.useHints}
        onSurrender={handleSurrender}
        isRestarting={isGameRestarting}
        locale={locale}
      />

      <GuessesTable
        guesses={guesses}
        gameSettings={currentGameSettings}
        answerCharacter={answerCharacter}
        locale={locale}
      />

      {settingsPopup && (
        <SettingsPopup
          gameSettings={gameSettings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setSettingsPopup(false)}
          onRestart={handleRestartWithSettings}
          locale={locale}
        />
      )}

      {helpPopup && (
        <HelpPopup onClose={() => setHelpPopup(false)} locale={locale} />
      )}

      {gameEndPopup && (
        <GameEndPopup
          result={gameEndPopup.result}
          answer={gameEndPopup.answer}
          onClose={() => setGameEndPopup(null)}
          locale={locale}
        />
      )}

      {showFeedbackPopup && (
        <FeedbackPopup
          onClose={() => setShowFeedbackPopup(false)}
          onSubmit={handleFeedbackSubmit}
          onTagFeedbackSelect={(character) => setTagFeedbackCharacter(character)}
          locale={locale}
        />
      )}

      {tagFeedbackCharacter && (
        <TagContributionPopup
          character={tagFeedbackCharacter}
          locale={locale}
          onClose={() => setTagFeedbackCharacter(null)}
        />
      )}
    </div>
  );
}

export default SinglePlayer;
