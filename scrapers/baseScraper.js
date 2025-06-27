const { chromium } = require('playwright');
const readline = require('readline');

class BaseScraper {
  constructor(options = {}) {
    this.options = options;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initSession() {
    this.browser = await chromium.launch({ headless: this.options.headless !== false });
    this.context = await this.browser.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      extraHTTPHeaders: {
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    this.page = await this.context.newPage();
    // Set navigator properties to look more human
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    });
  }

  async closeSession() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async waitForManualSolve(message = 'Please solve the captcha in the browser, then press Enter here to continue...') {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(`\n${message}\n`, () => {
        rl.close();
        resolve();
      });
    });
  }

  async scrape() {
    throw new Error('scrape() must be implemented by subclass');
  }

  getRandomUserAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  async randomDelay(min = 300, max = 1200) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(res => setTimeout(res, ms));
  }

  async humanMouseMove() {
    if (this.page) {
      const width = 800 + Math.random() * 400;
      const height = 600 + Math.random() * 200;
      await this.page.mouse.move(width, height, { steps: 10 });
      await this.randomDelay(200, 600);
    }
  }
}

module.exports = BaseScraper; 