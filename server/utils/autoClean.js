require('dotenv').config()
const axios = require('axios');
const db = require('./db');
const PING_INTERVAL = 6 * 60 * 1000; // 6 minutes in milliseconds

// 检查是否为开发者模式
const isDevMode = () => process.env.DEV_MODE === 'true';

const autoClean = () => {
  // 开发者模式下跳过自动清理
  if (isDevMode()) {
    console.log('[DevMode] 跳过自动清理房间');
    return;
  }
  axios.get(`${process.env.SERVER_URL}/api/clean-rooms`)
    .then(response => console.log('Self-ping successful:', response.status, response.data.message))
    .catch(error => console.error('Self-ping failed:', error.message));
};

// 清空周榜数据
const clearWeeklyCount = async () => {
  try {
    const client = db.getClient();
    const database = client.db('stats');
    const collection = database.collection('weekly_count');
    
    const result = await collection.deleteMany({});
    console.log(`[Weekly Reset] Cleared ${result.deletedCount} records from weekly_count`);
  } catch (error) {
    console.error('[Weekly Reset] Failed to clear weekly_count:', error.message);
  }
};

// 检查是否是周一凌晨4点
let weeklyResetDone = false;
const checkWeeklyReset = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
  const hour = now.getHours();
  
  // 周一凌晨4:00-4:59之间执行
  if (dayOfWeek === 1 && hour === 4) {
    if (!weeklyResetDone) {
      clearWeeklyCount();
      weeklyResetDone = true;
    }
  } else {
    // 重置标记，以便下周可以再次执行
    weeklyResetDone = false;
  }
};

const startAutoClean = () => {
  // Start the self-ping interval
  setInterval(autoClean, PING_INTERVAL);
  console.log('Auto clean mechanism started');
  
  // 每小时检查一次是否需要清空周榜
  setInterval(checkWeeklyReset, 60 * 60 * 1000);
  console.log('Weekly reset check started (hourly)');
};

module.exports = {
  startAutoClean,
  autoClean,
  clearWeeklyCount
}; 