import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, View, useWindowDimensions } from 'react-native';
import { usePalette } from './ui';
/** A parent-facing visual summary, never a pitch hint during a trial. */
export default function PracticeDiagram() {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const compact = width < 560;
  const steps = [
    {
      icon: 'volume-high-outline' as const,
      label: 'Play the chord',
      color: '#215E50',
      fill: '#E8F2EE',
    },
    {
      icon: 'hand-left-outline' as const,
      label: 'Child chooses a friend',
      color: '#BE2929',
      fill: '#FFF0EE',
    },
    { icon: 'heart-outline' as const, label: 'Help if needed', color: '#7A5792', fill: '#F2EDF7' },
  ];
  return (
    <View
      accessibilityLabel="Play the chord, let your child choose its color or animal, and help gently if needed."
      style={{
        flexDirection: compact ? 'column' : 'row',
        alignItems: compact ? 'stretch' : 'center',
        gap: compact ? 8 : 12,
      }}
    >
      {steps.map((step, index) => (
        <React.Fragment key={step.label}>
          {index > 0 && !compact && (
            <Ionicons name="arrow-forward" size={20} color={p.subtleText} />
          )}
          <View
            style={{
              flex: compact ? undefined : 1,
              alignItems: 'center',
              flexDirection: compact ? 'row' : 'column',
              gap: 10,
              padding: compact ? 8 : 12,
            }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: step.fill,
              }}
            >
              <Ionicons name={step.icon} size={26} color={step.color} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', textAlign: 'center', color: p.text }}>
              {step.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}
