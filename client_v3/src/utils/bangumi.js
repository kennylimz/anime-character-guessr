import axios from './cached-axios.js';
import { idToTags } from '../data/id_tags.js';

const API_BASE_URL = 'https://api.bgm.tv';

async function getSubjectDetails(subjectId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/v0/subjects/${subjectId}`);

    if (!response.data) {
      throw new Error('No subject details found');
    }
    // Get air date and current date
    const airDate = response.data.date;
    const currentDate = new Date();
    
    // If air date is in the future, return null to indicate this show should be ignored
    if (airDate && new Date(airDate) > currentDate) {
      return null;
    }
    else if (response.data.locked) {
      return null;
    }

    let year = airDate ? parseInt(airDate.split('-')[0]) : null;
    
    // Extract meta tags and add animation studios
    // const persons = [];
    // const animationStudio = response.data.infobox?.find(item => item.key === '动画制作')?.value;
    // if (animationStudio && animationStudio.length < 50) {
    //   // Split by both '×' and '/' and trim whitespace from each studio
    //   const studioSplit = animationStudio.split(/[×/()、（）\[\]]/).map(studio => studio.trim()).filter(studio => studio.length < 30 && studio.length > 0);
    //   persons.push(...studioSplit);
    // }

    // const publisher = response.data.infobox?.find(item => item.key === '发行')?.value;
    // if (publisher && publisher.length < 50) {
    //   const studioTrim = publisher.split(/[×/()、（）\[\]]/)[0].trim();
    //   persons.push(studioTrim);
    // }
    
    const tags = [];
    if (response.data.type === 2) {
      response.data.tags
        .filter(tag => !tag.name.includes('20'))
        .forEach(tag => tags.push({ [tag.name]: tag.count }));
    }
    if (response.data.type === 4) {
      response.data.tags
        .filter(tag => !tag.name.includes('20'))
        .forEach(tag => tags.push({ [tag.name]: tag.count }));
    }

    return {
      name: response.data.name_cn || response.data.name,
      year,
      tags,
      raw_tags: response.data.tags,
      meta_tags: response.data.meta_tags,
      rating: response.data.rating?.score || 0,
      rating_count: response.data.rating?.total || 0
    };
  } catch (error) {
    console.error('Error fetching subject details:', error);
    throw error;
  }
}

async function getCharacterAppearances(characterId, gameSettings) {
  try {
    const [subjectsResponse, personsResponse] = await Promise.all([
      axios.get(`${API_BASE_URL}/v0/characters/${characterId}/subjects`),
      axios.get(`${API_BASE_URL}/v0/characters/${characterId}/persons`)
    ]);

    if (!subjectsResponse.data || !subjectsResponse.data.length) {
      return {
        appearances: [],
        latestAppearance: -1,
        earliestAppearance: -1,
        highestRating: 0,
        rawTags: new Map(),
        metaTags: []
      };
    }

    let filteredAppearances;
    if (gameSettings.includeGame) {
      filteredAppearances = subjectsResponse.data.filter(appearance => 
        (appearance.staff === '主角' || appearance.staff === '配角')
        && (appearance.type === 2 || appearance.type === 4)
      );
    }
    else {
      filteredAppearances = subjectsResponse.data.filter(appearance => 
        (appearance.staff === '主角' || appearance.staff === '配角')
        && (appearance.type === 2)
      );
      if (filteredAppearances.length === 0) {
        filteredAppearances = subjectsResponse.data.filter(appearance => 
          (appearance.staff === '主角' || appearance.staff === '配角')
          && (appearance.type === 4)
        );
      }
    }
    if (filteredAppearances.length === 0) {
      return {
        appearances: [],
        latestAppearance: -1,
        earliestAppearance: -1,
        highestRating: -1,
        rawTags: new Map(),
        metaTags: []
      };
    }

    let latestAppearance = -1;
    let earliestAppearance = -1;
    let highestRating = -1;
    const sourceTagMap = new Map([
      ['GAL改', '游戏改'],
      ['轻小说改', '小说改'],
      ['轻改', '小说改'],
      ['原创动画', '原创'],
      ['网文改', '小说改'],
      ['漫改', '漫画改'],
      ['漫画改编', '漫画改'],
      ['游戏改编', '游戏改'],
      ['小说改编', '小说改']
    ]);
    const sourceTagSet = new Set(['原创', '游戏改', '小说改', '漫画改']);
    const regionTagSet = new Set(['日本', '欧美', '美国', '中国', '法国', '韩国', '英国', '俄罗斯', '中国香港', '苏联', '捷克', '中国台湾', '马来西亚']);
    const sourceTagCounts = new Map();
    const regionTags = new Set();
    const tagCounts = new Map(); // Track cumulative counts for each tag
    const metaTagCounts = new Map(); // Track cumulative counts for each meta tag
    const allMetaTags = new Set();
    const rawTags = new Map();

    // Get just the names and collect meta tags
    const appearances = await Promise.all(
      filteredAppearances.map(async appearance => {
        try {
          const stuffFactor = appearance.staff === '主角' ? 3 : 1;
          const details = await getSubjectDetails(appearance.id);
          if (!details || details.year === null) return null;

          if (!gameSettings.metaTags.filter(tag => tag !== '').every(tag => details.meta_tags.includes(tag))){
            return null;
          }
          
          if (latestAppearance === -1 || details.year > latestAppearance) {
            latestAppearance = details.year;
          }
          if (earliestAppearance === -1 || details.year < earliestAppearance) {
            earliestAppearance = details.year;
          }
          if (details.rating > highestRating) {
            highestRating = details.rating;
          }

          if (gameSettings.commonTags) {
            details.raw_tags.forEach(tag => {
              if (sourceTagSet.has(tag.name)) {
                sourceTagCounts.set(tag.name, (sourceTagCounts.get(tag.name) || 0) + stuffFactor*tag.count);
              }
              else if (sourceTagMap.has(tag.name)) {
                const mappedTag = sourceTagMap.get(tag.name);
                sourceTagCounts.set(mappedTag, (sourceTagCounts.get(mappedTag) || 0) + stuffFactor*tag.count);
              }
              else{
                rawTags.set(tag.name, (rawTags.get(tag.name) || 0) + stuffFactor*tag.count);
              }
            });
          }
          else{
            details.meta_tags.forEach(tag => {
              if (sourceTagSet.has(tag)) {
                return;
              }
              else if (regionTagSet.has(tag)) {
                regionTags.add(tag);
              }
              else {
                metaTagCounts.set(tag, (metaTagCounts.get(tag) || 0) + (tagCounts.get(tag) || stuffFactor));
              }
            });
  
            details.tags.forEach(tagObj => {
              const [[name, count]] = Object.entries(tagObj);
              if (sourceTagSet.has(name)) {
                sourceTagCounts.set(name, (sourceTagCounts.get(name) || 0) + count*stuffFactor);
              }
              else if (regionTagSet.has(name)) {
                regionTags.add(name);
              }
              else if (sourceTagMap.has(name)) {
                const mappedTag = sourceTagMap.get(name);
                sourceTagCounts.set(mappedTag, (sourceTagCounts.get(mappedTag) || 0) + count*stuffFactor);
              }
              else if (regionTags.has(name)) {
                return;
              }
              else {
                tagCounts.set(name, (tagCounts.get(name) || 0) + count*stuffFactor);
              }
            });
          }

          return {
            name: details.name,
            rating_count: details.rating_count
          };

        } catch (error) {
          console.error(`Failed to get details for subject ${appearance.id}:`, error);
          return null;
        }
      })
    );

    let sortedRawTags;
    let sortedSourceTags;
    let sortedTags;
    let sortedMetaTags;
    if (gameSettings.commonTags){
      sortedSourceTags = Array.from(sourceTagCounts.entries())
        .map(([name, count]) => ({ [name]: count }))
        .sort((a, b) => Object.values(b)[0] - Object.values(a)[0]);
      if (sortedSourceTags.length > 0) {
        const topSourceTag = Object.entries(sortedSourceTags[0])[0];
        rawTags.set(topSourceTag[0], (rawTags.get(topSourceTag[0]) || 0) + topSourceTag[1]);
      }
      const sortedEntries = [...rawTags.entries()].filter(entry => !entry[0].includes('20')).sort((a, b) => b[1] - a[1]);
      const maxCount = sortedEntries.length > 0 ? sortedEntries[0][1] : 0;
      const threshold = maxCount * 0.1;
      let cutoffIndex = sortedEntries.findIndex(entry => entry[1] < threshold);
      sortedRawTags = new Map(sortedEntries.slice(0, Math.max(cutoffIndex, gameSettings.subjectTagNum)));
    }
    else{
      sortedSourceTags = Array.from(sourceTagCounts.entries())
        .map(([name, count]) => ({ [name]: count }))
        .sort((a, b) => Object.values(b)[0] - Object.values(a)[0]);

      sortedTags = Array.from(tagCounts.entries())
        .map(([name, count]) => ({ [name]: count }))
        .sort((a, b) => Object.values(b)[0] - Object.values(a)[0]);

      sortedMetaTags = Array.from(metaTagCounts.entries())
        .map(([name, count]) => ({ [name]: count }))
        .sort((a, b) => Object.values(b)[0] - Object.values(a)[0]);

      // Only add one source tag to avoid confusion
      if (sortedSourceTags.length > 0) {
        allMetaTags.add(Object.keys(sortedSourceTags[0])[0]);
      }
      for (const tagObj of sortedMetaTags) {
        if (allMetaTags.size >= gameSettings.subjectTagNum) break;
        allMetaTags.add(Object.keys(tagObj)[0]);
      }
      if (idToTags && idToTags[characterId]) {
        idToTags[characterId].slice(0, Math.min(gameSettings.characterTagNum, idToTags[characterId].length)).forEach(tag => allMetaTags.add(tag));
      }
      for (const tagObj of sortedTags) {
        if (allMetaTags.size >= gameSettings.subjectTagNum+gameSettings.characterTagNum) break;
        allMetaTags.add(Object.keys(tagObj)[0]);
      }
      regionTags.forEach(tag => allMetaTags.add(tag));
    }
    
    const validAppearances = appearances
      .filter(appearance => appearance !== null)
      .sort((a, b) => b.rating_count - a.rating_count)
      .map(appearance => appearance.name);

    const animeVAs = new Set();
    if (characterId === 56822 || characterId === 56823 || characterId === 17529 || characterId === 10956) {
      animeVAs = [];
      allMetaTags.add('展开');
    }
    else if (personsResponse.data && personsResponse.data.length) {
      const persons = personsResponse.data.filter(person => person.subject_type === 2 || person.subject_type === 4);
      if (persons.length > 0) {
        persons.forEach(person => {
          allMetaTags.add(`${person.name}`);
          animeVAs.add(person.name);
        });
      }
    }
    return {
      appearances: validAppearances,
      latestAppearance,
      earliestAppearance,
      highestRating,
      rawTags: sortedRawTags || new Map(),
      animeVAs: Array.from(animeVAs),
      metaTags: Array.from(allMetaTags)
    };
  } catch (error) {
    console.error('Error fetching character appearances:', error);
    return {
      appearances: [],
      latestAppearance: -1,
      earliestAppearance: -1,
      highestRating: -1,
      rawTags: new Map(),
      animeVAs: [],
      metaTags: []
    };
  }
}

async function getCharacterDetails(characterId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/v0/characters/${characterId}`);
    if (!response.data) {
      throw new Error('No character details found');
    }

    // Extract Chinese name from infobox
    const nameCn = response.data.infobox?.find(item => item.key === '简体中文名')?.value || null;

    // Handle gender - only accept string values of 'male' or 'female'
    const gender = typeof response.data.gender === 'string' && 
      (response.data.gender === 'male' || response.data.gender === 'female') 
      ? response.data.gender 
      : '?';

    return {
      name: response.data.name,
      nameCn: nameCn,
      gender,
      image: response.data.images.medium,
      imageGrid: response.data.images.grid,
      summary: response.data.summary,
      popularity: response.data.stat.collects+response.data.stat.comments
    };
  } catch (error) {
    console.error('Error fetching character details:', error);
    throw error;
  }
}

