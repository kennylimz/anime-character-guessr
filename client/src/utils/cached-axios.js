import axios from 'axios';
import CryptoJS from 'crypto-js';
import debounce from 'lodash.debounce';

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 基础延迟（毫秒）
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // 可重试的状态码
};

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 带重试的请求函数
async function requestWithRetry(requestFn, retries = RETRY_CONFIG.maxRetries) {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // 判断是否应该重试
      const shouldRetry = 
        attempt < retries && (
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
    const response = await requestWithRetry(() => axios.get(url, config));
    this.setCache(cacheKey, response);
    return response;
  }

  async post(url, data = {}, config = {}) {
    const cacheKey = this._generateCacheKey('POST', url, { data, ...config });
    if (this.cache.has(cacheKey)) {
      this.stat.cache_hit.POST++;
      return this.getCache(cacheKey);
    }

    this.stat.fetch.POST++;
    const response = await requestWithRetry(() => axios.post(url, data, config));
    this.setCache(cacheKey, response);
    return response;
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