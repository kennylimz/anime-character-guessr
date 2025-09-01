/**
 * Game preset configurations
 * Contains all presets and their configuration items
 */

// Get current year
const currentYear = new Date().getFullYear();

// Game preset configurations
export const gamePresets = {
  Beginner: {
    startYear: currentYear - 5,
    endYear: currentYear,
    topNSubjects: 30,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    useIndex: false,
    indexId: null,
    addedSubjects: [],
    mainCharacterOnly: true,
    characterNum: 3,
    maxAttempts: 10,
    useHints: [5, 3],
    useImageHint: 0,
    includeGame: false,
    subjectSearch: true,
    subjectTagNum: 6,
    characterTagNum: 6,
    commonTags: true,
    // Mark which fields are dynamically calculated
    dynamicFields: ["startYear", "endYear"],
  },
  "Frozen Eel Expert": {
    startYear: currentYear - 20,
    endYear: currentYear,
    topNSubjects: 5,
    useSubjectPerYear: true,
    metaTags: ["", "", ""],
    useIndex: false,
    indexId: null,
    addedSubjects: [],
    mainCharacterOnly: false,
    characterNum: 6,
    maxAttempts: 10,
    useHints: [],
    useImageHint: 0,
    includeGame: false,
    subjectSearch: false,
    subjectTagNum: 6,
    characterTagNum: 6,
    commonTags: true,
    dynamicFields: ["startYear", "endYear"],
  },
  "Classic Anime Enthusiast": {
    startYear: 2000,
    endYear: 2015,
    topNSubjects: 5,
    useSubjectPerYear: true,
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
    subjectSearch: false,
    subjectTagNum: 6,
    characterTagNum: 6,
    commonTags: true,
    dynamicFields: [],
  },
  "Curated Bottle Picks": {
    startYear: 2005,
    endYear: currentYear,
    topNSubjects: 75,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    addedSubjects: [],
    mainCharacterOnly: true,
    characterNum: 10,
    maxAttempts: 7,
    useHints: [],
    useImageHint: 0,
    includeGame: false,
    subjectSearch: true,
    subjectTagNum: 6,
    characterTagNum: 5,
    commonTags: true,
    dynamicFields: ["endYear"],
  },
  "Cabinet Enthusiast": {
    startYear: currentYear - 10,
    endYear: currentYear,
    topNSubjects: 50,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    addedSubjects: [],
    mainCharacterOnly: true,
    characterNum: 6,
    maxAttempts: 10,
    useIndex: true,
    indexId: "75522",
    useHints: [],
    useImageHint: 0,
    includeGame: false,
    subjectSearch: false,
    subjectTagNum: 6,
    characterTagNum: 6,
    commonTags: true,
    dynamicFields: ["startYear", "endYear"],
  },
  "2D Game Expert": {
    startYear: currentYear - 10,
    endYear: currentYear,
    topNSubjects: 50,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    addedSubjects: [],
    mainCharacterOnly: false,
    characterNum: 30,
    maxAttempts: 10,
    useIndex: true,
    indexId: "77344",
    useHints: [],
    useImageHint: 0,
    includeGame: true,
    subjectSearch: true,
    subjectTagNum: 3,
    characterTagNum: 6,
    commonTags: true,
    dynamicFields: ["startYear", "endYear"],
  },
  "miHoYo Expert": {
    startYear: currentYear - 10,
    endYear: currentYear,
    topNSubjects: 50,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    addedSubjects: [],
    mainCharacterOnly: false,
    characterNum: 40,
    maxAttempts: 10,
    useIndex: true,
    indexId: "77186",
    useHints: [],
    useImageHint: 0,
    includeGame: true,
    subjectSearch: false,
    subjectTagNum: 3,
    characterTagNum: 6,
    commonTags: true,
    dynamicFields: ["startYear", "endYear"],
  },
  "MOBA Pro": {
    startYear: currentYear - 10,
    endYear: currentYear,
    topNSubjects: 50,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    addedSubjects: [],
    mainCharacterOnly: false,
    characterNum: 100,
    maxAttempts: 10,
    useIndex: true,
    indexId: "76637",
    useHints: [],
    useImageHint: 0,
    includeGame: true,
    subjectSearch: false,
    subjectTagNum: 3,
    characterTagNum: 6,
    commonTags: true,
    dynamicFields: ["startYear", "endYear"],
  },
};

