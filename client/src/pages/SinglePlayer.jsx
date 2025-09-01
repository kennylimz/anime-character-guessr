import { useEffect, useState, useRef } from "react";
import {
  getRandomCharacter,
  getCharacterAppearances,
  generateFeedback,
} from "../utils/bangumi";
import SearchBar from "../components/SearchBar";
import GuessesTable from "../components/GuessesTable";
import SettingsPopup from "../components/SettingsPopup";
import HelpPopup from "../components/HelpPopup";
import GameEndPopup from "../components/GameEndPopup";
import SocialLinks from "../components/SocialLinks";
import GameInfo from "../components/GameInfo";
import Timer from "../components/Timer";
import "../styles/game.css";
import "../styles/SinglePlayer.css";
import axios from "axios";
import { useLocalStorage } from "usehooks-ts";

function SinglePlayer() {
  const [guesses, setGuesses] = useState([]);
  const [guessesLeft, setGuessesLeft] = useState(10);
  const [isGuessing, setIsGuessing] = useState(false);
  const [gameEnd, setGameEnd] = useState(false);
  const [gameEndPopup, setGameEndPopup] = useState(null);
  const [answerCharacter, setAnswerCharacter] = useState(null);
  const [settingsPopup, setSettingsPopup] = useState(false);
  const [helpPopup, setHelpPopup] = useState(false);
  const [finishInit, setFinishInit] = useState(false);
  const [shouldResetTimer, setShouldResetTimer] = useState(false);
  const [hints, setHints] = useState([]);
  const [imgHint, setImgHint] = useState(null);
  const [useImageHint, setUseImageHint] = useState(0);
  const [gameSettings, setGameSettings] = useLocalStorage(
    "singleplayer-game-settings",
    {
      startYear: new Date().getFullYear() - 10,
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
      characterTagNum: 6,
      subjectTagNum: 6,
      commonTags: true,
    }
  );
  const [currentGameSettings, setCurrentGameSettings] = useState(gameSettings);

  // Initialize game
  useEffect(() => {
    let isMounted = true;

    axios.get("https://anime-character-guessr.netlify.app").then((response) => {
      console.log(response.data);
    });

    const initializeGame = async () => {
      try {
        if (gameSettings.addedSubjects.length > 0) {
          await axios.post(
            "https://anime-character-guessr.netlify.app" + "/api/subject-added",
            {
              addedSubjects: gameSettings.addedSubjects,
            }
          );
        }
      } catch (error) {
        console.error("Failed to update subject count:", error);
      }
      try {
        const character = await getRandomCharacter(gameSettings);
        setCurrentGameSettings({ ...gameSettings });
        if (isMounted) {
          setAnswerCharacter(character);
          setGuessesLeft(gameSettings.maxAttempts);
          // Prepare hints based on settings
          let hintTexts = [];
          if (
            Array.isArray(gameSettings.useHints) &&
            gameSettings.useHints.length > 0 &&
            character.summary
          ) {
            const sentences = character.summary
              .replace("[mask]", "")
              .replace("[/mask]", "")
              .split(/[。、，。！？ ""]/)
              .filter((s) => s.trim());
            if (sentences.length > 0) {
              // Randomly select as many hints as needed
              const selectedIndices = new Set();
              while (
                selectedIndices.size <
                Math.min(gameSettings.useHints.length, sentences.length)
              ) {
                selectedIndices.add(
                  Math.floor(Math.random() * sentences.length)
                );
              }
              hintTexts = Array.from(selectedIndices).map(
                (i) => "……" + sentences[i].trim() + "……"
              );
            }
          }
          setHints(hintTexts);
          setUseImageHint(gameSettings.useImageHint);
          setImgHint(gameSettings.useImageHint > 0 ? character.image : null);
          console.log("Initialize game", gameSettings);
          setFinishInit(true);
        }
      } catch (error) {
        console.error("Failed to initialize game:", error);
        if (isMounted) {
          alert(
            "Game initialization failed, please refresh the page and try again, or clear cache in settings"
          );
        }
      }
    };

    initializeGame();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCharacterSelect = async (character) => {
    if (isGuessing || !answerCharacter) return;

    setIsGuessing(true);
    setShouldResetTimer(true);
    if (character.id === 56822 || character.id === 56823) {
      alert("Interesting");
    }

    try {
      const appearances = await getCharacterAppearances(
        character.id,
        currentGameSettings
      );

      const guessData = {
        ...character,
        ...appearances,
      };

      const isCorrect = guessData.id === answerCharacter.id;
      setGuessesLeft((prev) => prev - 1);

      if (isCorrect) {
        setGuesses((prevGuesses) => [
          ...prevGuesses,
          {
            id: guessData.id,
            icon: guessData.image,
            name: guessData.name,
            nameCn: guessData.nameCn,
            gender: guessData.gender,
            genderFeedback: "yes",
            latestAppearance: guessData.latestAppearance,
            latestAppearanceFeedback: "=",
            earliestAppearance: guessData.earliestAppearance,
            earliestAppearanceFeedback: "=",
            highestRating: guessData.highestRating,
            ratingFeedback: "=",
            appearancesCount: guessData.appearances.length,
            appearancesCountFeedback: "=",
            popularity: guessData.popularity,
            popularityFeedback: "=",
            appearanceIds: guessData.appearanceIds,
            sharedAppearances: {
              first: appearances.appearances[0] || "",
              count: appearances.appearances.length,
            },
            metaTags: guessData.metaTags,
            sharedMetaTags: guessData.metaTags,
            isAnswer: true,
          },
        ]);

        setGameEnd(true);
        alert("Familiar with this character? Feel free to contribute tags");
        setGameEndPopup({
          result: "win",
          answer: answerCharacter,
        });
      } else if (guessesLeft <= 1) {
        const feedback = generateFeedback(
          guessData,
          answerCharacter,
          currentGameSettings
        );
        setGuesses((prevGuesses) => [
          ...prevGuesses,
          {
            id: guessData.id,
            icon: guessData.image,
            name: guessData.name,
            nameCn: guessData.nameCn,
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
            sharedAppearances: feedback.shared_appearances,
            metaTags: feedback.metaTags.guess,
            sharedMetaTags: feedback.metaTags.shared,
            isAnswer: false,
          },
        ]);

        setGameEnd(true);
        alert("Know this character? Feel free to contribute tags");
        setGameEndPopup({
          result: "lose",
          answer: answerCharacter,
        });
      } else {
        const feedback = generateFeedback(
          guessData,
          answerCharacter,
          currentGameSettings
        );
        setGuesses((prevGuesses) => [
          ...prevGuesses,
          {
            id: guessData.id,
            icon: guessData.image,
            name: guessData.name,
            nameCn: guessData.nameCn,
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
            sharedAppearances: feedback.shared_appearances,
            metaTags: feedback.metaTags.guess,
            sharedMetaTags: feedback.metaTags.shared,
            isAnswer: false,
          },
        ]);
      }
    } catch (error) {
      console.error("Error processing guess:", error);
      alert("An error occurred, please try again");
    } finally {
      setIsGuessing(false);
      setShouldResetTimer(false);
    }
  };

  const handleSettingsChange = (setting, value) => {
    setGameSettings((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  const handleRestartWithSettings = async () => {
    setGuesses([]);
    setGuessesLeft(gameSettings.maxAttempts);
    setIsGuessing(false);
    setGameEnd(false);
    setGameEndPopup(null);
    setAnswerCharacter(null);
    setSettingsPopup(false);
    setShouldResetTimer(true);
    setFinishInit(false);
    setHints([]);

    try {
      if (gameSettings.addedSubjects.length > 0) {
        await axios.post(
          "https://anime-character-guessr.netlify.app" + "/api/subject-added",
          {
            addedSubjects: gameSettings.addedSubjects,
          }
        );
      }
    } catch (error) {
      console.error("Failed to update subject count:", error);
    }
    try {
      setCurrentGameSettings({ ...gameSettings });
      const character = await getRandomCharacter(gameSettings);
      setAnswerCharacter(character);
      // Prepare hints based on settings for new game
      let hintTexts = [];
      if (
        Array.isArray(gameSettings.useHints) &&
        gameSettings.useHints.length > 0 &&
        character.summary
      ) {
        const sentences = character.summary
          .replace("[mask]", "")
          .replace("[/mask]", "")
          .split(/[。、，。！？ ""]/)
          .filter((s) => s.trim());
        if (sentences.length > 0) {
          const selectedIndices = new Set();
          while (
            selectedIndices.size <
            Math.min(gameSettings.useHints.length, sentences.length)
          ) {
            selectedIndices.add(Math.floor(Math.random() * sentences.length));
          }
          hintTexts = Array.from(selectedIndices).map(
            (i) => "……" + sentences[i].trim() + "……"
          );
        }
      }
      setHints(hintTexts);
      setUseImageHint(gameSettings.useImageHint);
      setImgHint(gameSettings.useImageHint > 0 ? character.image : null);
      console.log("Initialize game", gameSettings);
      setFinishInit(true);
    } catch (error) {
      console.error("Failed to initialize new game:", error);
      alert(
        "Game initialization failed, please refresh the page and try again, or clear cache in settings"
      );
    }
  };

  const timeUpRef = useRef(false);

  const handleTimeUp = () => {
    if (timeUpRef.current) return; // prevent multiple triggers
    timeUpRef.current = true;

    setGuessesLeft((prev) => {
      const newGuessesLeft = prev - 1;
      if (newGuessesLeft <= 0) {
        setGameEnd(true);
        setGameEndPopup({
          result: "lose",
          answer: answerCharacter,
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
      result: "lose",
      answer: answerCharacter,
    });
    alert("Surrendered! Check character details");
  };

  return (
    <div className="single-player-container">
      <SocialLinks
        onSettingsClick={() => setSettingsPopup(true)}
        onHelpClick={() => setHelpPopup(true)}
      />

      <div className="search-bar">
        <SearchBar
          onCharacterSelect={handleCharacterSelect}
          isGuessing={isGuessing}
          gameEnd={gameEnd}
          subjectSearch={currentGameSettings.subjectSearch}
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
        hints={hints}
        useImageHint={useImageHint}
        imgHint={imgHint}
        useHints={currentGameSettings.useHints}
        onSurrender={handleSurrender}
      />

      <GuessesTable
        guesses={guesses}
        gameSettings={currentGameSettings}
        answerCharacter={answerCharacter}
      />

      {settingsPopup && (
        <SettingsPopup
          gameSettings={gameSettings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setSettingsPopup(false)}
          onRestart={handleRestartWithSettings}
        />
      )}

      {helpPopup && <HelpPopup onClose={() => setHelpPopup(false)} />}

      {gameEndPopup && (
        <GameEndPopup
          result={gameEndPopup.result}
          answer={gameEndPopup.answer}
          onClose={() => setGameEndPopup(null)}
        />
      )}
    </div>
  );
}

export default SinglePlayer;
