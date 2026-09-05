import { ORDERED_CHORD_IDS, type EguchiChordId } from './chords';

export const LEARNING_PATH_VERSION = 2;
export const PROMPT_DELAY_STEPS_MS = [0, 3000, 5000, 7000, 9000] as const;
export const MEET_ROUNDS_REQUIRED = 4;
export const GUIDED_WINDOW_SIZE = 6;
export const GUIDED_INDEPENDENT_REQUIRED = 4;
export const INDEPENDENT_WINDOW_SIZE = 10;
export const INDEPENDENT_MASTERY_REQUIRED = 8;
export const NO_HINT_EVERY_N_ROUNDS = 4;
export const DAILY_WARMUP_ROUNDS = 3;

export type TrainingOutcome = 'independent' | 'assisted' | 'corrected';
export type LearningPathPhase = 'meet' | 'guided' | 'independent';
export type AudioGeneralizationStage = 0 | 1 | 2;

export type RecognitionEvidence = { outcome: TrainingOutcome; octave: number | null };

export type EguchiLearningPathState = {
  version: typeof LEARNING_PATH_VERSION;
  phase: LearningPathPhase;
  focusChordId: EguchiChordId;
  promptStep: number;
  audioStage: AudioGeneralizationStage;
  recentOutcomes: TrainingOutcome[];
  recentTrialsByChord?: Partial<Record<EguchiChordId, RecognitionEvidence[]>>;
  totalCompletedRounds: number;
};

export type LearningPathAdvanceResult = {
  state: EguchiLearningPathState;
  unlockedChordIds: EguchiChordId[];
  unlockedChordId: EguchiChordId | null;
  promptAdvanced: boolean;
  promptRegressed: boolean;
  audioGeneralized: boolean;
};

export const isTrainingOutcome = (candidate: unknown): candidate is TrainingOutcome =>
  candidate === 'independent' || candidate === 'assisted' || candidate === 'corrected';

const clampPromptStep = (candidate: unknown) => {
  const numeric = typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
  return Math.max(0, Math.min(PROMPT_DELAY_STEPS_MS.length - 1, Math.round(numeric)));
};

const clampAudioStage = (candidate: unknown): AudioGeneralizationStage => {
  const numeric = typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
  return Math.max(0, Math.min(2, Math.round(numeric))) as AudioGeneralizationStage;
};

const getFocusChordId = (ids: EguchiChordId[]) => ids[ids.length - 1] ?? ORDERED_CHORD_IDS[0];

export const createDefaultLearningPathState = (): EguchiLearningPathState => ({
  version: LEARNING_PATH_VERSION,
  phase: 'meet',
  focusChordId: ORDERED_CHORD_IDS[0],
  promptStep: 0,
  audioStage: 0,
  recentOutcomes: [],
  recentTrialsByChord: {},
  totalCompletedRounds: 0,
});

export const createLearningPathStateForUnlocked = (
  unlockedChordIds: EguchiChordId[],
  options: { introduceNewest?: boolean } = {}
): EguchiLearningPathState => {
  if (unlockedChordIds.length <= 1) {
    return createDefaultLearningPathState();
  }

  if (options.introduceNewest) {
    return {
      ...createDefaultLearningPathState(),
      focusChordId: getFocusChordId(unlockedChordIds),
    };
  }

  return {
    version: LEARNING_PATH_VERSION,
    phase: 'independent',
    focusChordId: getFocusChordId(unlockedChordIds),
    promptStep: PROMPT_DELAY_STEPS_MS.length - 1,
    audioStage: 2,
    recentOutcomes: [],
    recentTrialsByChord: {},
    totalCompletedRounds: 0,
  };
};

const normalizeRecognitionEvidence = (
  candidate: unknown,
  chordIds: EguchiChordId[]
): Partial<Record<EguchiChordId, RecognitionEvidence[]>> => {
  const normalized: Partial<Record<EguchiChordId, RecognitionEvidence[]>> = {};
  if (!candidate || typeof candidate !== 'object') return normalized;
  for (const chordId of chordIds) {
    const entries = (candidate as Record<string, unknown>)[chordId];
    if (Array.isArray(entries)) {
      normalized[chordId] = entries
        .filter(entry => entry && isTrainingOutcome(entry.outcome))
        .slice(-INDEPENDENT_WINDOW_SIZE)
        .map(entry => ({
          outcome: entry.outcome,
          octave: [3, 4, 5].includes(entry.octave) ? entry.octave : null,
        }));
    }
  }
  return normalized;
};

