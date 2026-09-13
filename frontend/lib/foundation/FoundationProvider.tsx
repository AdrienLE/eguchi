import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { getEguchiAccountKey } from '@/lib/eguchi/account-storage';
import { deriveProgram, type FoundationEvent, type ProgramState } from './program';
import { getFoundationStore, type FoundationSnapshot, type FoundationStore } from './store';
import { reconcileNotifications, type NotificationMode } from './notifications';
import { useDebugMode } from './DebugMode';
interface Context {
  debug: boolean;
  resetDebug: () => Promise<void>;
  store: FoundationStore;
  snapshot: FoundationSnapshot;
  state: ProgramState;
  ready: boolean;
  error: string | null;
  syncStatus: string;
  notificationMode: NotificationMode;
  append: (event: FoundationEvent) => Promise<void>;
  sync: () => Promise<void>;
  now: Date;
}
const FoundationContext = createContext<Context | null>(null);
export const FoundationProvider = ({ children }: { children: React.ReactNode }) => {
  const debug = useDebugMode();
  const { practiceStorage, token, loading } = useAuth();
  const store = useMemo(() => getFoundationStore(practiceStorage), [practiceStorage]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [loadedStore, setLoadedStore] = useState<FoundationStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState('Saved on this device');
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('off');
  const [now, setNow] = useState(new Date());
  const [foreground, setForeground] = useState(0);
  const state = useMemo(() => deriveProgram(snapshot.events), [snapshot.events]);
  const ready = !loading && loadedStore === store;
  useEffect(() => {
    let active = true;
    setError(null);
    store
      .load()
      .then(() => {
        if (active) setLoadedStore(store);
      })
      .catch(() => {
        if (active)
          setError(
            'Your practice record could not be opened. Reopen the app; your stored record has not been replaced.'
          );
      });
    return () => {
      active = false;
    };
  }, [store]);
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 15_000);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        setNow(new Date());
        setForeground(value => value + 1);
      }
    });
    return () => {
      clearInterval(clock);
      subscription.remove();
    };
  }, []);
  const sync = useCallback(async () => {
    if (debug || !token) {
      setSyncStatus(debug ? 'Debug sandbox · saved locally' : 'Saved on this device');
      return;
    }
    setSyncStatus('Syncing…');
    try {
      await store.sync(token, api);
      setSyncStatus('Synced with your account');
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Saved locally; sync will retry.');
    }
  }, [store, token, debug]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void sync();
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, snapshot.pendingIds.length, foreground, sync]);
  useEffect(() => {
    if (!ready || debug) return;
    let active = true;
    const timer = setTimeout(() => {
      void reconcileNotifications(state, token, getEguchiAccountKey(token))
        .then(mode => {
          if (active) setNotificationMode(mode);
        })
        .catch(() => {
          if (active) setNotificationMode('off');
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ready, state, token, foreground, debug]);
  const resetDebug = useCallback(async () => {
    if (!debug || !ready) throw new Error('Only the debug sandbox can be reset here.');
    await store.reset();
    setNow(new Date());
  }, [debug, ready, store]);
  const append = useCallback(
    async (event: FoundationEvent) => {
      if (!ready) throw new Error('Please wait for your practice record to open.');
      await store.append(event);
      setNow(new Date());
    },
    [ready, store]
  );
  return (
    <FoundationContext.Provider
      value={{
        debug,
        resetDebug,
        store,
        snapshot,
        state,
        ready,
        error,
        syncStatus,
        notificationMode,
        append,
        sync,
        now,
      }}
    >
      {children}
    </FoundationContext.Provider>
  );
};
export const useFoundation = () => {
  const context = useContext(FoundationContext);
  if (!context) throw new Error('FoundationProvider is required');
  return context;
};
