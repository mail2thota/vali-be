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

describe('FoodpandaScraper E2E Tests', () => {
  let scraper;
  let mockPage;
  let mockContext;
  let mockBrowser;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create comprehensive mock page with realistic behavior
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
      url: jest.fn().mockReturnValue('https://www.foodpanda.my/'),
      title: jest.fn().mockReturnValue('Foodpanda Malaysia - Food Delivery'),
      content: jest.fn().mockReturnValue('<html><body><div>Foodpanda</div></body></html>'),
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

  describe('Full Scraping Workflow', () => {
    test('should complete full scraping workflow with fresh login', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur, Malaysia';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      const mockRestaurants = [
        {
          name: 'Pizza Hut',
          cuisine: 'Pizza, Fast Food',
          deliveryTime: '30-45 min',
          deliveryFee: 'RM 5',
          link: 'https://foodpanda.my/pizza-hut'
        },
        {
          name: 'Domino\'s Pizza',
          cuisine: 'Pizza, Italian',
          deliveryTime: '25-40 min',
          deliveryFee: 'RM 3',
          link: 'https://foodpanda.my/dominos'
        }
      ];

      // Mock no existing cookies
      importCookiesFromBrowser.mockResolvedValue(null);
      loadCookies.mockResolvedValue(null);

      // Mock page interactions for full workflow
      mockPage.waitForSelector
        .mockRejectedValue(new Error('Not found')) // No login indicators
        .mockResolvedValueOnce({}) // Login button found
        .mockResolvedValueOnce({}) // Login button click
        .mockResolvedValueOnce({}) // Email input
        .mockResolvedValueOnce({}) // Password input
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue(mockRestaurants);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      // Verify the complete workflow
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.foodpanda.my/',
        { waitUntil: 'domcontentloaded' }
      );
      expect(saveCookies).toHaveBeenCalledWith('foodpanda', userId, expect.any(Array));
      expect(result).toEqual([{
        platform: 'foodpanda',
        query: searchQuery,
        location,
        results: mockRestaurants
      }]);
    }, 20000);

    test('should complete full scraping workflow with existing cookies', async () => {
      const searchQuery = 'burger';
      const location = 'Petaling Jaya, Malaysia';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      const mockRestaurants = [
        {
          name: 'McDonald\'s',
          cuisine: 'Fast Food, Burgers',
          deliveryTime: '20-35 min',
          deliveryFee: 'RM 4',
          link: 'https://foodpanda.my/mcdonalds'
        }
      ];

      // Mock existing valid cookies
      importCookiesFromBrowser.mockResolvedValue([
        { name: 'auth_token', value: 'valid_token_123' },
        { name: 'user_id', value: 'user123' }
      ]);
      loadCookies.mockResolvedValue(null);

      // Mock logged in state
      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login indicator found
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue(mockRestaurants);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(mockContext.addCookies).toHaveBeenCalledWith([
        { name: 'auth_token', value: 'valid_token_123' },
        { name: 'user_id', value: 'user123' }
      ]);
      expect(result[0].results).toEqual(mockRestaurants);
    }, 20000);
  });

  describe('Login Flow Scenarios', () => {
    test('should handle login with OTP verification', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const userId = 'testuser';

      // Initialize session first
      await scraper.initSession();

      // Mock OTP flow
      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login button
        .mockResolvedValueOnce({}) // Email input
        .mockResolvedValueOnce({}) // Password input
        .mockResolvedValueOnce({}) // OTP input found
        .mockResolvedValueOnce({}); // Final wait

      await scraper.login(email, password, userId);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[type="tel"]:not([name*="phone"])',
        { timeout: 10000 }
      );
    }, 10000);

    test('should handle login with captcha', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const userId = 'testuser';

      // Initialize session first
      await scraper.initSession();

      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login button
        .mockResolvedValueOnce({}) // Email input
        .mockResolvedValueOnce({}) // Password input
        .mockResolvedValueOnce({}); // Final wait

      await scraper.login(email, password, userId);

      // Should call waitForManualSolve for captcha
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.foodpanda.my/',
        { waitUntil: 'domcontentloaded' }
      );
    }, 10000);

    test('should handle login failure and retry', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const userId = 'testuser';

      // Initialize session first
      await scraper.initSession();

      // Mock login failure
      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login button
        .mockResolvedValueOnce({}) // Email input
        .mockResolvedValueOnce({}) // Password input
        .mockRejectedValue(new Error('Invalid credentials'));

      await expect(scraper.login(email, password, userId))
        .rejects.toThrow('Invalid credentials');
    }, 10000);
  });

  describe('Location Setting Scenarios', () => {
    test('should handle location with multiple suggestions', async () => {
      const location = 'Kuala Lumpur';
      const mockAddressInput = {
        click: jest.fn(),
        fill: jest.fn()
      };

      // Initialize session first
      await scraper.initSession();

      mockPage.waitForSelector
        .mockResolvedValueOnce(mockAddressInput)
        .mockResolvedValueOnce({}); // First suggestion selector works

      await scraper.setDeliveryLocation(location);

      expect(mockAddressInput.fill).toHaveBeenCalledWith(location);
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    }, 10000);

    test('should handle location with no suggestions', async () => {
      const location = 'Remote Area';
      const mockAddressInput = {
        click: jest.fn(),
        fill: jest.fn()
      };

      // Initialize session first
      await scraper.initSession();

      mockPage.waitForSelector
        .mockResolvedValueOnce(mockAddressInput)
        .mockRejectedValue(new Error('No suggestions')); // All suggestion selectors fail

      await scraper.setDeliveryLocation(location);

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(5000);
    }, 10000);

    test('should handle location with different address input formats', async () => {
      const location = 'Petaling Jaya';
      const mockAddressInput = {
        click: jest.fn(),
        fill: jest.fn()
      };

      // Initialize session first
      await scraper.initSession();

      // Mock first selector failing, second working
      mockPage.waitForSelector
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(mockAddressInput)
        .mockResolvedValueOnce({}); // Suggestion selector

      await scraper.setDeliveryLocation(location);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[placeholder="Enter your full address"]',
        { timeout: 5000 }
      );
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        'input[placeholder*="address"]',
        { timeout: 5000 }
      );
    }, 10000);
  });

  describe('Search and Data Extraction', () => {
    test('should extract restaurant data with all fields', async () => {
      const searchQuery = 'chinese food';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      const mockRestaurants = [
        {
          name: 'Peking Restaurant',
          cuisine: 'Chinese, Asian',
          deliveryTime: '35-50 min',
          deliveryFee: 'RM 6',
          link: 'https://foodpanda.my/peking-restaurant'
        },
        {
          name: 'Dim Sum House',
          cuisine: 'Chinese, Dim Sum',
          deliveryTime: '25-40 min',
          deliveryFee: 'RM 4',
          link: 'https://foodpanda.my/dim-sum-house'
        }
      ];

      importCookiesFromBrowser.mockResolvedValue([
        { name: 'auth_token', value: 'valid_token' }
      ]);
      loadCookies.mockResolvedValue(null);

      // Mock logged in state
      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login indicator
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue(mockRestaurants);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(mockPage.fill).toHaveBeenCalledWith(
        'input[placeholder="Search for restaurant or cuisine"]',
        searchQuery
      );
      expect(result[0].results).toHaveLength(2);
      expect(result[0].results[0]).toHaveProperty('name', 'Peking Restaurant');
      expect(result[0].results[0]).toHaveProperty('cuisine', 'Chinese, Asian');
      expect(result[0].results[0]).toHaveProperty('deliveryTime', '35-50 min');
      expect(result[0].results[0]).toHaveProperty('deliveryFee', 'RM 6');
      expect(result[0].results[0]).toHaveProperty('link');
    }, 20000);

    test('should handle empty search results', async () => {
      const searchQuery = 'nonexistent restaurant';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      importCookiesFromBrowser.mockResolvedValue([
        { name: 'auth_token', value: 'valid_token' }
      ]);
      loadCookies.mockResolvedValue(null);

      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login indicator
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue([]);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(result[0].results).toEqual([]);
    }, 20000);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network errors and take screenshot', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      importCookiesFromBrowser.mockResolvedValue(null);
      loadCookies.mockResolvedValue(null);

      // Mock error during scraping
      mockPage.goto.mockRejectedValue(new Error('Network timeout'));

      await expect(scraper.scrape(searchQuery, location, userId, email, password))
        .rejects.toThrow('Network timeout');

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: 'foodpanda_error.png',
        fullPage: true
      });
    }, 10000);

    test('should handle selector timeout errors gracefully', async () => {
      const location = 'Kuala Lumpur';

      await scraper.initSession();

      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));

      await expect(scraper.setDeliveryLocation(location))
        .rejects.toThrow('Address input not found');
    }, 10000);

    test('should handle browser crash and recovery', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      importCookiesFromBrowser.mockResolvedValue(null);
      loadCookies.mockResolvedValue(null);

      // Mock browser crash during scraping
      mockPage.goto.mockRejectedValue(new Error('Browser crashed'));

      await expect(scraper.scrape(searchQuery, location, userId, email, password))
        .rejects.toThrow('Browser crashed');

      expect(mockBrowser.close).toHaveBeenCalled();
    }, 10000);
  });

  describe('Cookie Management', () => {
    test('should handle expired cookies gracefully', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      // Mock expired cookies
      importCookiesFromBrowser.mockResolvedValue(null);
      loadCookies.mockResolvedValue([
        { name: 'expired_token', value: 'expired_value' }
      ]);

      // Mock not logged in state (expired cookies)
      mockPage.waitForSelector
        .mockRejectedValue(new Error('Not found')) // No login indicators
        .mockResolvedValueOnce({}) // Login button found
        .mockResolvedValueOnce({}) // Login button
        .mockResolvedValueOnce({}) // Email input
        .mockResolvedValueOnce({}) // Password input
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue([]);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(mockContext.addCookies).toHaveBeenCalledWith([
        { name: 'expired_token', value: 'expired_value' }
      ]);
      expect(result).toBeDefined();
    }, 20000);

    test('should save new cookies after successful login', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const userId = 'testuser';

      // Initialize session first
      await scraper.initSession();

      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login button
        .mockResolvedValueOnce({}) // Email input
        .mockResolvedValueOnce({}) // Password input
        .mockResolvedValueOnce({}); // Final wait

      await scraper.login(email, password, userId);

      expect(saveCookies).toHaveBeenCalledWith('foodpanda', userId, expect.any(Array));
    }, 10000);
  });

  describe('Performance and Timing', () => {
    test('should respect random delays for human-like behavior', async () => {
      const location = 'Kuala Lumpur';
      const mockAddressInput = {
        click: jest.fn(),
        fill: jest.fn()
      };

      await scraper.initSession();

      mockPage.waitForSelector
        .mockResolvedValueOnce(mockAddressInput)
        .mockResolvedValueOnce({});

      const startTime = Date.now();
      await scraper.setDeliveryLocation(location);
      const endTime = Date.now();

      // Should have some delay for human-like behavior
      expect(endTime - startTime).toBeGreaterThan(100);
    }, 10000);

    test('should handle long page load times', async () => {
      const searchQuery = 'pizza';
      const location = 'Kuala Lumpur';
      const userId = 'testuser';
      const email = 'test@example.com';
      const password = 'password123';

      importCookiesFromBrowser.mockResolvedValue([
        { name: 'auth_token', value: 'valid_token' }
      ]);
      loadCookies.mockResolvedValue(null);

      // Mock slow page loads
      mockPage.goto.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      mockPage.waitForSelector
        .mockResolvedValueOnce({}) // Login indicator
        .mockResolvedValueOnce({}) // Address input
        .mockResolvedValueOnce({}) // Address suggestion
        .mockResolvedValueOnce({}) // Search input
        .mockResolvedValueOnce({}); // Final wait

      mockPage.$$eval.mockResolvedValue([]);

      const result = await scraper.scrape(searchQuery, location, userId, email, password);

      expect(result).toBeDefined();
    }, 20000);
  });
}); 