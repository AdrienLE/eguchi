import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import jwtDecode from 'jwt-decode';
import { TOKEN_KEY, resolveStoredAuthToken } from './auth-state';

// Close the Auth0 popup on web if a redirect back to the app occurred
WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  token: string | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  validateToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  validateToken: async () => false,
});

const discovery = {
  authorizationEndpoint: `https://${process.env.EXPO_PUBLIC_AUTH0_DOMAIN}/authorize`,
  tokenEndpoint: `https://${process.env.EXPO_PUBLIC_AUTH0_DOMAIN}/oauth/token`,
  revocationEndpoint: `https://${process.env.EXPO_PUBLIC_AUTH0_DOMAIN}/oauth/revoke`,
};

const SILENT_AUTH_ATTEMPT_KEY = 'eguchi_auth_silent_attempted';
const URL_SCHEME = process.env.EXPO_PUBLIC_URL_SCHEME || 'eguchieartrainer';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Allow override via env; default to using native redirect flow when unset
  const authUseProxyEnv = process.env.EXPO_PUBLIC_AUTH_USE_PROXY;
  const forcedUseProxy =
    authUseProxyEnv === 'true' ? true : authUseProxyEnv === 'false' ? false : undefined;
  const useProxy = Platform.select({ web: false, default: forcedUseProxy ?? false });
  const redirectUriWeb = makeRedirectUri({ useProxy: false });
  const redirectUriProxy = makeRedirectUri({
    scheme: URL_SCHEME,
    useProxy: true,
    path: 'redirect',
  });
  const redirectUriNative = makeRedirectUri({
    scheme: URL_SCHEME,
    useProxy: false,
    path: 'redirect',
  });
  const redirectUri = Platform.select({
    web: redirectUriWeb,
    default: useProxy ? redirectUriProxy : redirectUriNative,
  });

  useEffect(() => {
    console.log(`Auth env EXPO_PUBLIC_AUTH_USE_PROXY: ${authUseProxyEnv ?? '(unset)'}`);
    console.log(`Auth redirect URI (computed): ${redirectUri}`);
    console.log(`Auth redirect URI (native): ${redirectUriNative}`);
    console.log(`Auth redirect URI (proxy): ${redirectUriProxy}`);
    console.log(`Auth useProxy: ${useProxy}`);
  }, [redirectUri, useProxy]);

  // Load any stored token on start and handle Auth0 redirect
  useEffect(() => {
    const loadToken = async () => {
      try {
        // On web, check for Auth0 redirect token in URL hash
        if (Platform.OS === 'web' && window.location.hash.includes('access_token=')) {
          const params = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = params.get('access_token');

          if (accessToken) {
            console.log('Found access token in URL hash');
            setTokenState(accessToken);
            await AsyncStorage.setItem(TOKEN_KEY, accessToken);

            // Clear silent auth attempt flag after a successful token reception
            try {
              sessionStorage.removeItem(SILENT_AUTH_ATTEMPT_KEY);
            } catch {}

            // Clean up the URL hash
            window.history.replaceState({}, document.title, window.location.pathname);
            setLoading(false);
            return;
          }
        }

        // Otherwise, load this app's stored token. The key is app-specific so a token from
        // another base-app-derived localhost build cannot sign into Eguchi.
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        const storedTokenDecision = resolveStoredAuthToken(stored);
        if (storedTokenDecision.token) {
          setTokenState(storedTokenDecision.token);
        } else if (storedTokenDecision.shouldClearStoredToken) {
          console.log('Stored Eguchi token expired or was invalid, clearing authentication');
          await AsyncStorage.removeItem(TOKEN_KEY);
          setTokenState(null);

          // Attempt silent re-auth only after this app had an Eguchi token. A fresh local-first
          // session stays signed out until the caregiver chooses account sync.
          if (Platform.OS === 'web') {
            try {
              const attempted = sessionStorage.getItem(SILENT_AUTH_ATTEMPT_KEY);
              if (!attempted) {
                sessionStorage.setItem(SILENT_AUTH_ATTEMPT_KEY, '1');
                const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
                const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
                const audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;
                const silentUrl =
                  `https://${auth0Domain}/authorize?` +
                  new URLSearchParams({
                    response_type: 'token',
                    client_id: clientId ?? '',
                    redirect_uri: redirectUri,
                    scope: 'openid profile email',
                    audience: audience ?? '',
                    prompt: 'none',
                  }).toString();
                console.log('Attempting silent auth via redirect');
                window.location.replace(silentUrl);
                return;
              }
            } catch (e) {
              console.log('Silent auth attempt skipped due to sessionStorage error:', e);
            }
          } else {
            try {
              await tryNativeSilentLogin();
            } catch (e) {
              console.log('Native silent login failed or not available:', e);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load token', e);
      } finally {
        setLoading(false);
      }
    };
    loadToken();
  }, []);

  // Create a separate silent auth request (prompt=none) for native silent refresh
  const [silentRequest, silentResponse, promptSilentAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '',
      scopes: ['openid', 'profile', 'email'],
      responseType: ResponseType.Token,
      redirectUri: redirectUriNative,
      extraParams: {
        audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? '',
        prompt: 'none',
      },
    },
    discovery
  );

  // When silent auth succeeds, persist the new token
  useEffect(() => {
    if (silentResponse?.type === 'success') {
      const newToken = silentResponse.params.access_token;
      if (newToken) {
        setTokenState(newToken);
        AsyncStorage.setItem(TOKEN_KEY, newToken).catch(() => {});
      }
    }
  }, [silentResponse]);

  // Best-effort silent login for native platforms using existing browser session
  const nativeSilentAttemptedRef = useRef(false);
  const tryNativeSilentLogin = async () => {
    if (Platform.OS === 'web') return; // Only relevant for native
    if (nativeSilentAttemptedRef.current) return;
    nativeSilentAttemptedRef.current = true;
    try {
      // Use system browser (no proxy) so existing Auth0 cookies can be used for SSO
      await promptSilentAsync({ useProxy: false, preferEphemeralSession: false });
    } catch (e) {
      // Ignore errors; user may need to login interactively
      throw e;
    }
  };

  // Listen for auth expired events from API calls
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleAuthExpired = () => {
        console.log('Auth expired event received - clearing authentication');
        setTokenState(null);
        AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});

        // Attempt silent re-auth once to refresh the session seamlessly on web
        try {
          const attempted = sessionStorage.getItem(SILENT_AUTH_ATTEMPT_KEY);
          if (!attempted) {
            sessionStorage.setItem(SILENT_AUTH_ATTEMPT_KEY, '1');
            const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
            const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
            const audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;
            const silentUrl =
              `https://${auth0Domain}/authorize?` +
              new URLSearchParams({
                response_type: 'token',
                client_id: clientId ?? '',
                redirect_uri: redirectUri,
                scope: 'openid profile email',
                audience: audience ?? '',
                prompt: 'none',
              }).toString();
            console.log('Attempting silent auth due to 401 via redirect');
            window.location.replace(silentUrl);
          }
        } catch (e) {
          console.log('Silent auth attempt on 401 skipped due to sessionStorage error:', e);
        }
      };

      window.addEventListener('auth-expired', handleAuthExpired);
      return () => {
        window.removeEventListener('auth-expired', handleAuthExpired);
      };
    }
  }, []);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '',
      scopes: ['openid', 'profile', 'email'],
      responseType: ResponseType.Token,
      redirectUri,
      extraParams: {
        audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? '',
      },
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const newToken = response.params.access_token;
      setTokenState(newToken);
      AsyncStorage.setItem(TOKEN_KEY, newToken).catch(() => {});
      // Clear any previous silent attempt flags
      try {
        if (Platform.OS === 'web') {
          sessionStorage.removeItem(SILENT_AUTH_ATTEMPT_KEY);
        }
      } catch {}
    }
  }, [response]);

  const login = () => {
    console.log(`Starting login with redirectUri=${redirectUri}, useProxy=${useProxy}`);

    // On web, redirect directly to Auth0 (no popup)
    if (Platform.OS === 'web') {
      const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
      const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
      const audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;

      const loginUrl =
        `https://${auth0Domain}/authorize?` +
        new URLSearchParams({
          response_type: 'token',
          client_id: clientId ?? '',
          redirect_uri: redirectUri,
          scope: 'openid profile email',
          audience: audience ?? '',
        }).toString();

      window.location.href = loginUrl;
      return;
    }

    // On mobile, use the existing popup approach
    promptAsync({ useProxy });
  };

  // Simple token validation - just checks if expired
  const validateToken = async (): Promise<boolean> => {
    if (!token) return false;

    try {
      const payload: { exp?: number } = jwtDecode(token);
      const now = Date.now() / 1000;
      return payload.exp ? payload.exp > now : true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    // Clear local token first
    setTokenState(null);
    AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
    try {
      if (Platform.OS === 'web') {
        sessionStorage.removeItem(SILENT_AUTH_ATTEMPT_KEY);
      }
    } catch {}

    // Construct Auth0 logout URL to clear Auth0 session
    const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
    // Redirect to home page after logout
    const returnTo = Platform.select({
      web: encodeURIComponent(`${window.location.origin}/`),
      default: encodeURIComponent(redirectUriNative),
    });
    const logoutUrl = `https://${auth0Domain}/v2/logout?client_id=${process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID}&returnTo=${returnTo}`;

    // On web, redirect directly to Auth0 logout (no popup)
    if (Platform.OS === 'web') {
      window.location.href = logoutUrl;
      return;
    }

    // On mobile, use WebBrowser for logout
    try {
      await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUriNative);
    } catch (error) {
      console.warn('Logout session failed, but local token cleared:', error);
    }

    // Navigate to home page (mobile only, web will redirect via Auth0)
    router.replace('/');
  };

  // On native, retry silent login when returning to foreground without a token
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && !token) {
        tryNativeSilentLogin().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, loading, login, logout, validateToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
