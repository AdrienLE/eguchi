import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackStatus,
} from 'expo-av';
import { Asset } from 'expo-asset';
import manifest from '@/assets/audio/foundation-v1/manifest.json';
import { FOUNDATION_AUDIO_MODULES } from './audio-modules';
import type { ChordId } from './curriculum';
export const FOUNDATION_AUDIO = manifest.entries;
export const usePiano = () => {
  const sounds = useRef(new Map<ChordId, Audio.Sound>());
  const loading = useRef(new Map<ChordId, Promise<Audio.Sound>>());
  const currentId = useRef<ChordId | null>(null);
  const active = useRef(true);
  const current = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const getSound = useCallback((id: ChordId): Promise<Audio.Sound> => {
    if (sounds.current.has(id)) return Promise.resolve(sounds.current.get(id)!);
    const previous = loading.current.get(id);
    if (previous) return previous;
    const promise = (async () => {
      const asset = await Asset.fromModule(FOUNDATION_AUDIO_MODULES[id]).downloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: asset.localUri ?? asset.uri },
        { shouldPlay: false, volume: 1, rate: 1, progressUpdateIntervalMillis: 100 },
        (status: AVPlaybackStatus) => {
          if (!active.current || currentId.current !== id) return;
          if (status.isLoaded) setPlaying(status.isPlaying);
          else if (status.error) {
            setPlaying(false);
            setError('The sound could not play. Please retry.');
          }
        }
      );
      if (!active.current) {
        await sound.unloadAsync();
        throw new Error('Screen closed');
      }
      sounds.current.set(id, sound);
      return sound;
    })().finally(() => loading.current.delete(id));
    loading.current.set(id, promise);
    return promise;
  }, []);
  useEffect(() => {
    active.current = true;
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
    })
      .then(() => getSound('C-E-G'))
      .then(() => {
        if (active.current) setReady(true);
      })
      .catch(() => {
        if (active.current) setError('The piano could not load. Reopen this screen to retry.');
      });
    const loaded = sounds.current;
    return () => {
      active.current = false;
      for (const sound of loaded.values()) void sound.unloadAsync().catch(() => {});
      loaded.clear();
    };
  }, [getSound]);
  const stop = useCallback(async () => {
    if (current.current) await current.current.stopAsync();
  }, []);
  const play = useCallback(
    async (id: ChordId = 'C-E-G'): Promise<number> => {
      setError(null);
      try {
        await stop();
        const sound = await getSound(id);
        if (!active.current) throw new Error('Screen closed');
        current.current = sound;
        currentId.current = id;
        await sound.setPositionAsync(0);
        let status = await sound.playAsync();
        for (let i = 0; i < 12 && status.isLoaded && !status.isPlaying; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          status = await sound.getStatusAsync();
        }
        if (!active.current || !status.isLoaded || !status.isPlaying)
          throw new Error('Playback did not start');
        setPlaying(true);
        return Date.now();
      } catch {
        if (active.current)
          setError('The sound did not start. Nothing was counted. Check the speaker and retry.');
        throw new Error('Playback did not start');
      }
    },
    [getSound, stop]
  );
  return { play, stop, playing, ready, error };
};
