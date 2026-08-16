import { getCaregiverLearningSummary } from '@/lib/eguchi/caregiver-learning-summary';
import { createDefaultLearningPathState } from '@/lib/eguchi/learning-path';

describe('caregiver learning summary', () => {
  test('describes the instant Fox introduction in one octave', () => {
    const summary = getCaregiverLearningSummary(createDefaultLearningPathState(), true);

    expect(summary.stageLabel).toBe('Meet Fox');
    expect(summary.focusLabel).toBe('Fox');
    expect(summary.hintLabel).toBe('Instant');
    expect(summary.audioRangeLabel).toBe('Octave 4');
    expect(summary.recentIndependent).toBe(0);
    expect(summary.recentRounds).toBe(0);
  });

  test('describes guided delay, generalization, and recent independence', () => {
    const summary = getCaregiverLearningSummary(
      {
        ...createDefaultLearningPathState(),
        phase: 'guided',
        promptStep: 3,
        audioStage: 1,
        recentOutcomes: ['independent', 'assisted', 'independent'],
      },
      true
    );

    expect(summary.stageLabel).toBe('Guided practice');
    expect(summary.hintLabel).toBe('7 sec');
    expect(summary.audioRangeLabel).toBe('Octaves 3–4');
    expect(summary.recentIndependent).toBe(2);
    expect(summary.recentRounds).toBe(3);
  });

  test('makes it clear when adaptive hints are disabled', () => {
    const summary = getCaregiverLearningSummary(createDefaultLearningPathState(), false);
    expect(summary.hintLabel).toBe('Adaptive hints off');
  });
});
