import {
  advanceLearningPath,
  getActiveTrainingChordIds,
  getDailyWarmupRoundsRemaining,
  getTrainingAudioOctaves,
  getTrialHintDelayMs,
  getWarmupLearningPathState,
} from './learning-path';
import {
  getProgressSnapshot,
  recordTrial,
  type EguchiProgress,
  type RecordTrialInput,
} from './progress';
import { maybeApplyAutoUnlock } from './progression';
import type { EguchiSessionPreferences } from './session-preferences';

export const resolveTrainingTrialSettings = (
  progress: EguchiProgress,
  preferences: EguchiSessionPreferences,
  date: Date = new Date()
) => {
  const todayAttempts = getProgressSnapshot(progress, date).todayAttempts;
  const warmupRoundsRemaining = preferences.adaptiveHintsEnabled
    ? getDailyWarmupRoundsRemaining(todayAttempts)
    : 0;
  const effectiveLearningPath =
    warmupRoundsRemaining > 0
      ? getWarmupLearningPathState(progress.learningPath, todayAttempts)
      : progress.learningPath;
  return {
    warmupRoundsRemaining,
    effectiveLearningPath,
    chordIds: preferences.adaptiveHintsEnabled
      ? getActiveTrainingChordIds(effectiveLearningPath, progress.unlockedChordIds)
      : [...progress.unlockedChordIds],
    audioOctaves: preferences.adaptiveHintsEnabled
      ? getTrainingAudioOctaves(effectiveLearningPath)
      : [3, 4, 5],
    hintDelayMs: getTrialHintDelayMs(effectiveLearningPath, {
      adaptiveHintsEnabled: preferences.adaptiveHintsEnabled,
      noHintTrialsEnabled: preferences.noHintTrialsEnabled && warmupRoundsRemaining <= 0,
    }),
  };
};

export const completeTrainingTrial = (
  progress: EguchiProgress,
  trial: RecordTrialInput,
  preferences: EguchiSessionPreferences
): EguchiProgress => {
  const recorded = recordTrial(progress, trial);
  if (!preferences.adaptiveHintsEnabled) {
    return maybeApplyAutoUnlock(recorded, {
      autoUnlockEnabled: preferences.autoUnlockEnabled,
      perfectDaysRequired: preferences.perfectDaysRequired,
      dailyAttemptTarget: preferences.dailyAttemptTarget,
    }).progress;
  }
  const result = advanceLearningPath(
    recorded.learningPath,
    recorded.unlockedChordIds,
    trial.outcome ?? (trial.correct ? 'independent' : 'corrected')
  );
  return { ...recorded, unlockedChordIds: result.unlockedChordIds, learningPath: result.state };
};
