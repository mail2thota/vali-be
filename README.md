# VaLi AI Delivery

A Node.js-based general scraper framework for integrating with food delivery platforms in Malaysia, starting with Foodpanda.

## Features
- Search for food/restaurants on Foodpanda using Playwright automation
- Manual captcha and OTP solving for robust login
- Secure session management (cookies saved per user)
- Modular design for easy extension to other platforms

## How It Works
1. **Manual Captcha Solve:** On first run, you solve the captcha in the browser before login.
2. **Login:** Enter your Foodpanda email and password (with manual OTP if required).
3. **Session Reuse:** Session cookies are saved for future runs, so you don't need to log in every time.
4. **Scraping:** The script searches for your query and extracts restaurant data.

## Setup

1. **Clone the repo:**
   ```sh
   git clone https://github.com/mail2thota/vali-be.git
   cd vali-be
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```

## Usage

Run the test script:
```sh
node scrapers/test_foodpanda_scraper.js
```
You will be prompted for:
- User ID (for session reuse)
- Foodpanda email
- Foodpanda password

Follow the prompts in the terminal and browser:
- Solve any captcha in the browser, then press Enter in the terminal.
- Enter OTP in the browser if required, then press Enter in the terminal.
- The script will print the scraped restaurant data.

## Security Notes
- Credentials are only used for login and are not stored.
- Session cookies are saved per user in the `session/sessions/` directory (consider encrypting for production).
- Never share your credentials or session files.

## Extending
- To add new platforms, create a new scraper in `scrapers/` extending `BaseScraper`.
- Update the orchestrator to support the new platform.

## License
MIT 