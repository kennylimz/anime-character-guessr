import axios from 'axios';
import CryptoJS from 'crypto-js';
import debounce from 'lodash.debounce';

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
    const response = await axios.get(url, config);
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
    const response = await axios.post(url, data, config);
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
    // do not cache headers
    const { headers, ...rest } = value;
    this.cache.set(key, rest);
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