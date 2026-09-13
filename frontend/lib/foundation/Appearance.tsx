import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { STORAGE_KEYS, type StorageService } from '@/lib/storage';
import {
  getPlayroomBackground,
  type PlayroomBackgroundId,
} from '@/lib/eguchi/playroom-backgrounds';
import { normalizePlayroomOptions, type PlayroomOptions } from './playroom-options';

export async function loadBackground(storage: StorageService): Promise<PlayroomBackgroundId> {
  return (await loadPlayroomOptions(storage)).backgroundId;
}
export async function loadPlayroomOptions(storage: StorageService): Promise<PlayroomOptions> {
  const saved = await storage.get<unknown>(STORAGE_KEYS.EGUCHI_APPEARANCE);
  if (saved) return normalizePlayroomOptions(saved);
  const legacy = await storage.get<{ playroomBackgroundId?: unknown }>(
    STORAGE_KEYS.EGUCHI_SESSION_PREFERENCES
  );
  return normalizePlayroomOptions({ backgroundId: legacy?.playroomBackgroundId });
}

const AppearanceContext = createContext({
  background: getPlayroomBackground('pink'),
  options: normalizePlayroomOptions(null),
  ready: false,
  saving: false,
  error: null as string | null,
  chooseBackground: async (_id: PlayroomBackgroundId) => {},
  updateOptions: async (_patch: Partial<PlayroomOptions>) => {},
});

/** Playroom controls are local to this account/device, independent of the teaching plan. */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { practiceStorage } = useAuth();
  const [selection, setSelection] = useState<{
    storage: StorageService;
    options: PlayroomOptions;
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
    void loadPlayroomOptions(practiceStorage)
      .then(options => {
        if (active) setSelection({ storage: practiceStorage, options });
      })
      .catch(() => {
        if (active) {
          setSelection({ storage: practiceStorage, options: normalizePlayroomOptions(null) });
          setError('Your playroom settings could not be opened. You can choose them again.');
        }
      });
    return () => {
      active = false;
    };
  }, [practiceStorage]);
  const updateOptions = async (patch: Partial<PlayroomOptions>) => {
    if (!ready || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const options = normalizePlayroomOptions({ ...selection!.options, ...patch });
    try {
      await practiceStorage.set(STORAGE_KEYS.EGUCHI_APPEARANCE, options);
      if (activeStorage.current === practiceStorage)
        setSelection({ storage: practiceStorage, options });
    } catch {
      if (activeStorage.current === practiceStorage)
        setError('The playroom settings could not be saved. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <AppearanceContext.Provider
      value={{
        background: getPlayroomBackground(ready ? selection!.options.backgroundId : 'pink'),
        options: ready ? selection!.options : normalizePlayroomOptions(null),
        ready,
        saving,
        error,
        chooseBackground: id => updateOptions({ backgroundId: id }),
        updateOptions,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}
export const useAppearance = () => useContext(AppearanceContext);
