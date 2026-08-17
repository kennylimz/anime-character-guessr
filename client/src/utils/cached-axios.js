import axios from 'axios';
import CryptoJS from 'crypto-js';
import debounce from 'lodash.debounce';
import { enableBgmAccelAfterBlock, isOfficialBgmUrl, toAccelBgmUrl } from './bgmApi.js';

// 设置请求超时时间为 5 秒
axios.defaults.timeout = 5000;

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 基础延迟（毫秒）
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // 可重试的状态码
};

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 判断是否为 Connection Closed 或 Connection Timed Out 相关的网络错误
function isConnectionClosedError(error) {
  if (!error) return false;
  const errMsg = String(error.message || error || '').toLowerCase();
  const errCode = String(error.code || '').toLowerCase();
  return errMsg.includes('connection closed') || 
         errCode.includes('err_connection_closed') || 
         errMsg.includes('err_connection_closed') || 
         errMsg.includes('connection_closed') ||
         errCode.includes('err_connection_timed_out') ||
         errMsg.includes('connection timed out') ||
         errMsg.includes('err_connection_timed_out') ||
         errMsg.includes('timeout') ||
         errCode.includes('timeout') ||
         errMsg.includes('timed out') ||
         errCode.includes('timed out') ||
         errCode.includes('econnaborted') ||
         errMsg.includes('network error') ||
         errCode.includes('network') ||
         !error.response; // 无响应返回通常代表被浏览器或防火墙阻断/下线
}

// 带重试的请求函数
async function requestWithRetry(requestFn, retries = RETRY_CONFIG.maxRetries) {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // 判断是否应该重试（连接阻断或超时等网络错误也需要进行重试，直至重试全部失败才抛出）
      const shouldRetry = 
        attempt < retries && (
          isConnectionClosedError(error) ||
          !error.response || // 网络错误
          RETRY_CONFIG.retryableStatusCodes.includes(error.response?.status) // 可重试的状态码
        );
      
      if (shouldRetry) {
        const waitTime = RETRY_CONFIG.retryDelay * Math.pow(2, attempt); // 指数退避
        await delay(waitTime);
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

async function retryWithAccel(method, url, data, config) {
  const accelUrl = toAccelBgmUrl(url);
  if (!accelUrl || !enableBgmAccelAfterBlock()) return null;

  if (method === 'GET') {
    return requestWithRetry(() => axios.get(accelUrl, config));
  }
  return requestWithRetry(() => axios.post(accelUrl, data, config));
}

class RequestCache {
  constructor() {
    this.cache = new Map();
    this.stat = {
      cache_hit: {
        GET: 0,
        POST: 0,
      },
      fetch: {
        GET: 0,
        POST: 0,
      },
      retry: 0,
    };
    this._loadCacheFromStorage();
  }

  async get(url, config = {}) {
    const cacheKey = this._generateCacheKey('GET', url, config);
    if (this.cache.has(cacheKey)) {
      this.stat.cache_hit.GET++;
      return this.getCache(cacheKey);
    }

    this.stat.fetch.GET++;
    try {
      const response = await requestWithRetry(() => axios.get(url, config));
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      if (isOfficialBgmUrl(url) && isConnectionClosedError(error)) {
        error.isConnectionClosed = true;
        try {
          const response = await retryWithAccel('GET', url, null, config);
          if (response) {
            const accelUrl = toAccelBgmUrl(url);
            this.setCache(this._generateCacheKey('GET', accelUrl, config), response);
            return response;
          }
        } catch (accelError) {
          throw accelError;
        }
      }
      throw error;
    }
  }

  async post(url, data = {}, config = {}) {
    const cacheKey = this._generateCacheKey('POST', url, { data, ...config });
    if (this.cache.has(cacheKey)) {
      this.stat.cache_hit.POST++;
      return this.getCache(cacheKey);
    }

    this.stat.fetch.POST++;
    try {
      const response = await requestWithRetry(() => axios.post(url, data, config));
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      if (isOfficialBgmUrl(url) && isConnectionClosedError(error)) {
        error.isConnectionClosed = true;
        try {
          const response = await retryWithAccel('POST', url, data, config);
          if (response) {
            const accelUrl = toAccelBgmUrl(url);
            this.setCache(this._generateCacheKey('POST', accelUrl, { data, ...config }), response);
            return response;
          }
        } catch (accelError) {
          throw accelError;
        }
      }
      throw error;
    }
  }

  clearCache() {
    this.cache.clear();
    localStorage.removeItem('requestCache');
  }

  getCache(key) { 
    return this.cache.get(key);
  }

  setCache(key, value) {
    // check if status is 200
    if (value.status !== 200) return;
    // Only cache status and data to minimize storage size
    const cachedResponse = {
      status: value.status,
      data: value.data
    };
    this.cache.set(key, cachedResponse);
    this._saveCacheToStorage();
  }

  removeFromCache(method, url, config = {}) {
    const cacheKey = this._generateCacheKey(method, url, config);
    this.cache.delete(cacheKey);
    this._removeCacheFromStorage(cacheKey);
  }

  _generateCacheKey(method, url, config) {
    const configString = Object.keys(config).length === 0 ? '' : `:${CryptoJS.MD5(JSON.stringify(config)).toString()}`;
    return `${method}:${url}${configString}`;
  }

  _saveCacheToStorageInternal() {
    try {
      const cacheData = {};
      this.cache.forEach((value, key) => {
        cacheData[key] = value;
      });
      localStorage.setItem('requestCache', JSON.stringify(cacheData));
    } catch (error) {
      if (error.name === 'QuotaExceededError' || 
          error.message.includes('quota') || 
          error.message.includes('storage')) {
        console.warn('Storage quota exceeded, clearing all cache');
        this.clearCache();
      } else {
        throw error;
      }
    }
  }

  _saveCacheToStorage = debounce(this._saveCacheToStorageInternal, 1000);

  _loadCacheFromStorage() {
    const cacheData = JSON.parse(localStorage.getItem('requestCache')) || {};
    Object.entries(cacheData).forEach(([key, value]) => {
      this.cache.set(key, value);
    });
  }

  _removeCacheFromStorage(cacheKey) {
    const cacheData = JSON.parse(localStorage.getItem('requestCache')) || {};
    delete cacheData[cacheKey];
    localStorage.setItem('requestCache', JSON.stringify(cacheData));
  }
}

export default new RequestCache();
