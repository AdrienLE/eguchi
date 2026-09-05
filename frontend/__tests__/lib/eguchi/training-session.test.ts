import { completeTrainingTrial, resolveTrainingTrialSettings } from '@/lib/eguchi/training-session';
import { createDefaultEguchiProgress, setUnlockedLevel } from '@/lib/eguchi/progress';
import { createDefaultEguchiSessionPreferences } from '@/lib/eguchi/session-preferences';

const preferences = {
  ...createDefaultEguchiSessionPreferences(),
  adaptiveHintsEnabled: false,
  autoUnlockEnabled: false,
};

describe('legacy training mode', () => {
  test('uses all caregiver-selected chords and octaves without hints', () => {
    const progress = setUnlockedLevel(createDefaultEguchiProgress(), 4);
    const trial = resolveTrainingTrialSettings(progress, preferences);
    expect(trial.chordIds).toEqual(progress.unlockedChordIds);
    expect(trial.audioOctaves).toEqual([3, 4, 5]);
    expect(trial.hintDelayMs).toBeNull();
    expect(trial.warmupRoundsRemaining).toBe(0);
  });

  test('records practice without advancing the adaptive path or unlocking friends', () => {
    let progress = createDefaultEguchiProgress();
    const originalPath = progress.learningPath;
    for (let index = 0; index < 20; index += 1) {
      progress = completeTrainingTrial(
        progress,
        { id: `round-${index}`, chordId: 'C-E-G', correct: true, outcome: 'independent' },
        preferences
      );
    }
    expect(progress.trialHistory.length).toBe(20);
    expect(progress.unlockedChordIds).toEqual(['C-E-G']);
    expect(progress.learningPath).toEqual(originalPath);
  });

  test('adaptive mode still introduces the second friend', () => {
    let progress = createDefaultEguchiProgress();
    for (let index = 0; index < 4; index += 1) {
      progress = completeTrainingTrial(
        progress,
        { id: `round-${index}`, chordId: 'C-E-G', correct: true, outcome: 'assisted' },
        { ...preferences, adaptiveHintsEnabled: true }
      );
    }
    expect(progress.unlockedChordIds.length).toBe(2);
    expect(progress.learningPath.phase).toBe('guided');
  });
});
