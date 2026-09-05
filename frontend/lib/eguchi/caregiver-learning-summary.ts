import { CHORD_BY_ID } from './chords';
import {
  DAILY_WARMUP_ROUNDS,
  GUIDED_INDEPENDENT_REQUIRED,
  GUIDED_WINDOW_SIZE,
  INDEPENDENT_MASTERY_REQUIRED,
  INDEPENDENT_WINDOW_SIZE,
  MEET_ROUNDS_REQUIRED,
  PROMPT_DELAY_STEPS_MS,
  getDailyWarmupRoundsRemaining,
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

export type CaregiverTimelineStatus = 'complete' | 'current' | 'upcoming';

export type CaregiverLearningTimelineStep = {
  id: string;
  label: string;
  hintLabel: string;
  detail: string;
  status: CaregiverTimelineStatus;
};

export type CaregiverLearningTimeline = {
  steps: CaregiverLearningTimelineStep[];
  notes: string[];
  dailyWarmupLabel: string;
};

const formatHintDelay = (delayMs: number | null) => {
  if (delayMs === null) return 'None';
  if (delayMs === 0) return 'Instant';
  return `${Number((delayMs / 1000).toFixed(2))} sec`;
};

const getMeetStatus = (state: EguchiLearningPathState): CaregiverTimelineStatus =>
  state.phase === 'meet' ? 'current' : 'complete';

const getGuidedPromptStatus = (
  state: EguchiLearningPathState,
  promptStep: number
): CaregiverTimelineStatus => {
  if (state.phase === 'meet') return 'upcoming';
  if (state.phase === 'independent') return 'complete';
  if (promptStep < state.promptStep) return 'complete';
  if (promptStep === state.promptStep) return 'current';
  return 'upcoming';
};

const getIndependentStatus = (state: EguchiLearningPathState): CaregiverTimelineStatus =>
  state.phase === 'independent' ? 'current' : 'upcoming';

export const getCaregiverLearningSummary = (
  state: EguchiLearningPathState,
  adaptiveHintsEnabled: boolean
): CaregiverLearningSummary => {
  const focusAnimal = CHORD_BY_ID[state.focusChordId]?.animal ?? 'current friend';
  const octaves = adaptiveHintsEnabled ? getTrainingAudioOctaves(state) : [3, 4, 5];
  const hintDelay = adaptiveHintsEnabled
    ? getTrialHintDelayMs(state, {
        adaptiveHintsEnabled: true,
        noHintTrialsEnabled: false,
      })
    : null;

  const stageLabel = !adaptiveHintsEnabled
    ? 'Legacy practice'
    : state.phase === 'meet'
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

export const getCaregiverLearningTimeline = (
  state: EguchiLearningPathState,
  options: { todayCompletedRounds?: number } = {}
): CaregiverLearningTimeline => {
  const focusAnimal = CHORD_BY_ID[state.focusChordId]?.animal ?? 'current friend';
  const warmupRemaining =
    state.phase === 'meet' ? 0 : getDailyWarmupRoundsRemaining(options.todayCompletedRounds ?? 0);
  const guidedSteps = PROMPT_DELAY_STEPS_MS.map((delayMs, promptStep) => ({
    id: `guided-${promptStep}`,
    label: promptStep === 0 ? 'Guided cue' : `${formatHintDelay(delayMs)} cue`,
    hintLabel: formatHintDelay(delayMs),
    detail:
      promptStep === 0
        ? 'Two friends are on screen; the color wink is immediate while the new choice becomes familiar.'
        : promptStep === 1
          ? `${MEET_ROUNDS_REQUIRED} guided rounds without corrections move the cue to ${formatHintDelay(
              delayMs
            )}.`
          : `${GUIDED_INDEPENDENT_REQUIRED}/${GUIDED_WINDOW_SIZE} independent guided rounds move the cue to ${formatHintDelay(
              delayMs
            )}.`,
    status: getGuidedPromptStatus(state, promptStep),
  }));

  return {
    steps: [
      {
        id: 'meet',
        label: `Meet ${focusAnimal}`,
        hintLabel: 'Instant',
        detail: `${MEET_ROUNDS_REQUIRED} meet rounds with one friend introduce the next choice.`,
        status: getMeetStatus(state),
      },
      ...guidedSteps,
      {
        id: 'independent',
        label: 'Independent practice',
        hintLabel: 'None',
        detail: `Regular winks are off; ${INDEPENDENT_MASTERY_REQUIRED}/${INDEPENDENT_WINDOW_SIZE} independent rounds for each friend, including each practiced octave, expand the range and then unlock a new friend.`,
        status: getIndependentStatus(state),
      },
    ],
    notes: [
      `Forward: instant to 3 sec needs ${MEET_ROUNDS_REQUIRED} guided rounds without corrections; later waits need ${GUIDED_INDEPENDENT_REQUIRED}/${GUIDED_WINDOW_SIZE} independent rounds with at most one correction.`,
      'Back: two corrected rounds in the last 3 guided rounds move one step easier, down to Meet; in independent practice, two in the last 4 return to 9 sec.',
      `Daily warmup: the first ${DAILY_WARMUP_ROUNDS} rounds each day use one easier step before returning to the saved timeline.`,
      'Next friend: independent mastery across octaves 3-5 starts the next friend at Meet.',
    ],
    dailyWarmupLabel:
      state.phase === 'meet'
        ? 'At easiest step'
        : warmupRemaining > 0
          ? `${warmupRemaining} warmup rounds left today`
          : 'Warmup complete today',
  };
};