export const normalizeLearningPathState = (
  candidate: unknown,
  unlockedChordIds: EguchiChordId[]
): EguchiLearningPathState => {
  if (!candidate || typeof candidate !== 'object') {
    return createLearningPathStateForUnlocked(unlockedChordIds);
  }

  const stored = candidate as Partial<EguchiLearningPathState>;
  const focusChordId = unlockedChordIds.includes(stored.focusChordId as EguchiChordId)
    ? (stored.focusChordId as EguchiChordId)
    : getFocusChordId(unlockedChordIds);
  const phase: LearningPathPhase =
    stored.phase === 'meet' || stored.phase === 'guided' || stored.phase === 'independent'
      ? stored.phase
      : unlockedChordIds.length <= 1
        ? 'meet'
        : 'guided';
  const recentOutcomes = Array.isArray(stored.recentOutcomes)
    ? stored.recentOutcomes.filter(isTrainingOutcome).slice(-INDEPENDENT_WINDOW_SIZE)
    : [];
  const totalCompletedRounds =
    typeof stored.totalCompletedRounds === 'number' && Number.isFinite(stored.totalCompletedRounds)
      ? Math.max(0, Math.round(stored.totalCompletedRounds))
      : 0;

  return {
    version: LEARNING_PATH_VERSION,
    phase,
    focusChordId,
    promptStep: clampPromptStep(stored.promptStep),
    audioStage: clampAudioStage(stored.audioStage),
    recentOutcomes,
    recentTrialsByChord: normalizeRecognitionEvidence(stored.recentTrialsByChord, unlockedChordIds),
    totalCompletedRounds,
  };
};

export const getActiveTrainingChordIds = (
  state: EguchiLearningPathState,
  unlockedChordIds: EguchiChordId[]
) => {
  if (state.phase === 'meet' && unlockedChordIds.includes(state.focusChordId)) {
    return [state.focusChordId];
  }
  return [...unlockedChordIds];
};

export const getTrainingAudioOctaves = (state: EguchiLearningPathState): number[] => {
  if (state.phase === 'meet' || state.audioStage === 0) {
    return [4];
  }
  if (state.audioStage === 1) {
    return [4, 3];
  }
  return [3, 4, 5];
};

export const getDailyWarmupRoundsRemaining = (todayCompletedRounds: number) => {
  const completed = Number.isFinite(todayCompletedRounds) ? Math.max(0, todayCompletedRounds) : 0;
  return Math.max(0, DAILY_WARMUP_ROUNDS - Math.floor(completed));
};

export const getWarmupLearningPathState = (
  state: EguchiLearningPathState,
  todayCompletedRounds: number
): EguchiLearningPathState => {
  if (getDailyWarmupRoundsRemaining(todayCompletedRounds) <= 0 || state.phase === 'meet') {
    return state;
  }

  if (state.phase === 'guided') {
    if (state.promptStep > 0) {
      return {
        ...state,
        promptStep: state.promptStep - 1,
      };
    }
    return {
      ...state,
      phase: 'meet',
      audioStage: 0,
    };
  }

  return {
    ...state,
    phase: 'guided',
    promptStep: PROMPT_DELAY_STEPS_MS.length - 1,
    audioStage: Math.max(0, state.audioStage - 1) as AudioGeneralizationStage,
  };
};

export const getTrialHintDelayMs = (
  state: EguchiLearningPathState,
  options: { adaptiveHintsEnabled: boolean; noHintTrialsEnabled: boolean }
): number | null => {
  if (!options.adaptiveHintsEnabled || state.phase === 'independent') {
    return null;
  }
  if (state.phase === 'meet') {
    return 0;
  }

  const shouldOfferNoHintTrial =
    options.noHintTrialsEnabled &&
    state.promptStep >= 2 &&
    (state.totalCompletedRounds + 1) % NO_HINT_EVERY_N_ROUNDS === 0;
  if (shouldOfferNoHintTrial) {
    return null;
  }

  return PROMPT_DELAY_STEPS_MS[state.promptStep] ?? PROMPT_DELAY_STEPS_MS[0];
};

const countOutcome = (outcomes: TrainingOutcome[], outcome: TrainingOutcome) =>
  outcomes.filter(candidate => candidate === outcome).length;

const makeAdvanceResult = (
  state: EguchiLearningPathState,
  unlockedChordIds: EguchiChordId[],
  overrides: Partial<Omit<LearningPathAdvanceResult, 'state' | 'unlockedChordIds'>> = {}
): LearningPathAdvanceResult => ({
  state,
  unlockedChordIds,
  unlockedChordId: null,
  promptAdvanced: false,
  promptRegressed: false,
  audioGeneralized: false,
  ...overrides,
});

