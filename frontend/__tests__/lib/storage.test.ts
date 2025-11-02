/**
 * Tests for storage service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, STORAGE_KEYS } from '../../lib/storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as any;

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get method', () => {
    test('should return parsed data when item exists', async () => {
      const testData = { name: 'John', age: 30 };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(testData));

      const result = await storage.get('test-key');
      expect(result).toEqual(testData);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('test-key');
    });

    test('should return null when item does not exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await storage.get('non-existent-key');
      expect(result).toBe(null);
    });

    test('should handle errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const result = await storage.get('error-key');
      expect(result).toBe(null);
    });
  });

  describe('set method', () => {
    test('should store stringified data', async () => {
      const testData = { name: 'Jane', age: 25 };
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storage.set('test-key', testData);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
    });

    test('should handle errors by throwing', async () => {
      const error = new Error('Storage error');
      mockAsyncStorage.setItem.mockRejectedValueOnce(error);

      try {
        await storage.set('error-key', 'data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBe(error);
      }
    });
  });

  describe('remove method', () => {
    test('should remove item successfully', async () => {
      mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      await storage.remove('test-key');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('clear method', () => {
    test('should clear all data successfully', async () => {
      mockAsyncStorage.clear.mockResolvedValueOnce(undefined);

      await storage.clear();
      expect(AsyncStorage.clear).toHaveBeenCalled();
    });
  });

  describe('getAllKeys method', () => {
    test('should return all keys successfully', async () => {
      const keys = ['key1', 'key2', 'key3'];
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce(keys);

      const result = await storage.getAllKeys();
      expect(result).toEqual(keys);
      expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
    });

    test('should return empty array on failure', async () => {
      mockAsyncStorage.getAllKeys.mockRejectedValueOnce(new Error('Keys error'));

      const result = await storage.getAllKeys();
      expect(result).toEqual([]);
    });
  });
});

describe('STORAGE_KEYS', () => {
  test('should export correct storage keys', () => {
    expect(STORAGE_KEYS.AUTH_TOKEN).toBe('auth_token');
    expect(STORAGE_KEYS.USER_PREFERENCES).toBe('user_preferences');
    expect(STORAGE_KEYS.THEME).toBe('theme');
    expect(STORAGE_KEYS.LAST_SYNC).toBe('last_sync');
  });
});
