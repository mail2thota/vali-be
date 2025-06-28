const fs = require('fs');
const path = require('path');

/**
 * Test helper utilities for VaLi scraper tests
 */
class TestHelpers {
  /**
   * Generate mock restaurant data for testing
   * @param {number} count - Number of restaurants to generate
   * @param {string} cuisine - Cuisine type
   * @returns {Array} Array of mock restaurant objects
   */
  static generateMockRestaurants(count = 5, cuisine = 'Mixed') {
    const restaurants = [
      'Pizza Hut',
      'McDonald\'s',
      'KFC',
      'Subway',
      'Domino\'s Pizza',
      'Burger King',
      'Starbucks',
      'Nando\'s',
      'Papa John\'s',
      'Wendy\'s'
    ];

    const cuisines = [
      'Pizza, Fast Food',
      'Fast Food, Burgers',
      'Fast Food, Chicken',
      'Fast Food, Sandwiches',
      'Pizza, Italian',
      'Fast Food, Burgers',
      'Coffee, Beverages',
      'Chicken, Portuguese',
      'Pizza, Italian',
      'Fast Food, Burgers'
    ];

    const deliveryTimes = [
      '20-35 min',
      '25-40 min',
      '30-45 min',
      '35-50 min',
      '15-30 min'
    ];

    const deliveryFees = [
      'RM 3',
      'RM 4',
      'RM 5',
      'RM 6',
      'Free delivery'
    ];

    return Array.from({ length: count }, (_, index) => ({
      name: restaurants[index % restaurants.length],
      cuisine: cuisines[index % cuisines.length],
      deliveryTime: deliveryTimes[index % deliveryTimes.length],
      deliveryFee: deliveryFees[index % deliveryFees.length],
      link: `https://foodpanda.my/${restaurants[index % restaurants.length].toLowerCase().replace(/\s+/g, '-')}`
    }));
  }

  /**
   * Generate mock cookies for testing
   * @param {number} count - Number of cookies to generate
   * @returns {Array} Array of mock cookie objects
   */
  static generateMockCookies(count = 3) {
    const cookieNames = ['session_id', 'auth_token', 'user_id', 'device_token', 'refresh_token'];
    const cookieValues = ['abc123', 'xyz789', 'def456', 'ghi012', 'jkl345'];

    return Array.from({ length: count }, (_, index) => ({
      name: cookieNames[index % cookieNames.length],
      value: cookieValues[index % cookieValues.length],
      domain: '.foodpanda.my',
      path: '/',
      secure: true,
      httpOnly: index % 2 === 0,
      sameSite: index % 3 === 0 ? 'Lax' : index % 3 === 1 ? 'Strict' : 'None',
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    }));
  }

  /**
   * Generate mock expired cookies for testing
   * @param {number} count - Number of cookies to generate
   * @returns {Array} Array of mock expired cookie objects
   */
  static generateMockExpiredCookies(count = 2) {
    const cookies = this.generateMockCookies(count);
    return cookies.map(cookie => ({
      ...cookie,
      expires: Date.now() - (24 * 60 * 60 * 1000) // 24 hours ago
    }));
  }

  /**
   * Create a mock page object for testing
   * @param {Object} options - Mock page options
   * @returns {Object} Mock page object
   */
  static createMockPage(options = {}) {
    const defaultPage = {
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
      content: jest.fn().mockReturnValue('<html><body><div>Foodpanda</div></body></html>')
    };

    return { ...defaultPage, ...options };
  }

  /**
   * Create a mock browser context for testing
   * @param {Object} options - Mock context options
   * @returns {Object} Mock context object
   */
  static createMockContext(options = {}) {
    const defaultContext = {
      newPage: jest.fn(),
      addCookies: jest.fn(),
      cookies: jest.fn().mockResolvedValue(TestHelpers.generateMockCookies(2))
    };

    return { ...defaultContext, ...options };
  }

  /**
   * Create a mock browser for testing
   * @param {Object} options - Mock browser options
   * @returns {Object} Mock browser object
   */
  static createMockBrowser(options = {}) {
    const defaultBrowser = {
      newContext: jest.fn(),
      close: jest.fn()
    };

    return { ...defaultBrowser, ...options };
  }

  /**
   * Setup complete mock browser chain for testing
   * @param {Object} pageOptions - Options for mock page
   * @param {Object} contextOptions - Options for mock context
   * @param {Object} browserOptions - Options for mock browser
   * @returns {Object} Object with mockPage, mockContext, mockBrowser
   */
  static setupMockBrowserChain(pageOptions = {}, contextOptions = {}, browserOptions = {}) {
    const mockPage = this.createMockPage(pageOptions);
    const mockContext = this.createMockContext({
      newPage: jest.fn().mockResolvedValue(mockPage),
      ...contextOptions
    });
    const mockBrowser = this.createMockBrowser({
      newContext: jest.fn().mockResolvedValue(mockContext),
      ...browserOptions
    });

    return { mockPage, mockContext, mockBrowser };
  }

  /**
   * Mock chromium.launch for testing
   * @param {Object} mockBrowser - Mock browser object
   */
  static mockChromiumLaunch(mockBrowser) {
    const { chromium } = require('playwright');
    chromium.launch = jest.fn().mockResolvedValue(mockBrowser);
  }

  /**
   * Create test session directory and files
   * @param {string} platform - Platform name
   * @param {string} userId - User ID
   * @param {Array} cookies - Cookies to save
   */
  static createTestSession(platform, userId, cookies = []) {
    const sessionDir = path.join(__dirname, '../../session/sessions');
    const sessionFile = path.join(sessionDir, `${platform}_${userId}.json`);
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    fs.writeFileSync(sessionFile, JSON.stringify(cookies));
    return sessionFile;
  }

