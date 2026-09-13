import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PLAYROOM_BACKGROUNDS } from '@/lib/eguchi/playroom-backgrounds';
import { useAppearance } from '@/lib/foundation/Appearance';

export default function BackgroundPicker({
  expanded = false,
  leading,
}: {
  expanded?: boolean;
  leading?: React.ReactNode;
}) {
  const appearance = useAppearance();
  const [open, setOpen] = useState(expanded);
  return (
    <View style={{ gap: 12 }}>
      {!expanded && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          {leading ?? <View />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose background"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen(value => !value)}
            style={{
              alignSelf: 'flex-end',
              padding: 12,
              borderRadius: 24,
              backgroundColor: appearance.background.surfaceColor,
            }}
          >
            <Ionicons
              name="color-palette-outline"
              size={26}
              color={appearance.background.textColor}
            />
          </Pressable>
        </View>
      )}
      {open && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {PLAYROOM_BACKGROUNDS.map(background => {
            const selected = appearance.background.id === background.id;
            return (
              <Pressable
                key={background.id}
                accessibilityRole="button"
                accessibilityLabel={`${background.label} background`}
                accessibilityState={{ selected, disabled: !appearance.ready || appearance.saving }}
                disabled={!appearance.ready || appearance.saving}
                onPress={() => void appearance.chooseBackground(background.id)}
                style={{ alignItems: 'center', gap: 5, padding: 4 }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: background.color,
                    borderWidth: selected ? 3 : 1,
                    borderColor: selected ? background.textColor : background.accentColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected && <Ionicons name="checkmark" size={24} color={background.textColor} />}
                </View>
                <Text style={{ fontSize: 12, color: appearance.background.textColor }}>
                  {background.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {appearance.error && (
        <Text style={{ color: appearance.background.textColor }}>{appearance.error}</Text>
      )}
    </View>
  );
}
