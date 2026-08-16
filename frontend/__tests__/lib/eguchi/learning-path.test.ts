import { ORDERED_CHORD_IDS, type EguchiChordId } from '@/lib/eguchi/chords';
import {
  GUIDED_WINDOW_SIZE,
  INDEPENDENT_WINDOW_SIZE,
  MEET_ROUNDS_REQUIRED,
  PROMPT_DELAY_STEPS_MS,
  advanceLearningPath,
  createDefaultLearningPathState,
  getActiveTrainingChordIds,
  getTrainingAudioOctaves,
  getTrialHintDelayMs,
  normalizeLearningPathState,
  type EguchiLearningPathState,
  type LearningPathAdvanceResult,
  type TrainingOutcome,
} from '@/lib/eguchi/learning-path';

const advanceMany = (
  state: EguchiLearningPathState,
  unlockedChordIds: EguchiChordId[],
  outcomes: TrainingOutcome[]
) =>
  outcomes.reduce<LearningPathAdvanceResult>(
    (current, outcome) => advanceLearningPath(current.state, current.unlockedChordIds, outcome),
    {
      state,
      unlockedChordIds,
      unlockedChordId: null,
      promptAdvanced: false,
      promptRegressed: false,
      audioGeneralized: false,
    }
  );

describe('adaptive Eguchi learning path', () => {
  test('uses toddler-paced delayed hints after the instant cue', () => {
    expect(PROMPT_DELAY_STEPS_MS).toEqual([0, 3000, 5000, 7000, 9000]);
  });

  test('starts by meeting only Fox with an immediate hint in one octave', () => {
    const state = createDefaultLearningPathState();

    expect(getActiveTrainingChordIds(state, [ORDERED_CHORD_IDS[0]])).toEqual([
      ORDERED_CHORD_IDS[0],
    ]);
    expect(getTrainingAudioOctaves(state)).toEqual([4]);
    expect(
      getTrialHintDelayMs(state, {
        adaptiveHintsEnabled: true,
        noHintTrialsEnabled: true,
      })
    ).toBe(0);
  });

  test('introduces Whale after four successful Fox meetings', () => {
    const result = advanceMany(
      createDefaultLearningPathState(),
      [ORDERED_CHORD_IDS[0]],
      Array.from({ length: MEET_ROUNDS_REQUIRED }, () => 'assisted')
    );

    expect(result.unlockedChordId).toBe(ORDERED_CHORD_IDS[1]);
    expect(result.unlockedChordIds).toEqual(ORDERED_CHORD_IDS.slice(0, 2));
    expect(result.state.phase).toBe('guided');
    expect(result.state.promptStep).toBe(0);
    expect(getActiveTrainingChordIds(result.state, result.unlockedChordIds)).toEqual(
      ORDERED_CHORD_IDS.slice(0, 2)
    );
  });

  test('fades the immediate prompt after four non-corrected guided rounds', () => {
    const guided: EguchiLearningPathState = {
      ...createDefaultLearningPathState(),
      phase: 'guided',
      focusChordId: ORDERED_CHORD_IDS[1],
    };
    const result = advanceMany(guided, ORDERED_CHORD_IDS.slice(0, 2), [
      'assisted',
      'assisted',
      'independent',
      'assisted',
    ]);

    expect(result.promptAdvanced).toBe(true);
    expect(result.state.promptStep).toBe(1);
    expect(PROMPT_DELAY_STEPS_MS[result.state.promptStep]).toBe(3000);
  });

  test('requires mostly independent answers before lengthening a delayed prompt', () => {
    const guided: EguchiLearningPathState = {
      ...createDefaultLearningPathState(),
      phase: 'guided',
      focusChordId: ORDERED_CHORD_IDS[1],
      promptStep: 2,
    };
    const outcomes: TrainingOutcome[] = [
      'independent',
      'assisted',
      'independent',
      'independent',
      'corrected',
      'independent',
    ];
    expect(outcomes.length).toBe(GUIDED_WINDOW_SIZE);

    const result = advanceMany(guided, ORDERED_CHORD_IDS.slice(0, 2), outcomes);

    expect(result.promptAdvanced).toBe(true);
    expect(result.state.promptStep).toBe(3);
  });

  test('backs up one prompt step after repeated corrected rounds', () => {
    const guided: EguchiLearningPathState = {
      ...createDefaultLearningPathState(),
      phase: 'guided',
      focusChordId: ORDERED_CHORD_IDS[1],
      promptStep: 3,
    };
    const result = advanceMany(guided, ORDERED_CHORD_IDS.slice(0, 2), [
      'corrected',
      'assisted',
      'corrected',
    ]);

    expect(result.promptRegressed).toBe(true);
    expect(result.state.promptStep).toBe(2);
  });

  test('offers occasional no-hint probes only after hints have begun fading', () => {
    const probeTurn: EguchiLearningPathState = {
      ...createDefaultLearningPathState(),
      phase: 'guided',
      promptStep: 2,
      totalCompletedRounds: 3,
    };

    expect(
      getTrialHintDelayMs(probeTurn, {
        adaptiveHintsEnabled: true,
        noHintTrialsEnabled: true,
      })
    ).toBeNull();
    expect(
      getTrialHintDelayMs(probeTurn, {
        adaptiveHintsEnabled: true,
        noHintTrialsEnabled: false,
      })
    ).toBe(5000);
  });

  test('generalizes audio one stage at a time before introducing a new friend', () => {
    const independent: EguchiLearningPathState = {
      ...createDefaultLearningPathState(),
      phase: 'independent',
      focusChordId: ORDERED_CHORD_IDS[1],
      promptStep: PROMPT_DELAY_STEPS_MS.length - 1,
      audioStage: 0,
    };
    const masteryOutcomes = Array.from(
      { length: INDEPENDENT_WINDOW_SIZE },
      (): TrainingOutcome => 'independent'
    );

    const firstGeneralization = advanceMany(
      independent,
      ORDERED_CHORD_IDS.slice(0, 2),
      masteryOutcomes
    );
    expect(firstGeneralization.audioGeneralized).toBe(true);
    expect(firstGeneralization.state.audioStage).toBe(1);
    expect(getTrainingAudioOctaves(firstGeneralization.state)).toEqual([4, 3]);

    const secondGeneralization = advanceMany(
      firstGeneralization.state,
      firstGeneralization.unlockedChordIds,
      masteryOutcomes
    );
    expect(secondGeneralization.state.audioStage).toBe(2);
    expect(getTrainingAudioOctaves(secondGeneralization.state)).toEqual([3, 4, 5]);

    const newFriend = advanceMany(
      secondGeneralization.state,
      secondGeneralization.unlockedChordIds,
      masteryOutcomes
    );
    expect(newFriend.unlockedChordId).toBe(ORDERED_CHORD_IDS[2]);
    expect(newFriend.state.phase).toBe('meet');
    expect(newFriend.state.focusChordId).toBe(ORDERED_CHORD_IDS[2]);
    expect(getActiveTrainingChordIds(newFriend.state, newFriend.unlockedChordIds)).toEqual([
      ORDERED_CHORD_IDS[2],
    ]);
  });

  test('normalizes unsafe persisted learning state', () => {
    const normalized = normalizeLearningPathState(
      {
        phase: 'unknown',
        focusChordId: 'not-a-chord',
        promptStep: 99,
        audioStage: -5,
        recentOutcomes: ['independent', 'invalid'],
        totalCompletedRounds: -10,
      },
      ORDERED_CHORD_IDS.slice(0, 2)
    );

    expect(normalized.phase).toBe('guided');
    expect(normalized.focusChordId).toBe(ORDERED_CHORD_IDS[1]);
    expect(normalized.promptStep).toBe(PROMPT_DELAY_STEPS_MS.length - 1);
    expect(normalized.audioStage).toBe(0);
    expect(normalized.recentOutcomes).toEqual(['independent']);
    expect(normalized.totalCompletedRounds).toBe(0);
  });
});
