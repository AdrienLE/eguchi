import jwtDecode from 'jwt-decode';

import { TOKEN_KEY, resolveStoredAuthToken, getLogoutReturnTo } from '@/auth/auth-state';

jest.mock('jwt-decode', () => jest.fn());

const mockedJwtDecode = jwtDecode as unknown as {
  mockReset: () => void;
  mockReturnValue: (value: unknown) => void;
  mockImplementation: (implementation: () => unknown) => void;
};

describe('auth-state', () => {
  beforeEach(() => {
    mockedJwtDecode.mockReset();
  });

  test('uses an Eguchi-specific token storage key', () => {
    expect(TOKEN_KEY).toBe('eguchi_auth_token');
  });

  test('keeps a valid stored token', () => {
    mockedJwtDecode.mockReturnValue({ exp: 2_000, iss: 'https://auth.test/', sub: 'account-a' });

    expect(resolveStoredAuthToken('token', 1_000_000)).toEqual({
      token: 'token',
      shouldClearStoredToken: false,
    });
  });

  test('clears an expired stored token', () => {
    mockedJwtDecode.mockReturnValue({ exp: 1_000, iss: 'https://auth.test/', sub: 'account-a' });

    expect(resolveStoredAuthToken('token', 2_000_000)).toEqual({
      token: null,
      shouldClearStoredToken: true,
    });
  });

  test('clears an invalid stored token', () => {
    mockedJwtDecode.mockImplementation(() => {
      throw new Error('invalid token');
    });

    expect(resolveStoredAuthToken('token')).toEqual({
      token: null,
      shouldClearStoredToken: true,
    });
  });
});

describe('logout redirects', () => {
  test('iPad and Android logout do not access browser globals', () => {
    for (const platform of ['ios', 'android']) {
      const redirect = getLogoutReturnTo(platform, 'eguchieartrainer://redirect', () => {
        throw new Error('window.location is unavailable');
      });
      expect(decodeURIComponent(redirect)).toBe('eguchieartrainer://redirect');
    }
  });

  test('web logout returns to the current app origin', () => {
    expect(
      decodeURIComponent(getLogoutReturnTo('web', 'native://redirect', () => 'https://eguchi.test'))
    ).toBe('https://eguchi.test/');
  });
});

test('does not enable account sync for a token without issuer and subject', () => {
  mockedJwtDecode.mockReturnValue({ exp: 2_000 });
  expect(resolveStoredAuthToken('token', 1_000_000)).toEqual({
    token: null,
    shouldClearStoredToken: true,
  });
});
