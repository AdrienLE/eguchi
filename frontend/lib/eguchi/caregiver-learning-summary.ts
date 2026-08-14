import { CHORD_BY_ID } from './chords';
import {
  getTrainingAudioOctaves,
  getTrialHintDelayMs,
  type EguchiLearningPathState,
} from './learning-path';

export type CaregiverLearningSummary = {
  stageLabel: string;
  focusLabel: string;
  hintLabel: string;
  audioRangeLabel: string;
  recentIndependent: number;
  recentRounds: number;
};

const formatHintDelay = (delayMs: number | null) => {
  if (delayMs === null) return 'None';
  if (delayMs === 0) return 'Instant';
  return `${Number((delayMs / 1000).toFixed(2))} sec`;
};

export const getCaregiverLearningSummary = (
  state: EguchiLearningPathState,
  adaptiveHintsEnabled: boolean
): CaregiverLearningSummary => {
  const focusAnimal = CHORD_BY_ID[state.focusChordId]?.animal ?? 'current friend';
  const octaves = getTrainingAudioOctaves(state);
  const hintDelay = adaptiveHintsEnabled
    ? getTrialHintDelayMs(state, {
        adaptiveHintsEnabled: true,
        noHintTrialsEnabled: false,
      })
    : null;

  const stageLabel =
    state.phase === 'meet'
      ? `Meet ${focusAnimal}`
      : state.phase === 'guided'
        ? 'Guided practice'
        : 'Independent practice';

  return {
    stageLabel,
    focusLabel: focusAnimal,
    hintLabel: adaptiveHintsEnabled ? formatHintDelay(hintDelay) : 'Adaptive hints off',
    audioRangeLabel:
      octaves.length === 1
        ? `Octave ${octaves[0]}`
        : `Octaves ${Math.min(...octaves)}–${Math.max(...octaves)}`,
    recentIndependent: state.recentOutcomes.filter(outcome => outcome === 'independent').length,
    recentRounds: state.recentOutcomes.length,
  };
};
