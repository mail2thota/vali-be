const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR);
}

function getSessionFilePath(platform, userId) {
  return path.join(SESSION_DIR, `${platform}_${userId}.json`);
}

async function saveCookies(platform, userId, cookies) {
  // TODO: Encrypt cookies before saving
  fs.writeFileSync(getSessionFilePath(platform, userId), JSON.stringify(cookies));
}

async function loadCookies(platform, userId) {
  const filePath = getSessionFilePath(platform, userId);
  if (fs.existsSync(filePath)) {
    // TODO: Decrypt cookies after loading
    return JSON.parse(fs.readFileSync(filePath));
  }
  return null;
}

module.exports = { saveCookies, loadCookies }; 