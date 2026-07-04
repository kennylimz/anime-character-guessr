const MAX_LOGS = 500;
const MAX_ERRORS = 100;

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
      return msg;
    }
    
    // Regular error
    const name = arg.name || 'Error';
    const message = arg.message || '';
    let stackLine = '';
    if (arg.stack) {
      // Get the first three lines of stack trace for brevity
      stackLine = '\n' + arg.stack.split('\n').slice(0, 3).join('\n');
    }
    return `[${name}] ${message}${stackLine}`;
  }
  
  if (typeof arg === 'object') {
    try {
      if (typeof HTMLElement !== 'undefined' && arg instanceof HTMLElement) {
        return `<${arg.tagName.toLowerCase()}${arg.id ? ` id="${arg.id}"` : ''}${arg.className ? ` class="${arg.className}"` : ''}>`;
      }
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }
  
  return String(arg);
}

class LogCollector {
  constructor() {
    this.logs = [];
    this.errors = [];
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

  addLog(type, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(formatLogArgument).join(' ');

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
        message: args.map(formatLogArgument).join(' ')
      };
    } else {
      errorInfo = {
        timestamp,
        message: formatLogArgument(args)
      };
    }

    this.errors.push(errorInfo);

    if (this.errors.length > MAX_ERRORS) {
      this.errors.shift();
    }
  }

  getLogs() {
    return [...this.logs];
  }

  getErrors() {
    return [...this.errors];
  }

  clear() {
    this.logs = [];
    this.errors = [];
  }

  getDiagnosticData() {
    return {
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
      logs: this.getLogs(),
      errors: this.getErrors()
    };
  }
}

const logCollector = new LogCollector();

export default logCollector;
