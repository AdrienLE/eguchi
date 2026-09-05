import jwtDecode from 'jwt-decode';

export const TOKEN_KEY = 'eguchi_auth_token';

export type StoredAuthTokenDecision = {
  token: string | null;
  shouldClearStoredToken: boolean;
};

export const resolveStoredAuthToken = (
  storedToken: string | null,
  nowMs: number = Date.now()
): StoredAuthTokenDecision => {
  if (!storedToken) {
    return { token: null, shouldClearStoredToken: false };
  }

  try {
    const payload: { exp?: number } = jwtDecode(storedToken);
    if (!payload.exp || payload.exp * 1000 > nowMs) {
      return { token: storedToken, shouldClearStoredToken: false };
    }
  } catch {
    return { token: null, shouldClearStoredToken: true };
  }

  return { token: null, shouldClearStoredToken: true };
};

// Resolve the browser origin lazily: native runtimes need not provide window.location.
export const getLogoutReturnTo = (
  platform: string,
  nativeRedirectUri: string,
  getWebOrigin: () => string
) => encodeURIComponent(platform === 'web' ? `${getWebOrigin()}/` : nativeRedirectUri);
