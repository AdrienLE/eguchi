import {
  getCaregiverLearningSummary,
  getCaregiverLearningTimeline,
} from '@/lib/eguchi/caregiver-learning-summary';
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

  test('shows the color-wink timeline and current guided wait', () => {
    const timeline = getCaregiverLearningTimeline({
      ...createDefaultLearningPathState(),
      phase: 'guided',
      promptStep: 2,
    });

    expect(timeline.steps.map(step => step.hintLabel)).toEqual([
      'Instant',
      'Instant',
      '3 sec',
      '5 sec',
      '7 sec',
      '9 sec',
      'None',
    ]);
    expect(timeline.steps.map(step => step.status)).toEqual([
      'complete',
      'complete',
      'complete',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(timeline.notes[0]).toContain('instant to 3 sec');
    expect(timeline.notes[0]).toContain('4/6 independent rounds');
    expect(timeline.notes[1]).toContain('down to Meet');
    expect(timeline.notes[2]).toContain('first 3 rounds');
  });

  test('marks independent practice as the active timeline step', () => {
    const timeline = getCaregiverLearningTimeline({
      ...createDefaultLearningPathState(),
      phase: 'independent',
      promptStep: 4,
    });

    const finalStep = timeline.steps[timeline.steps.length - 1];
    expect(finalStep.label).toBe('Independent practice');
    expect(finalStep.hintLabel).toBe('None');
    expect(finalStep.status).toBe('current');
  });

  test('labels remaining daily warmup rounds', () => {
    const guided = {
      ...createDefaultLearningPathState(),
      phase: 'guided' as const,
      promptStep: 2,
    };

    expect(
      getCaregiverLearningTimeline(guided, {
        todayCompletedRounds: 1,
      }).dailyWarmupLabel
    ).toBe('2 warmup rounds left today');
    expect(
      getCaregiverLearningTimeline(guided, {
        todayCompletedRounds: 3,
      }).dailyWarmupLabel
    ).toBe('Warmup complete today');
    expect(getCaregiverLearningTimeline(createDefaultLearningPathState()).dailyWarmupLabel).toBe(
      'At easiest step'
    );
  });
});
