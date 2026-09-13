import React from 'react';
import { Switch, View } from 'react-native';
import { useAppearance } from '@/lib/foundation/Appearance';
import { Body, Card, Heading, Notice, PictureButton } from './ui';

export default function PracticeControls() {
  const { options, ready, saving, error, updateOptions } = useAppearance();
  const disabled = !ready || saving;
  return (
    <Card>
      <Heading>Practice controls</Heading>
      <Body>Time on the feedback bar</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <PictureButton
          small
          icon="remove"
          label="Shorter feedback"
          disabled={disabled || options.feedbackMs <= 1000}
          onPress={() => void updateOptions({ feedbackMs: options.feedbackMs - 1000 })}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Heading>
            {options.feedbackMs / 1000} {options.feedbackMs === 1000 ? 'second' : 'seconds'}
          </Heading>
        </View>
        <PictureButton
          small
          icon="add"
          label="Longer feedback"
          disabled={disabled || options.feedbackMs >= 10000}
          onPress={() => void updateOptions({ feedbackMs: options.feedbackMs + 1000 })}
        />
      </View>
      <Body muted>Delay after each answer. The piano sound always finishes.</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Body>Animal movement</Body>
        </View>
        <Switch
          accessibilityLabel="Animal movement"
          disabled={disabled}
          value={options.animalMotion}
          onValueChange={animalMotion => void updateOptions({ animalMotion })}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Body>Hold for “No response”</Body>
        </View>
        <Switch
          accessibilityLabel="Hold for No response"
          disabled={disabled}
          value={options.holdNoResponse}
          onValueChange={holdNoResponse => void updateOptions({ holdNoResponse })}
        />
      </View>
      <Body muted>A one-second hold helps avoid accidental taps.</Body>
      {error && <Notice>{error}</Notice>}
    </Card>
  );
}
