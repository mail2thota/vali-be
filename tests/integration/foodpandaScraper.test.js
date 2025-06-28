const FoodpandaScraper = require('../../scrapers/foodpandaScraper');
const { saveCookies, loadCookies, importCookiesFromBrowser } = require('../../session/sessionManager');

// Mock the session manager
jest.mock('../../session/sessionManager');

// Mock readline for manual solve
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((prompt, callback) => callback()),
    close: jest.fn()
  }))
}));

describe('FoodpandaScraper Integration Tests', () => {
  let scraper;
  let mockPage;
  let mockContext;
  let mockBrowser;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create comprehensive mock page
    mockPage = {
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      click: jest.fn(),
      fill: jest.fn(),
      keyboard: {
        press: jest.fn()
      },
      waitForTimeout: jest.fn(),
      $$eval: jest.fn(),
      screenshot: jest.fn(),
      mouse: {
        move: jest.fn()
      },
      addInitScript: jest.fn()
    };

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      addCookies: jest.fn(),
      cookies: jest.fn().mockResolvedValue([
        { name: 'session_id', value: 'test123' }
      ])
    };

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn()
    };

    // Mock chromium.launch
    const { chromium } = require('playwright');
    chromium.launch = jest.fn().mockResolvedValue(mockBrowser);

    scraper = new FoodpandaScraper();
  });

  afterEach(async () => {
    if (scraper.browser) {
      await scraper.closeSession();
    }
  });

  describe('constructor', () => {
    test('should initialize with non-headless mode', () => {
      expect(scraper.options.headless).toBe(false);
    });
  });

  describe('checkIfLoggedIn', () => {
    beforeEach(async () => {
      await scraper.initSession();
    });

    test('should detect logged in state with avatar selector', async () => {
      mockPage.waitForSelector.mockResolvedValueOnce({});

      const result = await scraper.checkIfLoggedIn();

      expect(result).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'img[alt*="avatar"]',
        { timeout: 3000 }
      );
    });

    test('should detect logged in state with user profile selector', async () => {
      mockPage.waitForSelector
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({});

      const result = await scraper.checkIfLoggedIn();

      expect(result).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '.user-avatar',
        { timeout: 3000 }
      );
    });

    test('should detect not logged in when login button is visible', async () => {
      mockPage.waitForSelector
        .mockRejectedValue(new Error('Not found')); // All login indicators fail
      
      // Login button is found (not logged in)
      mockPage.waitForSelector.mockResolvedValueOnce({});

      const result = await scraper.checkIfLoggedIn();

      expect(result).toBe(false);
    });

    test('should detect logged in when login button is not found', async () => {
      mockPage.waitForSelector
        .mockRejectedValue(new Error('Not found')); // All selectors fail

      const result = await scraper.checkIfLoggedIn();

      expect(result).toBe(true);
    });
  });

  describe('setDeliveryLocation', () => {
    beforeEach(async () => {
      await scraper.initSession();
    });

    test('should set delivery location successfully', async () => {
      const location = 'Kuala Lumpur, Malaysia';
      const mockAddressInput = {
        click: jest.fn(),
        fill: jest.fn()
      };

      mockPage.waitForSelector.mockResolvedValueOnce(mockAddressInput);
      mockPage.waitForSelector.mockResolvedValueOnce({}); // Suggestion selector

      await scraper.setDeliveryLocation(location);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[placeholder="Enter your full address"]',
        { timeout: 5000 }
      );
      expect(mockAddressInput.click).toHaveBeenCalled();
      expect(mockAddressInput.fill).toHaveBeenCalledWith('');
      expect(mockAddressInput.fill).toHaveBeenCalledWith(location);
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    test('should try multiple address selectors when first fails', async () => {
      const location = 'Kuala Lumpur, Malaysia';
      const mockAddressInput = {
        click: jest.fn(),
        fill: jest.fn()
      };

      mockPage.waitForSelector
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(mockAddressInput);
      mockPage.waitForSelector.mockResolvedValueOnce({}); // Suggestion selector

      await scraper.setDeliveryLocation(location);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[placeholder="Enter your full address"]',
        { timeout: 5000 }
      );
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[placeholder*="address"]',
        { timeout: 5000 }
      );
    });

    test('should handle no address input found', async () => {
      const location = 'Kuala Lumpur, Malaysia';

      mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));
      mockPage.$$eval.mockResolvedValue([
        { placeholder: 'Search', type: 'text' }
      ]);

      await expect(scraper.setDeliveryLocation(location)).rejects.toThrow('Address input not found');
    });

    test('should handle no address suggestions', async () => {
      const location = 'Kuala Lumpur, Malaysia';
      const mockAddressInput = {
        click: jest.fn(),
        fill: jest.fn()
      };

      mockPage.waitForSelector.mockResolvedValueOnce(mockAddressInput);
      mockPage.waitForSelector.mockRejectedValue(new Error('No suggestions')); // All suggestion selectors fail

      await scraper.setDeliveryLocation(location);

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(5000);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await scraper.initSession();
    });

    test('should perform login successfully', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const userId = 'testuser';

      await scraper.login(email, password, userId);

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.foodpanda.my/',
        { waitUntil: 'domcontentloaded' }
      );
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'a[href*="login"], button:has-text("Log in")',
        { timeout: 30000 }
      );
      expect(mockPage.click).toHaveBeenCalledWith(
        'a[href*="login"], button:has-text("Log in")'
      );
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[type="email"], input[name*="email"]',
        { timeout: 30000 }
      );
      expect(mockPage.fill).toHaveBeenCalledWith(
        'input[type="email"], input[name*="email"]',
        email
      );
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[type="password"]',
        { timeout: 30000 }
      );
      expect(mockPage.fill).toHaveBeenCalledWith(
        'input[type="password"]',
        password
      );
      expect(saveCookies).toHaveBeenCalledWith('foodpanda', userId, expect.any(Array));
    }, 10000);

    test('should handle OTP requirement', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const userId = 'testuser';

      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login button
        .mockResolvedValueOnce({}) // Email input
        .mockResolvedValueOnce({}) // Password input
        .mockResolvedValueOnce({}) // OTP input
        .mockResolvedValueOnce({}); // Final wait

      await scraper.login(email, password, userId);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[type="tel"]:not([name*="phone"])',
        { timeout: 10000 }
      );
    }, 10000);
  });

  describe('scrape', () => {
    const mockSearchResults = [
      {
        name: 'Restaurant A',
        cuisine: 'Italian',
        deliveryTime: '30-45 min',
        deliveryFee: 'RM 5',
        link: 'https://foodpanda.my/restaurant-a'
      },
      {
        name: 'Restaurant B',
        cuisine: 'Chinese',
        deliveryTime: '25-40 min',
        deliveryFee: 'RM 3',
        link: 'https://foodpanda.my/restaurant-b'
      }
    ];

    beforeEach(async () => {
      await scraper.initSession();
    });

    test('should scrape with imported cookies successfully', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      // Mock imported cookies
      importCookiesFromBrowser.mockResolvedValue([
        { name: 'token', value: 'valid_token' }
      ]);
      loadCookies.mockResolvedValue(null);

      // Mock logged in state
      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login indicator found
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue(mockSearchResults);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(importCookiesFromBrowser).toHaveBeenCalledWith('foodpanda', userId);
      expect(mockContext.addCookies).toHaveBeenCalledWith([
        { name: 'token', value: 'valid_token' }
      ]);
      expect(result).toEqual([{
        platform: 'foodpanda',
        query: searchQuery,
        location,
        results: mockSearchResults
      }]);
    }, 15000);

    test('should fall back to manual login when cookies fail', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      // Mock no imported cookies, but existing cookies
      importCookiesFromBrowser.mockResolvedValue(null);
      loadCookies.mockResolvedValue([
        { name: 'expired_token', value: 'expired' }
      ]);

      // Mock not logged in state
      mockPage.waitForSelector
        .mockRejectedValue(new Error('Not found')) // No login indicators
        .mockResolvedValueOnce({}) // Login button found (not logged in)
        .mockResolvedValueOnce({}) // Login button
        .mockResolvedValueOnce({}) // Email input
        .mockResolvedValueOnce({}) // Password input
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue(mockSearchResults);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(mockContext.addCookies).toHaveBeenCalledWith([
        { name: 'expired_token', value: 'expired' }
      ]);
      expect(result).toEqual([{
        platform: 'foodpanda',
        query: searchQuery,
        location,
        results: mockSearchResults
      }]);
    }, 15000);

    test('should handle cookie consent popup', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      importCookiesFromBrowser.mockResolvedValue([
        { name: 'token', value: 'valid_token' }
      ]);
      loadCookies.mockResolvedValue(null);

      // Mock logged in state and cookie popup
      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login indicator
        .mockResolvedValueOnce({}) // Cookie accept button
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue(mockSearchResults);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(mockPage.click).toHaveBeenCalledWith('button:has-text("Accept")');
      expect(result).toEqual([{
        platform: 'foodpanda',
        query: searchQuery,
        location,
        results: mockSearchResults
      }]);
    }, 15000);

    test('should handle errors and take screenshot', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      importCookiesFromBrowser.mockResolvedValue(null);
      loadCookies.mockResolvedValue(null);

      // Mock error during scraping
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      await expect(scraper.scrape(searchQuery, location, userId, email, password))
        .rejects.toThrow('Network error');

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: 'foodpanda_error.png',
        fullPage: true
      });
    }, 10000);

    test('should extract restaurant data correctly', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      importCookiesFromBrowser.mockResolvedValue([
        { name: 'token', value: 'valid_token' }
      ]);
      loadCookies.mockResolvedValue(null);

      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login indicator
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue(mockSearchResults);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(mockPage.$$eval).toHaveBeenCalledWith(
        '.vendor-list .vendor-list-item',
        expect.any(Function)
      );
      expect(result[0].results).toEqual(mockSearchResults);
    }, 15000);
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await scraper.initSession();
    });

    test('should handle timeout errors gracefully', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));

      await expect(scraper.checkIfLoggedIn()).resolves.toBe(false);
    });

    test('should handle network errors during page navigation', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      await expect(scraper.login('test@example.com', 'password', 'user'))
        .rejects.toThrow('Network error');
    });
  });
}); 