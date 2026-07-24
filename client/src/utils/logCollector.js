import axios from 'axios';

const MAX_LOGS = 500;
const MAX_ERRORS = 100;
const MAX_NETWORK_LOGS = 30;

function cleanBackslashes(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/\\([\[\]\(\)\{\}'"\/])/g, '$1')
    .replace(/\\\\/g, '\\');
}

function sanitizeData(data) {
  if (typeof data === 'string') {
    return cleanBackslashes(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (data && typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = sanitizeData(value);
    }
    return cleaned;
  }
  return data;
}

function formatLogArgument(arg) {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  
  if (arg instanceof Error || (typeof arg === 'object' && arg.message)) {
    // Check if it's an AxiosError
    if (arg.isAxiosError || arg.name === 'AxiosError') {
      const method = arg.config?.method?.toUpperCase() || '';
      const url = arg.config?.url || '';
      const code = arg.code || '';
      const status = arg.response?.status ? ` [Status: ${arg.response.status}]` : '';
      let msg = `[AxiosError] ${arg.message}${code ? ` (${code})` : ''} on ${method} ${url}${status}`;
      if (arg.response?.data?.message) {
        msg += ` - Response: ${arg.response.data.message}`;
      }
      return cleanBackslashes(msg);
    }
    
    // Regular error
    const name = arg.name || 'Error';
    const message = arg.message || '';
    let stackLine = '';
    if (arg.stack) {
      // Get the first three lines of stack trace for brevity
      stackLine = '\n' + arg.stack.split('\n').slice(0, 3).join('\n');
    }
    return cleanBackslashes(`[${name}] ${message}${stackLine}`);
  }
  
  if (typeof arg === 'object') {
    try {
      if (typeof HTMLElement !== 'undefined' && arg instanceof HTMLElement) {
        return cleanBackslashes(`<${arg.tagName.toLowerCase()}${arg.id ? ` id="${arg.id}"` : ''}${arg.className ? ` class="${arg.className}"` : ''}>`);
      }
      return cleanBackslashes(JSON.stringify(arg));
    } catch (e) {
      return cleanBackslashes(String(arg));
    }
  }
  
  return cleanBackslashes(String(arg));
}

class LogCollector {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.networkLogs = [];
    this.appStateProvider = null;
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };
    this.init();
  }

  init() {
    this.overrideConsole();
    this.setupErrorHandlers();
    this.setupAxiosInterceptors();
  }

  overrideConsole() {
    const self = this;

    console.log = (...args) => {
      this.originalConsole.log(...args);
      self.addLog('log', args);
    };

    console.error = (...args) => {
      this.originalConsole.error(...args);
      self.addLog('error', args);
      self.addError(args);
    };

    console.warn = (...args) => {
      this.originalConsole.warn(...args);
      self.addLog('warn', args);
    };

    console.info = (...args) => {
      this.originalConsole.info(...args);
      self.addLog('info', args);
    };
  }

  setupErrorHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.addError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.addError({
        message: 'Unhandled Promise Rejection',
        reason: event.reason,
        stack: event.reason?.stack
      });
    });
  }

  setupAxiosInterceptors() {
    try {
      axios.interceptors.request.use(
        (config) => {
          config._startTime = Date.now();
          return config;
        },
        (error) => {
          return Promise.reject(error);
        }
      );

      axios.interceptors.response.use(
        (response) => {
          const durationMs = response.config?._startTime ? Date.now() - response.config._startTime : null;
          this.addNetworkLog({
            method: response.config?.method?.toUpperCase() || 'GET',
            url: response.config?.url || '',
            status: response.status,
            durationMs
          });
          return response;
        },
        (error) => {
          const durationMs = error.config?._startTime ? Date.now() - error.config._startTime : null;
          const status = error.response?.status || (error.code ? error.code : 'FAILED');
          const message = error.response?.data?.message || error.message || 'Network Request Error';
          this.addNetworkLog({
            method: error.config?.method?.toUpperCase() || 'GET',
            url: error.config?.url || '',
            status,
            durationMs,
            error: message
          });
          return Promise.reject(error);
        }
      );
    } catch (e) {
      // Intentionally silent
    }
  }

  setAppStateProvider(providerFn) {
    this.appStateProvider = providerFn;
  }

  getAppState() {
    if (typeof this.appStateProvider === 'function') {
      try {
        return sanitizeData(this.appStateProvider());
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  getLayoutHealth() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return null;

    const checkElement = (selector) => {
      try {
        const el = document.querySelector(selector);
        if (!el) return { found: false };
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          found: true,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity
        };
      } catch (e) {
        return { found: false, error: e.message };
      }
    };

    return sanitizeData({
      gameContainer: checkElement('.single-player-container, .multiplayer-container'),
      searchBar: checkElement('.search-bar'),
      gameInfo: checkElement('.game-info'),
      popupOverlay: checkElement('.popup-overlay'),
      bodyScrollHeight: document.body?.scrollHeight || 0,
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight
    });
  }

  addLog(type, args) {
    const timestamp = new Date().toISOString();
    const message = cleanBackslashes(args.map(formatLogArgument).join(' '));

    this.logs.push({
      timestamp,
      type,
      message
    });

    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }
  }

  addError(args) {
    const timestamp = new Date().toISOString();
    let errorInfo = {};

    if (Array.isArray(args)) {
      errorInfo = {
        timestamp,
        message: cleanBackslashes(args.map(formatLogArgument).join(' '))
      };
    } else {
      errorInfo = {
        timestamp,
        message: cleanBackslashes(formatLogArgument(args))
      };
    }

    this.errors.push(sanitizeData(errorInfo));

    if (this.errors.length > MAX_ERRORS) {
      this.errors.shift();
    }
  }

  addNetworkLog(item) {
    const timestamp = new Date().toISOString();
    this.networkLogs.push(sanitizeData({
      timestamp,
      ...item
    }));

    if (this.networkLogs.length > MAX_NETWORK_LOGS) {
      this.networkLogs.shift();
    }
  }

  getLogs() {
    return sanitizeData([...this.logs]);
  }

  getErrors() {
    return sanitizeData([...this.errors]);
  }

  getNetworkLogs() {
    return sanitizeData([...this.networkLogs]);
  }

  clear() {
    this.logs = [];
    this.errors = [];
    this.networkLogs = [];
  }

  getDiagnosticData() {
    const rawData = {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      screen: {
        width: window.screen.width,
        height: window.screen.height
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      appState: this.getAppState(),
      layoutHealth: this.getLayoutHealth(),
      networkLogs: this.getNetworkLogs(),
      logs: this.getLogs(),
      errors: this.getErrors()
    };

    return sanitizeData(rawData);
  }
}

const logCollector = new LogCollector();

export default logCollector;