export const advanceLearningPath = (
  currentState: EguchiLearningPathState,
  currentUnlockedChordIds: EguchiChordId[],
  outcome: TrainingOutcome,
  trial: { chordId: EguchiChordId; octave: number | null }
): LearningPathAdvanceResult => {
  const unlockedChordIds = [...currentUnlockedChordIds];
  const recentOutcomes = [...currentState.recentOutcomes, outcome].slice(-INDEPENDENT_WINDOW_SIZE);
  const recentTrialsByChord = normalizeRecognitionEvidence(
    currentState.recentTrialsByChord,
    unlockedChordIds
  );
  if (unlockedChordIds.includes(trial.chordId)) {
    recentTrialsByChord[trial.chordId] = [
      ...(recentTrialsByChord[trial.chordId] ?? []),
      { outcome, octave: trial.octave },
    ].slice(-INDEPENDENT_WINDOW_SIZE);
  }
  const state: EguchiLearningPathState = {
    ...currentState,
    recentOutcomes,
    recentTrialsByChord,
    totalCompletedRounds: currentState.totalCompletedRounds + 1,
  };

  if (state.phase === 'meet') {
    if (recentOutcomes.length < MEET_ROUNDS_REQUIRED) {
      return makeAdvanceResult(state, unlockedChordIds);
    }

    let unlockedChordId: EguchiChordId | null = null;
    if (unlockedChordIds.length === 1) {
      unlockedChordId = ORDERED_CHORD_IDS[1] ?? null;
      if (unlockedChordId) {
        unlockedChordIds.push(unlockedChordId);
      }
    }

    return makeAdvanceResult(
      {
        ...state,
        phase: 'guided',
        focusChordId: unlockedChordId ?? state.focusChordId,
        promptStep: 0,
        audioStage: 0,
        recentOutcomes: [],
        recentTrialsByChord: {},
      },
      unlockedChordIds,
      { unlockedChordId, promptAdvanced: true }
    );
  }

  if (state.phase === 'guided') {
    const regressionWindow = recentOutcomes.slice(-3);
    if (regressionWindow.length === 3 && countOutcome(regressionWindow, 'corrected') >= 2) {
      return makeAdvanceResult(
        state.promptStep > 0
          ? {
              ...state,
              promptStep: state.promptStep - 1,
              recentOutcomes: [],
              recentTrialsByChord: {},
            }
          : {
              ...state,
              phase: 'meet',
              audioStage: 0,
              recentOutcomes: [],
              recentTrialsByChord: {},
            },
        unlockedChordIds,
        { promptRegressed: true }
      );
    }

    const guidedWindow = recentOutcomes.slice(-GUIDED_WINDOW_SIZE);
    const readyAtImmediateStep =
      state.promptStep === 0 &&
      guidedWindow.filter(candidate => candidate !== 'corrected').length >= MEET_ROUNDS_REQUIRED;
    const readyAtDelayedStep =
      state.promptStep > 0 &&
      guidedWindow.length === GUIDED_WINDOW_SIZE &&
      countOutcome(guidedWindow, 'independent') >= GUIDED_INDEPENDENT_REQUIRED &&
      countOutcome(guidedWindow, 'corrected') <= 1;

    if (!readyAtImmediateStep && !readyAtDelayedStep) {
      return makeAdvanceResult(state, unlockedChordIds);
    }

    const isLastPromptStep = state.promptStep >= PROMPT_DELAY_STEPS_MS.length - 1;
    return makeAdvanceResult(
      {
        ...state,
        phase: isLastPromptStep ? 'independent' : 'guided',
        promptStep: isLastPromptStep ? state.promptStep : state.promptStep + 1,
        recentOutcomes: [],
        recentTrialsByChord: {},
      },
      unlockedChordIds,
      { promptAdvanced: true }
    );
  }

  const regressionWindow = recentOutcomes.slice(-4);
  if (regressionWindow.length === 4 && countOutcome(regressionWindow, 'corrected') >= 2) {
    return makeAdvanceResult(
      {
        ...state,
        phase: 'guided',
        promptStep: PROMPT_DELAY_STEPS_MS.length - 1,
        recentOutcomes: [],
        recentTrialsByChord: {},
      },
      unlockedChordIds,
      { promptRegressed: true }
    );
  }

  const requiredOctaves = getTrainingAudioOctaves(state);
  const hasIndependentMastery = unlockedChordIds.every(chordId => {
    const evidence = recentTrialsByChord[chordId] ?? [];
    return (
      evidence.length === INDEPENDENT_WINDOW_SIZE &&
      evidence.filter(trial => trial.outcome === 'independent').length >=
        INDEPENDENT_MASTERY_REQUIRED &&
      evidence.filter(trial => trial.outcome === 'corrected').length <= 1 &&
      requiredOctaves.every(octave =>
        evidence.some(trial => trial.octave === octave && trial.outcome === 'independent')
      )
    );
  });
  if (!hasIndependentMastery) {
    return makeAdvanceResult(state, unlockedChordIds);
  }

  if (state.audioStage < 2) {
    return makeAdvanceResult(
      {
        ...state,
        audioStage: (state.audioStage + 1) as AudioGeneralizationStage,
        recentOutcomes: [],
        recentTrialsByChord: {},
      },
      unlockedChordIds,
      { audioGeneralized: true }
    );
  }

  const unlockedChordId = ORDERED_CHORD_IDS[unlockedChordIds.length] ?? null;
  if (!unlockedChordId) {
    return makeAdvanceResult(
      { ...state, recentOutcomes: [], recentTrialsByChord: {} },
      unlockedChordIds
    );
  }
  unlockedChordIds.push(unlockedChordId);

  return makeAdvanceResult(
    {
      ...state,
      phase: 'meet',
      focusChordId: unlockedChordId,
      promptStep: 0,
      audioStage: 0,
      recentOutcomes: [],
      recentTrialsByChord: {},
    },
    unlockedChordIds,
    { unlockedChordId }
  );
};