  /**
   * Clean up test session files
   * @param {string} platform - Platform name
   * @param {string} userId - User ID
   */
  static cleanupTestSession(platform, userId) {
    const sessionFile = path.join(__dirname, '../../session/sessions', `${platform}_${userId}.json`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }
  }

  /**
   * Create test exported cookie file
   * @param {string} platform - Platform name
   * @param {Array} cookies - Cookies to save
   */
  static createTestExportedCookies(platform, cookies = []) {
    const sessionDir = path.join(__dirname, '../../session/sessions');
    const exportedFile = path.join(sessionDir, `${platform}_exported.json`);
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    fs.writeFileSync(exportedFile, JSON.stringify(cookies));
    return exportedFile;
  }

  /**
   * Clean up test exported cookie file
   * @param {string} platform - Platform name
   */
  static cleanupTestExportedCookies(platform) {
    const exportedFile = path.join(__dirname, '../../session/sessions', `${platform}_exported.json`);
    if (fs.existsSync(exportedFile)) {
      fs.unlinkSync(exportedFile);
    }
  }

  /**
   * Assert that a function throws with specific error message
   * @param {Function} fn - Function to test
   * @param {string} expectedError - Expected error message
   */
  static async assertThrowsWithMessage(fn, expectedError) {
    await expect(fn()).rejects.toThrow(expectedError);
  }

  /**
   * Assert that a function completes within a time limit
   * @param {Function} fn - Function to test
   * @param {number} timeout - Timeout in milliseconds
   */
  static async assertCompletesWithin(fn, timeout = 5000) {
    const start = Date.now();
    await fn();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(timeout);
  }

  /**
   * Wait for a specified amount of time
   * @param {number} ms - Milliseconds to wait
   */
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random test data
   * @param {string} type - Type of data to generate
   * @returns {any} Random test data
   */
  static generateRandomTestData(type) {
    switch (type) {
      case 'email':
        return `test${Date.now()}@example.com`;
      case 'password':
        return `password${Date.now()}`;
      case 'userId':
        return `user${Date.now()}`;
      case 'location':
        const locations = ['Kuala Lumpur', 'Petaling Jaya', 'Shah Alam', 'Subang Jaya'];
        return locations[Math.floor(Math.random() * locations.length)];
      case 'searchQuery':
        const queries = ['pizza', 'burger', 'chinese', 'indian', 'thai'];
        return queries[Math.floor(Math.random() * queries.length)];
      default:
        return `test${Date.now()}`;
    }
  }

  /**
   * Create mock login flow responses
   * @param {Object} options - Login flow options
   * @returns {Object} Mock responses for login flow
   */
  static createMockLoginFlow(options = {}) {
    const {
      hasOTP = false,
      hasCaptcha = false,
      loginSuccess = true,
      timeout = false
    } = options;

    const responses = {
      loginButton: { success: true },
      emailInput: { success: true },
      passwordInput: { success: true },
      otpInput: { success: hasOTP },
      captcha: { success: hasCaptcha },
      finalWait: { success: loginSuccess }
    };

    if (timeout) {
      responses.loginButton.success = false;
      responses.loginButton.error = 'Timeout';
    }

    return responses;
  }

  /**
   * Create mock location setting responses
   * @param {Object} options - Location setting options
   * @returns {Object} Mock responses for location setting
   */
  static createMockLocationFlow(options = {}) {
    const {
      addressInputFound = true,
      suggestionsFound = true,
      timeout = false
    } = options;

    const responses = {
      addressInput: { success: addressInputFound },
      suggestions: { success: suggestionsFound }
    };

    if (timeout) {
      responses.addressInput.success = false;
      responses.addressInput.error = 'Timeout';
    }

    return responses;
  }

  /**
   * Validate restaurant data structure
   * @param {Object} restaurant - Restaurant object to validate
   * @returns {boolean} True if valid
   */
  static validateRestaurantData(restaurant) {
    const requiredFields = ['name', 'cuisine', 'deliveryTime', 'deliveryFee', 'link'];
    return requiredFields.every(field => 
      restaurant.hasOwnProperty(field) && 
      typeof restaurant[field] === 'string' && 
      restaurant[field].length > 0
    );
  }

  /**
   * Validate cookie data structure
   * @param {Object} cookie - Cookie object to validate
   * @returns {boolean} True if valid
   */
  static validateCookieData(cookie) {
    const requiredFields = ['name', 'value', 'domain', 'path'];
    return requiredFields.every(field => 
      cookie.hasOwnProperty(field) && 
      typeof cookie[field] === 'string' && 
      cookie[field].length > 0
    );
  }

  /**
   * Create a test configuration object
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Test configuration
   */
  static createTestConfig(overrides = {}) {
    const defaultConfig = {
      headless: false,
      timeout: 30000,
      retries: 3,
      delay: {
        min: 300,
        max: 1200
      },
      selectors: {
        loginButton: 'a[href*="login"], button:has-text("Log in")',
        emailInput: 'input[type="email"], input[name*="email"]',
        passwordInput: 'input[type="password"]',
        addressInput: 'input[placeholder="Enter your full address"]',
        searchInput: 'input[placeholder="Search for restaurant or cuisine"]'
      }
    };

    return { ...defaultConfig, ...overrides };
  }
}

module.exports = TestHelpers; 