async function getCharactersBySubjectId(subjectId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/v0/subjects/${subjectId}/characters`);

    if (!response.data || !response.data.length) {
      throw new Error('No characters found for this anime');
    }

    const filteredCharacters = response.data.filter(character => 
      character.relation === '主角' || character.relation === '配角'
    );

    if (filteredCharacters.length === 0) {
      throw new Error('No main or supporting characters found for this anime');
    }
  
    return filteredCharacters;
  } catch (error) {
    console.error('Error fetching characters:', error);
    throw error;
  }
}

async function getRandomCharacter(gameSettings) {
  try {
    let subject;
    let total;
    let randomOffset;
    const batchSize = 10;
    let batchOffset;
    let indexInBatch;
    
    if (gameSettings.useIndex && gameSettings.indexId) {
      // Get index info first
      const indexInfo = await getIndexInfo(gameSettings.indexId);
      // Get total from index info
      total = indexInfo.total + gameSettings.addedSubjects.length; 
      
      // Get a random offset within the total number of subjects
      randomOffset = Math.floor(Math.random() * total);

      if (randomOffset >= indexInfo.total) {
        randomOffset = randomOffset - indexInfo.total;
        subject = gameSettings.addedSubjects[randomOffset];
      } else {
        // Calculate batch-aligned offset and select random item from batch
        batchOffset = Math.floor(randomOffset / batchSize) * batchSize;
        indexInBatch = randomOffset % batchSize;
        // Fetch batch of subjects from the index
        const response = await axios.get(
          `${API_BASE_URL}/v0/indices/${gameSettings.indexId}/subjects?limit=${batchSize}&offset=${batchOffset}`
        );

        if (!response.data || !response.data.data || response.data.data.length === 0) {
          throw new Error('No subjects found in index');
        }

        subject = response.data.data[Math.min(indexInBatch, response.data.data.length - 1)];
      }
    }
    else if (gameSettings.useSubjectPerYear){
      const startYear = gameSettings.startYear;
      const endYear = Math.min(gameSettings.endYear, new Date().getFullYear());
      const randomYear = startYear + Math.floor(Math.random() * (endYear - startYear + 1));
      const endDate = new Date(`${randomYear + 1}-01-01`);
      const today = new Date();
      const minDate = new Date(Math.min(endDate.getTime(), today.getTime())).toISOString().split('T')[0];

      total = gameSettings.topNSubjects*(endYear-startYear+1) + gameSettings.addedSubjects.length;
      randomOffset = Math.floor(Math.random() * total);

      if (randomOffset >= gameSettings.topNSubjects*(endYear-startYear+1)) {
        randomOffset = randomOffset - gameSettings.topNSubjects;
        subject = gameSettings.addedSubjects[randomOffset];
      } 
      else {
        randomOffset = Math.floor(Math.random() * gameSettings.topNSubjects);
        batchOffset = Math.floor(randomOffset / batchSize) * batchSize;
        indexInBatch = randomOffset % batchSize;
        const response = await axios.post(`${API_BASE_URL}/v0/search/subjects?limit=${batchSize}&offset=${batchOffset}`, {
          "sort": "heat",
          "filter": {
            "type": [2],
            "air_date": [
              `>=${randomYear}-01-01`,
              `<${minDate}`
            ],
            "meta_tags": gameSettings.metaTags.filter(tag => tag !== "")
          }
        });
        if (!response.data || !response.data.data || response.data.data.length === 0) {
          throw new Error('Failed to fetch subject for the selected year');
        }
        subject = response.data.data[Math.min(indexInBatch, response.data.data.length - 1)];
      }
    }
    else {
      gameSettings.useIndex = false;
      total = gameSettings.topNSubjects+gameSettings.addedSubjects.length;
      randomOffset = Math.floor(Math.random() * total);
      const endDate = new Date(`${gameSettings.endYear + 1}-01-01`);
      const today = new Date();
      const minDate = new Date(Math.min(endDate.getTime(), today.getTime())).toISOString().split('T')[0];
      
      if (randomOffset >= gameSettings.topNSubjects) {
        randomOffset = randomOffset - gameSettings.topNSubjects;
        subject = gameSettings.addedSubjects[randomOffset];
      } 
      else {
        // Calculate batch-aligned offset
        batchOffset = Math.floor(randomOffset / batchSize) * batchSize;
        indexInBatch = randomOffset % batchSize;
        
        // Fetch batch of subjects
        const response = await axios.post(`${API_BASE_URL}/v0/search/subjects?limit=${batchSize}&offset=${batchOffset}`, {
          "sort": "heat",
          "filter": {
            "type": [2],
            "air_date": [
              `>=${gameSettings.startYear}-01-01`,
              `<${minDate}`
            ],
            "meta_tags": gameSettings.metaTags.filter(tag => tag !== "")
          }
        });

        if (!response.data || !response.data.data || response.data.data.length === 0) {
          throw new Error('Failed to fetch subject at random offset');
        }

        subject = response.data.data[Math.min(indexInBatch, response.data.data.length - 1)];
      }
    }

    // Get characters for the selected subject
    const characters = await getCharactersBySubjectId(subject.id);
    
    // Filter and select characters based on mainCharacterOnly setting
    const filteredCharacters = gameSettings.mainCharacterOnly
      ? characters.filter(character => character.relation === '主角')
      : characters.filter(character => character.relation === '主角' || character.relation === '配角').slice(0, gameSettings.characterNum);

    if (filteredCharacters.length === 0) {
      throw new Error('No characters found for this anime');
    }

    // Randomly select one character from the filtered characters
    const selectedCharacter = filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];

    // Get additional character details
    const characterDetails = await getCharacterDetails(selectedCharacter.id);

    // Get character appearances
    const appearances = await getCharacterAppearances(selectedCharacter.id, gameSettings);

    return {
      ...selectedCharacter,
      ...characterDetails,
      ...appearances
    };
  } catch (error) {
    console.error('Error getting random character:', error);
    throw error;
  }
}

async function designateCharacter(characterId, gameSettings) {
  try {
    // Get additional character details
    const characterDetails = await getCharacterDetails(characterId);

    // Get character appearances
    const appearances = await getCharacterAppearances(characterId, gameSettings);
    console.log(characterDetails);

    return {
      id: characterId,
      ...characterDetails,
      ...appearances
    };
  } catch (error) {
    console.error('Error getting random character:', error);
    throw error;
  }
}

function generateFeedback(guess, answerCharacter, gameSettings) {
  const result = {};

  result.gender = {
    guess: guess.gender,
    feedback: guess.gender === answerCharacter.gender ? 'yes' : 'no'
  };

  const popularityDiff = guess.popularity - answerCharacter.popularity;
  const fivePercent = answerCharacter.popularity * 0.05;
  const twentyPercent = answerCharacter.popularity * 0.2;
  let popularityFeedback;
  if (Math.abs(popularityDiff) <= fivePercent) {
    popularityFeedback = '=';
  } else if (popularityDiff > 0) {
    popularityFeedback = popularityDiff <= twentyPercent ? '+' : '++';
  } else {
    popularityFeedback = popularityDiff >= -twentyPercent ? '-' : '--';
  }
  result.popularity = {
    guess: guess.popularity,
    feedback: popularityFeedback
  };

  // Handle rating comparison
  const ratingDiff = guess.highestRating - answerCharacter.highestRating;
  let ratingFeedback;
  if (guess.highestRating === -1 || answerCharacter.highestRating === -1) {
    ratingFeedback = '?';
  } else if (Math.abs(ratingDiff) <= 0.3) {
    ratingFeedback = '=';
  } else if (ratingDiff > 0) {
    ratingFeedback = ratingDiff <= 1 ? '+' : '++';
  } else {
    ratingFeedback = ratingDiff >= -1 ? '-' : '--';
  }
  result.rating = {
    guess: guess.highestRating,
    feedback: ratingFeedback
  };

  const sharedAppearances = guess.appearances.filter(appearance => answerCharacter.appearances.includes(appearance));
  result.shared_appearances = {
    first: sharedAppearances[0] || '',
    count: sharedAppearances.length
  };

  // Compare total number of appearances
  const appearanceDiff = guess.appearances.length - answerCharacter.appearances.length;
  let appearancesFeedback;
  if (appearanceDiff === 0) {
    appearancesFeedback = '=';
  } else if (appearanceDiff > 0) {
    appearancesFeedback = appearanceDiff <= 2 ? '+' : '++';
  } else {
    appearancesFeedback = appearanceDiff >= -2 ? '-' : '--';
  }
  result.appearancesCount = {
    guess: guess.appearances.length,
    feedback: appearancesFeedback
  };

  if (gameSettings.commonTags){
    const guessSubjectTags = Array.from(guess.rawTags.keys());
    const answerSubjectTags = Array.from(answerCharacter.rawTags.keys());
    const answerSubjectTagsSet = new Set(answerSubjectTags);
    const sharedSubjectTags = guessSubjectTags.filter(tag => answerSubjectTagsSet.has(tag)).slice(0, gameSettings.subjectTagNum);
    const subjectTags = [...sharedSubjectTags];
    for (const tag of guessSubjectTags) {
      if (subjectTags.length >= gameSettings.subjectTagNum) break;
      if (!answerSubjectTagsSet.has(tag)) {
        subjectTags.push(tag);
      }
    }

    const guessCharacterTags = idToTags && idToTags[guess.id]? idToTags[guess.id] : [];
    const answerCharacterTags = idToTags && idToTags[answerCharacter.id]? idToTags[answerCharacter.id] : [];
    const answerCharacterTagsSet = new Set(answerCharacterTags);
    const sharedCharacterTags = guessCharacterTags.filter(tag => answerCharacterTagsSet.has(tag)).slice(0, gameSettings.characterTagNum);
    const characterTags = [...sharedCharacterTags];
    for (const tag of guessCharacterTags) {
      if (characterTags.length >= gameSettings.characterTagNum) break;
      if (!answerCharacterTagsSet.has(tag)) {
        characterTags.push(tag);
      }
    }
    const guessCVTags = guess.animeVAs? guess.animeVAs : [];
    const answerCVTags = answerCharacter.animeVAs? answerCharacter.animeVAs : [];
    const sharedCVTags = guessCVTags.filter(tag => answerCVTags.includes(tag));

    const finalGuessTagsSet = new Set([...subjectTags, ...characterTags, ...guessCVTags]);
    const finalSharedTagsSet = new Set([...sharedSubjectTags, ...sharedCharacterTags, ...sharedCVTags]);
    result.metaTags = {
      guess: Array.from(finalGuessTagsSet),
      shared: Array.from(finalSharedTagsSet)
    };
  }
  else{
    // Advice from EST-NINE
    const answerMetaTagsSet = new Set(answerCharacter.metaTags);
    const sharedMetaTags = guess.metaTags.filter(tag => answerMetaTagsSet.has(tag));

    result.metaTags = {
      guess: guess.metaTags,
      shared: sharedMetaTags
    };
  }

  if (guess.latestAppearance === -1 || answerCharacter.latestAppearance === -1) {
    result.latestAppearance = {
      guess: guess.latestAppearance === -1 ? '?' : guess.latestAppearance,
      feedback: guess.latestAppearance === -1 && answerCharacter.latestAppearance === -1 ? '=' : '?'
    };
  } else {
    const yearDiff = guess.latestAppearance - answerCharacter.latestAppearance;
    let yearFeedback;
    if (yearDiff === 0) {
      yearFeedback = '=';
    } else if (yearDiff > 0) {
      yearFeedback = yearDiff <= 2 ? '+' : '++';
    } else {
      yearFeedback = yearDiff >= -2 ? '-' : '--';
    }
    result.latestAppearance = {
      guess: guess.latestAppearance,
      feedback: yearFeedback
    };
  }

  if (guess.earliestAppearance === -1 || answerCharacter.earliestAppearance === -1) {
    result.earliestAppearance = {
      guess: guess.earliestAppearance,
      feedback: guess.earliestAppearance === -1 && answerCharacter.earliestAppearance === -1 ? '=' : '?'
    };
  } else {
    const yearDiff = guess.earliestAppearance - answerCharacter.earliestAppearance;
    let yearFeedback;
    if (yearDiff === 0) {
      yearFeedback = '=';
    } else if (yearDiff > 0) {
      yearFeedback = yearDiff <= 2 ? '+' : '++';
    } else {
      yearFeedback = yearDiff >= -2 ? '-' : '--';
    }
    result.earliestAppearance = {
      guess: guess.earliestAppearance,
      feedback: yearFeedback
    };
  }
  return result;
}

async function getIndexInfo(indexId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/v0/indices/${indexId}`);
    
    if (!response.data) {
      throw new Error('No index information found');
    }

    return {
      title: response.data.title,
      total: response.data.total
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Index not found');
    }
    console.error('Error fetching index information:', error);
    throw error;
  }
}

async function searchSubjects(keyword) {
  try {
    const response = await axios.post(`${API_BASE_URL}/v0/search/subjects`, {
      keyword: keyword.trim(),
      filter: {
        // type: [2]  // Only anime
        type: [2, 4]  // anime and game
      }
    });

    if (!response.data || !response.data.data) {
      return [];
    }

    return response.data.data.map(subject => ({
      id: subject.id,
      name: subject.name,
      name_cn: subject.name_cn,
      image: subject.images?.grid || subject.images?.medium || '',
      date: subject.date,
      type: subject.type==2 ? '动漫' : '游戏'
    }));
  } catch (error) {
    console.error('Error searching subjects:', error);
    return [];
  }
}

function censoredText(text) {
  return text.replace('乳', 'R')
}

export {
  getRandomCharacter,
  designateCharacter,
  getCharacterAppearances,
  getCharactersBySubjectId,
  getCharacterDetails,
  generateFeedback,
  getIndexInfo,
  searchSubjects,
  censoredText
}; 
