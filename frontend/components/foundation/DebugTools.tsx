import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import { debugStageEvent } from '@/lib/foundation/debug';
import { CHORD_CURRICULUM } from '@/lib/foundation/curriculum';
import { Body, Button, Notice, styles, usePalette } from './ui';

export default function DebugTools() {
  const f = useFoundation();
  const pathname = usePathname();
  const router = useRouter();
  const p = usePalette();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  if (!f.debug) return null;
  const stage = f.state.preferences.stage;
  const inPractice = pathname === '/practice';
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the sandbox.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const changeStage = (next: number) =>
    run(async () => {
      await f.append(debugStageEvent(next));
      // Finish the old screen rather than changing its frozen trial plan mid-session.
      router.replace('/?debug=True');
    });
  return (
    <View style={{ backgroundColor: '#EDE3FF', borderBottomWidth: 1, borderColor: p.borderMuted }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Debug tools"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        style={{
          minHeight: 48,
          padding: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: p.text, fontWeight: '700' }}>🛠 Debug mode · Level {stage}/14</Text>
        <Text style={{ color: p.tint }}>{expanded ? 'Hide' : 'Tools'}</Text>
      </Pressable>
      {expanded && (
        <ScrollView style={{ maxHeight: 285 }} contentContainerStyle={{ padding: 14, gap: 12 }}>
          <Body>Test record only · no waits, account sync, or reminders.</Body>
          <View style={styles.row}>
            <Button
              title="Previous level"
              secondary
              disabled={!f.ready || busy || stage <= 1}
              onPress={() => void changeStage(stage - 1)}
            />
            <Button
              title={
                stage < 14 ? `Next level · ${CHORD_CURRICULUM[stage].color}` : 'All levels unlocked'
              }
              disabled={!f.ready || busy || stage >= 14}
              onPress={() => void changeStage(stage + 1)}
            />
            <Button
              title="Unlock all animals"
              secondary
              disabled={!f.ready || busy || stage === 14}
              onPress={() => void changeStage(14)}
            />
          </View>
          <View style={styles.row}>
            <Button
              title="Practice now"
              disabled={!f.ready || busy || inPractice}
              onPress={() => {
                setExpanded(false);
                router.replace('/practice?debug=True');
              }}
            />
            <Button
              title="Parent preparation"
              secondary
              disabled={busy}
              onPress={() => {
                setExpanded(false);
                router.replace('/prepare?debug=True');
              }}
            />
            <Button
              title="Reset debug progress"
              secondary
              disabled={!f.ready || busy || inPractice}
              onPress={() =>
                void run(async () => {
                  await f.resetDebug();
                  router.replace('/?debug=True');
                })
              }
            />
            <Button
              title="Exit debug mode"
              secondary
              disabled={busy}
              onPress={() => window.location.assign('/')}
            />
          </View>
          {inPractice && (
            <Body muted>
              Level changes return to today’s plan. Finish practice before resetting.
            </Body>
          )}
          {error && <Notice>{error}</Notice>}
        </ScrollView>
      )}
    </View>
  );
}
