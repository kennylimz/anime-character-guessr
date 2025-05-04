/**
 * 游戏预设配置
 * 包含所有预设及其配置项
 */

// 获取当前年份
const currentYear = new Date().getFullYear();

// 游戏预设配置
export const gamePresets = {
  '入门': {
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
    enableHints: true,
    includeGame: false,
    subjectSearch: true,
    subjectTagNum: 6,
    characterTagNum: 6,
    commonTags: true,
    externalTagMode: false,
    // 标记哪些字段是动态计算的
    dynamicFields: ['startYear', 'endYear']
  },
  '冻鳗高手': {
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
    enableHints: false,
    includeGame: false,
    subjectSearch: false,
    subjectTagNum: 6,
    characterTagNum: 6,
    commonTags: true,
    externalTagMode: false,
    dynamicFields: ['startYear', 'endYear']
  },
  '老番享受者': {
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
    enableHints: false,
    includeGame: false,
    subjectSearch: false,
    subjectTagNum: 6,
    characterTagNum: 6,
    commonTags: true,
    externalTagMode: false,
    dynamicFields: []
  },
  '瓶子严选': {
    startYear: 2005,
    endYear: currentYear,
    topNSubjects: 75,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    addedSubjects: [],
    mainCharacterOnly: true,
    characterNum: 10,
    maxAttempts: 7,
    enableHints: false,
    includeGame: false,
    subjectSearch: true,
    subjectTagNum: 6,
    characterTagNum: 5,
    commonTags: true,
    externalTagMode: false,
    dynamicFields: ['endYear']
  },
  '木柜子痴': {
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
    enableHints: false,
    includeGame: false,
    subjectSearch: false,
    subjectTagNum: 6,
    characterTagNum: 6, 
    commonTags: true,
    externalTagMode: false,
    dynamicFields: ['startYear', 'endYear']
  },
  '二游高手+': {
    startYear: currentYear - 10,
    endYear: currentYear,
    topNSubjects: 50,
    useSubjectPerYear: false,
    metaTags: ["", "", ""],
    addedSubjects: [],
    mainCharacterOnly: false,
    characterNum: 10,
    maxAttempts: 10,
    useIndex: true,
    indexId: "75442",
    enableHints: false,
    includeGame: true,
    subjectSearch: false,
    subjectTagNum: 3,
    characterTagNum: 6,
    commonTags: true,
    externalTagMode: false,
    dynamicFields: ['startYear', 'endYear']
  },
  '米哈游高手': {
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
    indexId: "76524",
    enableHints: false,
    includeGame: true,
    subjectSearch: false,
    subjectTagNum: 3,
    characterTagNum: 6,
    commonTags: true,
    externalTagMode: true,
    dynamicFields: ['startYear', 'endYear']
  },
  'MOBA糕手': {
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
    enableHints: false,
    includeGame: true,
    subjectSearch: false,
    subjectTagNum: 3,
    characterTagNum: 6,
    commonTags: true,
    externalTagMode: true,
    dynamicFields: ['startYear', 'endYear']
  }
};

/**
 * 判断两个值是否匹配，考虑动态年份
 * @param {any} settingValue - 当前设置的值
 * @param {any} presetValue - 预设配置的值
 * @param {string} key - 设置项的键名
 * @param {Array} dynamicFields - 动态计算的字段列表
 * @returns {boolean} - 是否匹配
 */
function isValueMatch(settingValue, presetValue, key, dynamicFields) {
  // 处理动态年份字段
  if (dynamicFields.includes(key)) {
    if (key === 'startYear') {
      // 计算动态年份，允许1年的误差
      const isYearMatch = Math.abs(settingValue - presetValue) <= 1;
      return isYearMatch;
    }
    if (key === 'endYear') {
      // 如果预设的结束年份是当前年份，允许误差
      if (presetValue === currentYear) {
        return Math.abs(settingValue - currentYear) <= 1;
      }
    }
  }
  
  // 处理数组类型
  if (Array.isArray(settingValue) && Array.isArray(presetValue)) {
    return JSON.stringify(settingValue) === JSON.stringify(presetValue);
  }
  
  // 处理普通类型
  return settingValue === presetValue;
}

/**
 * 匹配当前设置是否符合某个预设
 * @param {Object} settings - 当前游戏设置
 * @returns {Object} - 匹配的预设信息 { name, modified }
 */
export function matchPreset(settings) {
  if (!settings) return { name: null, modified: false };
  
  // 关键设置项，用于确定预设类型
  const keySettings = [
    'useIndex', 'indexId', 'topNSubjects', 'useSubjectPerYear', 
    'mainCharacterOnly', 'characterNum', 'maxAttempts', 
    'enableHints', 'includeGame', 'subjectSearch'
  ];
  
  // 所有设置项，用于检查是否有修改
  const allSettings = [
    ...keySettings, 
    'startYear', 'endYear', 'metaTags', 
    'characterTagNum', 'subjectTagNum'
  ];
  
  // 尝试匹配每个预设
  for (const [presetName, presetConfig] of Object.entries(gamePresets)) {
    // 从预设配置中提取动态字段列表
    const dynamicFields = presetConfig.dynamicFields || [];
    
    // 步骤1: 检查关键设置项是否匹配
    let isMatch = true;
    for (const key of keySettings) {
      const settingValue = settings[key];
      const presetValue = presetConfig[key];
      
      if (!isValueMatch(settingValue, presetValue, key, dynamicFields)) {
        isMatch = false;
        break;
      }
    }
    
    // 如果关键设置项匹配，检查是否有修改
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
        modified: hasModifications
      };
    }
  }
  
  // 没有找到匹配的预设
  return {
    name: null,
    modified: false
  };
}

/**
 * 获取预设对象的副本
 * @param {string} presetName - 预设名称
 * @returns {Object} - 预设配置的副本
 */
export function getPresetConfig(presetName) {
  if (!gamePresets[presetName]) return null;
  
  // 创建预设的深拷贝，移除dynamicFields字段
  const presetCopy = JSON.parse(JSON.stringify(gamePresets[presetName]));
  delete presetCopy.dynamicFields;
  return presetCopy;
}

/**
 * 获取所有预设名称
 * @returns {Array} - 预设名称列表
 */
export function getPresetNames() {
  return Object.keys(gamePresets);
} 
