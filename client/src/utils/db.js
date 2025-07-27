import axios from "axios";

const DB_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

if (!DB_SERVER_URL) {
  throw new Error('VITE_DB_SERVER_URL environment variable is not defined');
}

export async function submitCharacterTags(characterId, tags) {
  try {
    const response = await axios.post(`${DB_SERVER_URL}/api/character-tags`, {
      characterId,
      tags,
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting character tags:', error);
  }
}

export async function proposeCustomTags(characterId, tags) {
  try {
    const response = await axios.post(`${DB_SERVER_URL}/api/propose-tags`, {
      characterId,
      tags,
    });
    return response.data;
  } catch (error) {
    console.error('Error proposing custom tags:', error);
  }
}

export async function submitFeedbackTags(characterId, upvotes, downvotes) {
  try {
    const response = await axios.post(`${DB_SERVER_URL}/api/feedback-tags`, {
      characterId,
      upvotes: Array.from(upvotes),
      downvotes: Array.from(downvotes),
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting tag feedback:', error);
  }
}

export async function submitAnswerCharacterCount(characterId, characterName) {
  try {
    const response = await axios.post(`${DB_SERVER_URL}/api/answer-character-count`, {
      characterId,
      characterName,
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting character answer count:', error);
  }
}

export async function getCharacterUsage(characterId) {
  try {
    const response = await axios.get(`${DB_SERVER_URL}/api/character-usage/${characterId}`);
    return response.data.count;
  } catch (error) {
    console.error('Error fetching character usage:', error);
    return 0;
  }
}

export async function submitGuessCharacterCount(characterId, characterName) {
  try {
    const response = await axios.post(`${DB_SERVER_URL}/api/guess-character-count`, {
      characterId,
      characterName,
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting character guess count:', error);
  }
}


