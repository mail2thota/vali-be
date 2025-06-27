const BaseScraper = require('./baseScraper');
const fs = require('fs');
const { saveCookies, loadCookies } = require('../session/sessionManager');

class FoodpandaScraper extends BaseScraper {
  constructor(options = {}) {
    super({ ...options, headless: false }); // Always launch in non-headless mode for manual solve/login
  }

  async login(email, password, userId) {
    await this.page.goto('https://www.foodpanda.my/', { waitUntil: 'domcontentloaded' });
    // Pause for manual captcha solving BEFORE any login actions
    await this.waitForManualSolve('If you see a captcha, please solve it in the browser, then press Enter here to continue...');
    // Click login button
    await this.page.waitForSelector('a[href*="login"], button:has-text("Log in")', { timeout: 30000 });
    await this.page.click('a[href*="login"], button:has-text("Log in")');
    // Wait for email input
    await this.page.waitForSelector('input[type="email"], input[name*="email"]', { timeout: 30000 });
    await this.page.fill('input[type="email"], input[name*="email"]', email);
    // Click next/continue
    await this.page.click('button:has-text("Next"), button:has-text("Continue")');
    // Wait for password input
    await this.page.waitForSelector('input[type="password"]', { timeout: 30000 });
    await this.page.fill('input[type="password"]', password);
    // Click login/submit
    await this.page.click('button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")');
    // Wait for OTP if required
    try {
      await this.page.waitForSelector('input[type="tel"]:not([name*="phone"])', { timeout: 10000 });
      await this.waitForManualSolve('If OTP is required, please enter it in the browser, then press Enter here to continue...');
    } catch (e) {
      // No OTP input, continue
    }
    // Wait for login to complete (e.g., user avatar or dashboard)
    await this.page.waitForTimeout(5000);
    // Save cookies
    const cookies = await this.context.cookies();
    await saveCookies('foodpanda', userId, cookies);
  }

  async scrape(searchQuery, location, userId, email, password) {
    await this.initSession();
    try {
      // Try to load cookies
      let cookies = await loadCookies('foodpanda', userId);
      let loggedIn = false;
      if (cookies && cookies.length > 0) {
        await this.context.addCookies(cookies);
        await this.page.goto('https://www.foodpanda.my/', { waitUntil: 'domcontentloaded' });
        // Check if logged in (e.g., look for user avatar or dashboard)
        try {
          await this.page.waitForSelector('img[alt*="avatar"], .user-avatar, .profile-menu', { timeout: 15000 });
          loggedIn = true;
        } catch (e) {
          loggedIn = false;
        }
      }
      if (!loggedIn) {
        // Perform login (captcha will be handled inside login)
        await this.login(email, password, userId);
      }
      // Handle cookie consent popup if present
      try {
        await this.page.waitForSelector('button:has-text("Accept")', { timeout: 5000 });
        await this.page.click('button:has-text("Accept")');
      } catch (e) {
        // No cookie popup, continue
      }
      // Try multiple selectors for address input
      let addressInputFound = false;
      const addressSelectors = [
        'input[placeholder="Enter your full address"]',
        'input[placeholder*="address"]',
        'input[type="text"]',
      ];
      for (const selector of addressSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 8000 });
          await this.page.fill(selector, location);
          await this.page.keyboard.press('Enter');
          addressInputFound = true;
          break;
        } catch (e) {
          // Try next selector
        }
      }
      if (!addressInputFound) throw new Error('Address input not found');
      // Wait for address suggestions and select the first one
      await this.page.waitForSelector('.address-autocomplete__item', { timeout: 15000 });
      await this.page.click('.address-autocomplete__item');
      // Wait for the page to load restaurants for the location
      await this.page.waitForTimeout(5000);
      // Search for the query
      await this.page.waitForSelector('input[placeholder="Search for restaurant or cuisine"]', { timeout: 15000 });
      await this.page.fill('input[placeholder="Search for restaurant or cuisine"]', searchQuery);
      await this.page.keyboard.press('Enter');
      // Wait for search results
      await this.page.waitForTimeout(5000);
      // Extract restaurant data from search results
      const results = await this.page.$$eval(
        '.vendor-list .vendor-list-item',
        (cards) => cards.map(card => {
          // Restaurant name
          const name = card.querySelector('.name, h3, .vendor-name')?.textContent?.trim() || '';
          // Cuisine/type
          const cuisine = card.querySelector('.cuisine, .vendor-cuisine')?.textContent?.trim() || '';
          // Delivery time
          const deliveryTime = card.querySelector('.delivery-time, .vendor-delivery-time')?.textContent?.trim() || '';
          // Delivery fee
          const deliveryFee = card.querySelector('.delivery-fee, .vendor-delivery-fee')?.textContent?.trim() || '';
          // Restaurant link
          const link = card.querySelector('a')?.href || '';
          return { name, cuisine, deliveryTime, deliveryFee, link };
        })
      );
      await this.closeSession();
      return [{
        platform: 'foodpanda',
        query: searchQuery,
        location,
        results
      }];
    } catch (err) {
      // Take a screenshot for debugging
      if (this.page) {
        await this.page.screenshot({ path: 'foodpanda_error.png', fullPage: true });
      }
      await this.closeSession();
      throw err;
    }
  }
}

module.exports = FoodpandaScraper; 