import React from 'react';
import { Platform, Pressable, Text, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NO_RESPONSE_HOLD_MS } from '@/lib/foundation/playroom-options';
import { usePalette } from './ui';

export default function NoResponseButton({
  requireHold,
  disabled,
  onRespond,
}: {
  requireHold: boolean;
  disabled: boolean;
  onRespond: () => void;
}) {
  const p = usePalette();
  const activate = () => {
    if (!disabled) onRespond();
  };
  const press = (event: GestureResponderEvent) => {
    // React Native Web forwards zero-detail clicks from assistive technology,
    // or keyup events from Enter/Space. Pointer taps still require the hold.
    const native = (event?.nativeEvent ?? event) as { detail?: number; key?: string } | undefined;
    if (
      !requireHold ||
      (Platform.OS === 'web' &&
        (native?.detail === 0 || native?.key === 'Enter' || native?.key === ' '))
    )
      activate();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="No response"
      accessibilityHint={
        requireHold
          ? 'Touch and hold for one second to record no response.'
          : 'Record that your child did not respond.'
      }
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate', label: 'Record no response' }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'activate') activate();
      }}
      onAccessibilityTap={activate}
      disabled={disabled}
      onPress={press}
      onLongPress={requireHold ? activate : undefined}
      delayLongPress={NO_RESPONSE_HOLD_MS}
      style={{
        minWidth: 76,
        maxWidth: 106,
        minHeight: 48,
        padding: 8,
        gap: 4,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={18} color={p.subtleText} />
      <Text style={{ fontSize: 12, lineHeight: 15, color: p.subtleText, textAlign: 'center' }}>
        {requireHold ? 'Hold for\nno response' : 'No response'}
      </Text>
    </Pressable>
  );
}
