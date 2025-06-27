const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR);
}

function getSessionFilePath(platform, userId) {
  return path.join(SESSION_DIR, `${platform}_${userId}.json`);
}

function normalizeCookies(cookies) {
  return cookies.map(cookie => {
    // Normalize sameSite values for Playwright compatibility
    let sameSite = cookie.sameSite;
    if (sameSite === 'no_restriction' || sameSite === null || sameSite === undefined) {
      sameSite = 'None';
    } else if (sameSite === 'lax') {
      sameSite = 'Lax';
    } else if (sameSite === 'strict') {
      sameSite = 'Strict';
    }
    
    return {
      ...cookie,
      sameSite: sameSite,
      // Ensure required fields are present
      domain: cookie.domain || '',
      name: cookie.name || '',
      value: cookie.value || '',
      path: cookie.path || '/',
      secure: cookie.secure || false,
      httpOnly: cookie.httpOnly || false,
      // Remove fields that Playwright doesn't expect
      hostOnly: undefined,
      storeId: undefined
    };
  });
}

async function saveCookies(platform, userId, cookies) {
  // TODO: Encrypt cookies before saving
  fs.writeFileSync(getSessionFilePath(platform, userId), JSON.stringify(cookies));
}

async function loadCookies(platform, userId) {
  const filePath = getSessionFilePath(platform, userId);
  if (fs.existsSync(filePath)) {
    // TODO: Decrypt cookies after loading
    const cookies = JSON.parse(fs.readFileSync(filePath));
    return normalizeCookies(cookies);
  }
  return null;
}

async function loadCookiesFromExportedFile(platform, userId, exportedFilePath) {
  try {
    // Read the exported cookie file
    const exportedCookies = JSON.parse(fs.readFileSync(exportedFilePath, 'utf8'));
    
    // Normalize the cookies for Playwright
    const normalizedCookies = normalizeCookies(exportedCookies);
    
    // Save them to the session manager format
    await saveCookies(platform, userId, normalizedCookies);
    
    console.log(`✅ Successfully imported ${normalizedCookies.length} cookies from ${exportedFilePath}`);
    return normalizedCookies;
  } catch (error) {
    console.error(`❌ Error loading cookies from ${exportedFilePath}:`, error.message);
    return null;
  }
}

async function importCookiesFromBrowser(platform, userId) {
  const exportedFilePath = path.join(SESSION_DIR, `${platform}_exported.json`);
  
  if (fs.existsSync(exportedFilePath)) {
    console.log(`📁 Found exported cookie file: ${exportedFilePath}`);
    return await loadCookiesFromExportedFile(platform, userId, exportedFilePath);
  } else {
    console.log(`📁 No exported cookie file found at: ${exportedFilePath}`);
    console.log('💡 To use this feature:');
    console.log('   1. Install EditThisCookie or Cookie-Editor Chrome extension');
    console.log('   2. Go to foodpanda.my and log in manually');
    console.log('   3. Export cookies and save as:', exportedFilePath);
    console.log('   4. Run this script again');
    return null;
  }
}

module.exports = { 
  saveCookies, 
  loadCookies, 
  loadCookiesFromExportedFile,
  importCookiesFromBrowser,
  normalizeCookies
}; 