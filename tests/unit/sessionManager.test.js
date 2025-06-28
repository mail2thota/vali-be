const fs = require('fs');
const path = require('path');
const {
  saveCookies,
  loadCookies,
  loadCookiesFromExportedFile,
  importCookiesFromBrowser,
  normalizeCookies
} = require('../../session/sessionManager');

// Mock fs module
jest.mock('fs');

describe('SessionManager', () => {
  const mockSessionDir = '/mock/session/dir';
  const mockCookies = [
    {
      name: 'session_id',
      value: 'abc123',
      domain: '.foodpanda.my',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
      expires: 1234567890
    },
    {
      name: 'token',
      value: 'xyz789',
      domain: '.foodpanda.my',
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'None'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs.existsSync to return true for session directory
    fs.existsSync.mockImplementation((path) => {
      if (path.includes('sessions')) return true;
      return false;
    });
    
    // Mock fs.mkdirSync to handle both single and multiple arguments
    fs.mkdirSync.mockImplementation((path, options) => {
      // Handle both fs.mkdirSync(path) and fs.mkdirSync(path, options)
      return undefined;
    });
    
    // Mock fs.writeFileSync
    fs.writeFileSync.mockImplementation(() => {});
    
    // Mock fs.readFileSync
    fs.readFileSync.mockImplementation(() => JSON.stringify(mockCookies));
  });

  describe('normalizeCookies', () => {
    test('should normalize sameSite values correctly', () => {
      const testCookies = [
        { name: 'test1', sameSite: 'no_restriction' },
        { name: 'test2', sameSite: 'lax' },
        { name: 'test3', sameSite: 'strict' },
        { name: 'test4', sameSite: null },
        { name: 'test5', sameSite: undefined }
      ];

      const normalized = normalizeCookies(testCookies);

      expect(normalized[0].sameSite).toBe('None');
      expect(normalized[1].sameSite).toBe('Lax');
      expect(normalized[2].sameSite).toBe('Strict');
      expect(normalized[3].sameSite).toBe('None');
      expect(normalized[4].sameSite).toBe('None');
    });

    test('should add required fields with defaults', () => {
      const testCookies = [
        { name: 'test1', value: 'value1' },
        { name: 'test2', value: 'value2', domain: 'example.com' }
      ];

      const normalized = normalizeCookies(testCookies);

      expect(normalized[0]).toEqual({
        name: 'test1',
        value: 'value1',
        domain: '',
        path: '/',
        secure: false,
        httpOnly: false,
        sameSite: 'None'
      });

      expect(normalized[1]).toEqual({
        name: 'test2',
        value: 'value2',
        domain: 'example.com',
        path: '/',
        secure: false,
        httpOnly: false,
        sameSite: 'None'
      });
    });

    test('should remove Playwright-incompatible fields', () => {
      const testCookies = [
        {
          name: 'test',
          value: 'value',
          hostOnly: true,
          storeId: 'store123',
          sameSite: 'lax'
        }
      ];

      const normalized = normalizeCookies(testCookies);

      expect(normalized[0].hostOnly).toBeUndefined();
      expect(normalized[0].storeId).toBeUndefined();
      expect(normalized[0].sameSite).toBe('Lax');
    });

    test('should preserve existing valid fields', () => {
      const testCookies = [
        {
          name: 'test',
          value: 'value',
          domain: 'example.com',
          path: '/api',
          secure: true,
          httpOnly: true,
          expires: 1234567890
        }
      ];

      const normalized = normalizeCookies(testCookies);

      expect(normalized[0]).toEqual({
        name: 'test',
        value: 'value',
        domain: 'example.com',
        path: '/api',
        secure: true,
        httpOnly: true,
        expires: 1234567890,
        sameSite: 'None'
      });
    });
  });

  describe('saveCookies', () => {
    test('should save cookies to file', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';

      await saveCookies(platform, userId, mockCookies);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('foodpanda_testuser.json'),
        JSON.stringify(mockCookies)
      );
    });

    test('should create session directory if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      await saveCookies('foodpanda', 'testuser', mockCookies);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('sessions'),
        expect.any(Object)
      );
    });
  });

  describe('loadCookies', () => {
    test('should load cookies from file when it exists', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('foodpanda_testuser.json')) return true;
        return false;
      });

      const result = await loadCookies(platform, userId);

      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('foodpanda_testuser.json')
      );
      expect(result).toEqual(normalizeCookies(mockCookies));
    });

    test('should return null when file does not exist', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';

      fs.existsSync.mockReturnValue(false);

      const result = await loadCookies(platform, userId);

      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('should handle JSON parsing errors', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      await expect(loadCookies(platform, userId)).rejects.toThrow();
    });
  });

  describe('loadCookiesFromExportedFile', () => {
    test('should load and normalize cookies from exported file', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';
      const exportedFilePath = '/path/to/exported.json';

      const result = await loadCookiesFromExportedFile(platform, userId, exportedFilePath);

      expect(fs.readFileSync).toHaveBeenCalledWith(exportedFilePath, 'utf8');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('foodpanda_testuser.json'),
        expect.any(String)
      );
      expect(result).toEqual(normalizeCookies(mockCookies));
    });

    test('should handle file reading errors', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';
      const exportedFilePath = '/path/to/exported.json';

      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await loadCookiesFromExportedFile(platform, userId, exportedFilePath);

      expect(result).toBeNull();
    });

    test('should handle JSON parsing errors', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';
      const exportedFilePath = '/path/to/exported.json';

      fs.readFileSync.mockReturnValue('invalid json');

      const result = await loadCookiesFromExportedFile(platform, userId, exportedFilePath);

      expect(result).toBeNull();
    });
  });

  describe('importCookiesFromBrowser', () => {
    test('should import cookies when exported file exists', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('foodpanda_exported.json')) return true;
        return false;
      });

      const result = await importCookiesFromBrowser(platform, userId);

      expect(result).toEqual(normalizeCookies(mockCookies));
    });

    test('should return null when exported file does not exist', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';

      fs.existsSync.mockReturnValue(false);

      const result = await importCookiesFromBrowser(platform, userId);

      expect(result).toBeNull();
    });

    test('should handle errors during import', async () => {
      const platform = 'foodpanda';
      const userId = 'testuser';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = await importCookiesFromBrowser(platform, userId);

      expect(result).toBeNull();
    });
  });

  describe('file path generation', () => {
    test('should generate correct session file paths', () => {
      // This test would require exposing the getSessionFilePath function
      // For now, we can test it indirectly through saveCookies
      const platform = 'foodpanda';
      const userId = 'testuser';

      saveCookies(platform, userId, mockCookies);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/.*foodpanda_testuser\.json$/),
        expect.any(String)
      );
    });
  });
}); 