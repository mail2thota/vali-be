const { chromium } = require('playwright');
const BaseScraper = require('../../scrapers/baseScraper');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Mock readline for testing
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((prompt, callback) => callback()),
    close: jest.fn()
  }))
}));

// Mock fs for Chrome directory tests
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

describe('BaseScraper', () => {
  let scraper;
  let mockBrowser;
  let mockContext;
  let mockPage;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock browser, context, and page
    mockPage = {
      addInitScript: jest.fn(),
      mouse: {
        move: jest.fn()
      }
    };
    
    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage)
    };
    
    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn()
    };
    
    // Mock chromium.launch
    chromium.launch = jest.fn().mockResolvedValue(mockBrowser);
    
    scraper = new BaseScraper();
  });

  afterEach(async () => {
    if (scraper.browser) {
      await scraper.closeSession();
    }
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      expect(scraper.options).toEqual({});
      expect(scraper.browser).toBeNull();
      expect(scraper.context).toBeNull();
      expect(scraper.page).toBeNull();
    });

    test('should initialize with custom options', () => {
      const customOptions = { headless: false, timeout: 30000 };
      const customScraper = new BaseScraper(customOptions);
      expect(customScraper.options).toEqual(customOptions);
    });
  });

  describe('getChromeUserDataDir', () => {
    test('should return correct path for macOS', () => {
      const originalPlatform = os.platform;
      os.platform = jest.fn().mockReturnValue('darwin');
      
      const expectedPath = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
      fs.existsSync.mockReturnValue(true);
      
      const result = scraper.getChromeUserDataDir();
      
      expect(result).toBe(expectedPath);
      
      os.platform = originalPlatform;
    });

    test('should return correct path for Windows', () => {
      const originalPlatform = os.platform;
      os.platform = jest.fn().mockReturnValue('win32');
      
      const expectedPath = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
      fs.existsSync.mockReturnValue(true);
      
      const result = scraper.getChromeUserDataDir();
      
      expect(result).toBe(expectedPath);
      
      os.platform = originalPlatform;
    });

    test('should return correct path for Linux', () => {
      const originalPlatform = os.platform;
      os.platform = jest.fn().mockReturnValue('linux');
      
      const expectedPath = path.join(os.homedir(), '.config', 'google-chrome');
      fs.existsSync.mockReturnValue(true);
      
      const result = scraper.getChromeUserDataDir();
      
      expect(result).toBe(expectedPath);
      
      os.platform = originalPlatform;
    });

    test('should return null when Chrome directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = scraper.getChromeUserDataDir();
      expect(result).toBeNull();
    });
  });

  describe('initSession', () => {
    test('should initialize browser session successfully', async () => {
      await scraper.initSession();
      
      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        userAgent: expect.any(String),
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        extraHTTPHeaders: {
          'accept-language': 'en-US,en;q=0.9',
        }
      });
      
      expect(mockContext.newPage).toHaveBeenCalled();
      expect(mockPage.addInitScript).toHaveBeenCalled();
      
      expect(scraper.browser).toBe(mockBrowser);
      expect(scraper.context).toBe(mockContext);
      expect(scraper.page).toBe(mockPage);
    });

    test('should initialize with non-headless mode when specified', async () => {
      const nonHeadlessScraper = new BaseScraper({ headless: false });
      await nonHeadlessScraper.initSession();
      
      expect(chromium.launch).toHaveBeenCalledWith({
        headless: false,
        args: expect.any(Array)
      });
    });

    test('should handle Chrome user data directory when available', async () => {
      const mockChromePath = '/mock/chrome/path';
      const originalGetChromeUserDataDir = scraper.getChromeUserDataDir;
      scraper.getChromeUserDataDir = jest.fn().mockReturnValue(mockChromePath);
      
      await scraper.initSession();
      
      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          userDataDir: mockChromePath
        })
      );
      
      scraper.getChromeUserDataDir = originalGetChromeUserDataDir;
    });
  });

  describe('closeSession', () => {
    test('should close browser session', async () => {
      await scraper.initSession();
      await scraper.closeSession();
      
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should handle closing when browser is null', async () => {
      await expect(scraper.closeSession()).resolves.not.toThrow();
    });
  });

  describe('waitForManualSolve', () => {
    test('should wait for manual input', async () => {
      const message = 'Test message';
      await expect(scraper.waitForManualSolve(message)).resolves.not.toThrow();
    });
  });

  describe('scrape', () => {
    test('should throw error when not implemented', async () => {
      await expect(scraper.scrape()).rejects.toThrow('scrape() must be implemented by subclass');
    });
  });

  describe('getRandomUserAgent', () => {
    test('should return a valid user agent string', () => {
      const userAgent = scraper.getRandomUserAgent();
      expect(typeof userAgent).toBe('string');
      expect(userAgent.length).toBeGreaterThan(0);
      expect(userAgent).toMatch(/Mozilla/);
    });

    test('should return different user agents on multiple calls', () => {
      const userAgents = new Set();
      for (let i = 0; i < 10; i++) {
        userAgents.add(scraper.getRandomUserAgent());
      }
      // Should have some variety (not all the same)
      expect(userAgents.size).toBeGreaterThan(1);
    });
  });

  describe('randomDelay', () => {
    test('should delay for random time within range', async () => {
      const start = Date.now();
      await scraper.randomDelay(100, 200);
      const end = Date.now();
      const duration = end - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThanOrEqual(250); // Allow some buffer
    });

    test('should use default range when not specified', async () => {
      const start = Date.now();
      await scraper.randomDelay();
      const end = Date.now();
      const duration = end - start;
      
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(duration).toBeLessThanOrEqual(1300); // Allow some buffer
    });
  });

  describe('humanMouseMove', () => {
    test('should move mouse when page is available', async () => {
      await scraper.initSession();
      await scraper.humanMouseMove();
      
      expect(mockPage.mouse.move).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        { steps: 10 }
      );
    });

    test('should not move mouse when page is null', async () => {
      await scraper.humanMouseMove();
      expect(mockPage.mouse.move).not.toHaveBeenCalled();
    });
  });
}); 