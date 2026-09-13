import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useGlobalSearchParams, useRootNavigationState, useRouter } from 'expo-router';
import { isDebugEnabled } from './debug';

const DebugContext = createContext(false);
export const useDebugMode = () => useContext(DebugContext);

export function DebugModeProvider({ children }: { children: React.ReactNode }) {
  const { debug } = useGlobalSearchParams<{ debug?: string }>();
  const [enabled, setEnabled] = useState(() => isDebugEnabled(debug, Platform.OS));
  const navigation = useRootNavigationState();
  const router = useRouter();
  useEffect(() => {
    // Missing query parameters on internal links retain the current sandbox.
    if (debug !== undefined) setEnabled(isDebugEnabled(debug, Platform.OS));
  }, [debug]);
  useEffect(() => {
    // Keep the opt-in visible, including after navigation and browser refresh.
    if (enabled && debug === undefined && navigation?.key) router.setParams({ debug: 'True' });
  }, [enabled, debug, navigation?.key, router]);
  return <DebugContext.Provider value={enabled}>{children}</DebugContext.Provider>;
}