/**
 * Determine whether two values match, considering dynamic years
 * @param {any} settingValue - Current setting value
 * @param {any} presetValue - Preset configuration value
 * @param {string} key - Key name of the setting
 * @param {Array} dynamicFields - List of dynamically computed fields
 * @returns {boolean} - Whether it matches
 */
function isValueMatch(settingValue, presetValue, key, dynamicFields) {
  // Handle dynamic year fields
  if (dynamicFields.includes(key)) {
    if (key === "startYear") {
      // Calculate dynamic year, allow 1 year tolerance
      const isYearMatch = Math.abs(settingValue - presetValue) <= 1;
      return isYearMatch;
    }
    if (key === "endYear") {
      // If the preset end year is the current year, allow tolerance
      if (presetValue === currentYear) {
        return Math.abs(settingValue - currentYear) <= 1;
      }
    }
  }

  // Handle array types
  if (Array.isArray(settingValue) && Array.isArray(presetValue)) {
    return JSON.stringify(settingValue) === JSON.stringify(presetValue);
  }

  // Handle primitive / ordinary types
  return settingValue === presetValue;
}

/**
 * Match whether current settings fit a preset
 * @param {Object} settings - Current game settings
 * @returns {Object} - Matching preset info { name, modified }
 */
export function matchPreset(settings) {
  if (!settings) return { name: null, modified: false };

  // Key settings used to determine preset type
  const keySettings = [
    "useIndex",
    "indexId",
    "topNSubjects",
    "useSubjectPerYear",
    "mainCharacterOnly",
    "characterNum",
    "maxAttempts",
    "useHints",
    "includeGame",
    "subjectSearch",
  ];

  // All settings used to check for modifications
  const allSettings = [
    ...keySettings,
    "startYear",
    "endYear",
    "metaTags",
    "characterTagNum",
    "subjectTagNum",
  ];

  // Try matching each preset
  for (const [presetName, presetConfig] of Object.entries(gamePresets)) {
    // Extract dynamic field list from preset config
    const dynamicFields = presetConfig.dynamicFields || [];

    // Step 1: Check if key settings match
    let isMatch = true;
    for (const key of keySettings) {
      const settingValue = settings[key];
      const presetValue = presetConfig[key];

      if (!isValueMatch(settingValue, presetValue, key, dynamicFields)) {
        isMatch = false;
        break;
      }
    }

    // If key settings match, check for modifications
    if (isMatch) {
      let hasModifications = false;

      for (const key of allSettings) {
        const settingValue = settings[key];
        const presetValue = presetConfig[key];

        if (!isValueMatch(settingValue, presetValue, key, dynamicFields)) {
          hasModifications = true;
          break;
        }
      }

      return {
        name: presetName,
        modified: hasModifications,
      };
    }
  }

  // No matching preset found
  return {
    name: null,
    modified: false,
  };
}

/**
 * Get a copy of the preset object
 * @param {string} presetName - Preset name
 * @returns {Object} - Copy of preset configuration
 */
export function getPresetConfig(presetName) {
  if (!gamePresets[presetName]) return null;

  // Create a deep copy of the preset and remove the dynamicFields field
  const presetCopy = JSON.parse(JSON.stringify(gamePresets[presetName]));
  delete presetCopy.dynamicFields;
  return presetCopy;
}

/**
 * Get all preset names
 * @returns {Array} - List of preset names
 */
export function getPresetNames() {
  return Object.keys(gamePresets);
}
