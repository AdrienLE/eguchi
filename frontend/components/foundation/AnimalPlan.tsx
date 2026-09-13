import React, { useState } from 'react';
import { View } from 'react-native';
import { useFoundation } from '@/lib/foundation/FoundationProvider';
import {
  CHORD_CURRICULUM,
  CURRICULUM_BY_ID,
  curriculumThrough,
  sessionTarget,
  type ChordId,
} from '@/lib/foundation/curriculum';
import { makeEvent } from '@/lib/foundation/program';
import { usePiano } from '@/lib/foundation/usePiano';
import AnimalCard from './AnimalCard';
import { Body, Button, Card, Heading, Notice, styles } from './ui';
export default function AnimalPlan() {
  const f = useFoundation();
  const piano = usePiano();
  const [stage, setStage] = useState(f.state.preferences.stage);
  const [active, setActive] = useState(f.state.preferences.activeChordIds);
  const [introducing, setIntroducing] = useState(!!f.state.preferences.introductionChordId);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const changeStage = (next: number) => {
    setStage(next);
    setActive(curriculumThrough(next));
    setIntroducing(next > 1);
  };
  const toggle = (id: ChordId) =>
    setActive(current =>
      current.includes(id)
        ? current.length > 1
          ? current.filter(value => value !== id)
          : current
        : [...current, id]
    );
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const newest = CHORD_CURRICULUM[stage - 1].id;
      await f.append(
        makeEvent('preferences', {
          stage,
          activeChordIds: CHORD_CURRICULUM.map(chord => chord.id).filter(id => active.includes(id)),
          introductionChordId:
            introducing && active.includes(newest) && active.length > 1 ? newest : null,
        })
      );
      await f.sync();
      setMessage('Animal plan saved.');
    } catch {
      setMessage('Could not save. Please retry.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ borderColor: '#CFBDE9', backgroundColor: '#FCF9FF' }}>
      <Heading>Your animal journey</Heading>
      <Body>
        Fourteen sounds, introduced in this order. You can override the latest AI decision here.
      </Body>
      <View style={[styles.row, { justifyContent: 'center' }]}>
        {CHORD_CURRICULUM.map((chord, index) => (
          <AnimalCard
            key={chord.id}
            id={chord.id}
            size={70}
            selected={index + 1 === stage}
            muted={index + 1 > stage}
            onPress={() => changeStage(index + 1)}
          />
        ))}
      </View>
      <Body>
        {stage} of 14 introduced · newest: {CHORD_CURRICULUM[stage - 1].color}{' '}
        {CHORD_CURRICULUM[stage - 1].animal}
      </Body>
      <View style={styles.row}>
        <Button
          secondary
          title="One step back"
          disabled={stage === 1}
          onPress={() => changeStage(stage - 1)}
        />
        <Button
          title={stage < 14 ? `Add ${CHORD_CURRICULUM[stage].color}` : 'All friends introduced'}
          disabled={stage === 14}
          onPress={() => changeStage(stage + 1)}
        />
      </View>
      <Button
        secondary
        title={`Preview ${CHORD_CURRICULUM[stage - 1].color} · parent only`}
        disabled={!piano.ready || piano.playing}
        onPress={() => {
          void piano.play(CHORD_CURRICULUM[stage - 1].id).catch(() => {});
        }}
      />
      {stage > 1 && (
        <>
          <Body>How should the sounds be mixed?</Body>
          <Button
            secondary={!introducing}
            title="Introduce the newest gently"
            onPress={() => setIntroducing(true)}
          />
          <Button
            secondary={introducing}
            title="Mix familiar sounds evenly"
            onPress={() => setIntroducing(false)}
          />
        </>
      )}
      <Button
        secondary
        title={custom ? 'Hide individual animal choices' : 'Customize active animals'}
        onPress={() => setCustom(value => !value)}
      />
      {custom && (
        <>
          <Body>For focused practice, choose from the animals already introduced.</Body>
          <View style={styles.row}>
            {curriculumThrough(stage).map(id => (
              <Button
                key={id}
                secondary={!active.includes(id)}
                title={`${active.includes(id) ? '✓ ' : ''}${CURRICULUM_BY_ID[id].color}`}
                onPress={() => toggle(id)}
              />
            ))}
          </View>
        </>
      )}
      <Body muted>
        {sessionTarget(active)} presentations per session. Changing the plan starts a fresh two-week
        observation period. Pause AI reviews above to keep manual control.
      </Body>
      <Button title="Save animal plan" busy={busy} onPress={() => void save()} />
      {(message || piano.error) && <Notice>{message ?? piano.error}</Notice>}
    </Card>
  );
}
