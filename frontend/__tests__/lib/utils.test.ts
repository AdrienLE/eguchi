/**
 * Tests for utility functions
 */

import {
  formatDate,
  formatTime,
  formatDateTime,
  debounce,
  generateId,
  isValidEmail,
  capitalize,
  truncate,
  getInitials,
  isWeb,
  isMobile,
  sleep,
} from '../../lib/utils';

describe('Date formatting utilities', () => {
  const testDate = new Date('2024-03-15T14:30:00Z');

  test('formatDate should format date correctly', () => {
    const result = formatDate(testDate);
    expect(result).toMatch(/Mar \d{1,2}, 2024/);
  });

  test('formatTime should format time correctly', () => {
    const result = formatTime(testDate);
    expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
  });

  test('formatDateTime should combine date and time', () => {
    const result = formatDateTime(testDate);
    expect(result).toContain('Mar');
    expect(result).toContain('2024');
    expect(result).toContain('at');
  });
});

describe('debounce', () => {
  jest.useFakeTimers();

  test('should delay function execution', () => {
    const mockFn = jest.fn() as jest.MockedFunction<(arg: string) => void>;
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn('test');
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  test('should cancel previous calls', () => {
    const mockFn = jest.fn() as jest.MockedFunction<(arg: string) => void>;
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn('first');
    debouncedFn('second');

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('second');
  });
});

describe('generateId', () => {
  test('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  test('should generate IDs of consistent length', () => {
    const id = generateId();
    expect(id.length).toBe(9);
  });
});

describe('isValidEmail', () => {
  test('should validate correct email formats', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.org')).toBe(true);
  });

  test('should reject invalid email formats', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user space@domain.com')).toBe(false);
  });
});

describe('capitalize', () => {
  test('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('WORLD')).toBe('WORLD');
    expect(capitalize('tEST')).toBe('TEST');
  });

  test('should handle empty string', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('truncate', () => {
  test('should truncate long strings', () => {
    expect(truncate('This is a long string', 10)).toBe('This is a ...');
  });

  test('should not truncate short strings', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });

  test('should handle exact length', () => {
    expect(truncate('Exactly10!', 10)).toBe('Exactly10!');
  });
});

describe('Platform utilities', () => {
  test('isWeb should return true when Platform.OS is web', () => {
    // Mock is already set to 'web' in jest.setup.js
    expect(isWeb()).toBe(true);
  });

  test('isMobile should return false when Platform.OS is web', () => {
    // Mock is already set to 'web' in jest.setup.js
    expect(isMobile()).toBe(false);
  });
});

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should resolve after specified time', async () => {
    const promise = sleep(1000);

    // Fast-forward time
    jest.advanceTimersByTime(1000);

    await expect(promise).resolves.toBeUndefined();
  });
});

describe('getInitials', () => {
  test('should get initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Mary Jane Smith')).toBe('MJ');
  });

  test('should handle single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  test('should handle multiple names', () => {
    expect(getInitials('John Michael Doe Smith')).toBe('JM');
  });

  test('should handle empty string', () => {
    expect(getInitials('')).toBe('');
  });
});
