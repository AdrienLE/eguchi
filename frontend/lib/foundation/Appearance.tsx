import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { STORAGE_KEYS, type StorageService } from '@/lib/storage';
import {
  getPlayroomBackground,
  normalizePlayroomBackgroundId,
  type PlayroomBackgroundId,
} from '@/lib/eguchi/playroom-backgrounds';

export async function loadBackground(storage: StorageService): Promise<PlayroomBackgroundId> {
  const saved = await storage.get<{ backgroundId?: unknown }>(STORAGE_KEYS.EGUCHI_APPEARANCE);
  if (saved) return normalizePlayroomBackgroundId(saved.backgroundId);
  const legacy = await storage.get<{ playroomBackgroundId?: unknown }>(
    STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES
  );
  return normalizePlayroomBackgroundId(legacy?.playroomBackgroundId);
}

const AppearanceContext = createContext({
  background: getPlayroomBackground('pink'),
  ready: false,
  saving: false,
  error: null as string | null,
  chooseBackground: async (_id: PlayroomBackgroundId) => {},
});

/** Decoration is local to this account/device, independent of the teaching plan. */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { practiceStorage } = useAuth();
  const [selection, setSelection] = useState<{
    storage: StorageService;
    id: PlayroomBackgroundId;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeStorage = useRef(practiceStorage);
  activeStorage.current = practiceStorage;
  const savingRef = useRef(false);
  const ready = selection?.storage === practiceStorage;
  useEffect(() => {
    let active = true;
    setError(null);
    void loadBackground(practiceStorage)
      .then(id => {
        if (active) setSelection({ storage: practiceStorage, id });
      })
      .catch(() => {
        if (active) {
          setSelection({ storage: practiceStorage, id: 'pink' });
          setError('Your background could not be opened. You can choose it again.');
        }
      });
    return () => {
      active = false;
    };
  }, [practiceStorage]);
  const chooseBackground = async (id: PlayroomBackgroundId) => {
    if (!ready || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await practiceStorage.set(STORAGE_KEYS.EGUCHI_APPEARANCE, { backgroundId: id });
      if (activeStorage.current === practiceStorage) setSelection({ storage: practiceStorage, id });
    } catch {
      if (activeStorage.current === practiceStorage)
        setError('The background could not be saved. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <AppearanceContext.Provider
      value={{
        background: getPlayroomBackground(ready ? selection!.id : 'pink'),
        ready,
        saving,
        error,
        chooseBackground,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}
export const useAppearance = () => useContext(AppearanceContext);
