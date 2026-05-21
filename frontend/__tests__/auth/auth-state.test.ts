import jwtDecode from 'jwt-decode';

import { TOKEN_KEY, resolveStoredAuthToken } from '@/auth/auth-state';

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
    mockedJwtDecode.mockReturnValue({ exp: 2_000 });

    expect(resolveStoredAuthToken('token', 1_000_000)).toEqual({
      token: 'token',
      shouldClearStoredToken: false,
    });
  });

  test('clears an expired stored token', () => {
    mockedJwtDecode.mockReturnValue({ exp: 1_000 });

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
