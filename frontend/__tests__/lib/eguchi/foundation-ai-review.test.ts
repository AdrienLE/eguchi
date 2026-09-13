import { expect, test } from '@jest/globals';
import { deriveProgram, makeEvent, reviewRecord } from '@/lib/foundation/program';

const review = (applied = true) =>
  makeEvent(
    'aiReview',
    {
      decision: applied ? 'advance' : 'hold',
      confidence: 'high',
      reason: 'Comfortable practice.',
      nextStep: 'Introduce yellow gently.',
      uncertainties: [],
      sourceIds: ['B2-Q9'],
      sourceReferences: ['Book 2 Q9, pp. 37–40'],
      applied,
      stageBefore: 1,
      stageAfter: applied ? 2 : 1,
      reviewedOn: '2026-09-12',
      nextReviewOn: '2026-09-26',
      model: 'gpt-6-astra',
      reasoningEffort: 'medium',
      policyVersion: 'eguchi-review-1',
      guardReasons: [],
      evidenceHash: 'a'.repeat(64),
    },
    new Date('2026-09-12T18:00:00Z')
  );

test('a server decision introduces exactly the next sound and is retained in the record', () => {
  const event = review();
  const state = deriveProgram([event]);
  expect(state.preferences.stage).toBe(2);
  expect(state.preferences.activeChordIds).toEqual(['C-E-G', 'C-F-A']);
  expect(state.preferences.introductionChordId).toBe('C-F-A');
  expect(state.aiReviews).toEqual([event]);
  expect(reviewRecord([event]).assessment).toBe('ai-reviewed');
});

test('holds never change the plan and a later parent override wins', () => {
  expect(deriveProgram([review(false)]).preferences.stage).toBe(1);
  const override = makeEvent(
    'preferences',
    { stage: 1, activeChordIds: ['C-E-G'], introductionChordId: null, aiReviewEnabled: false },
    new Date('2026-09-12T19:00:00Z')
  );
  const state = deriveProgram([override, review()]);
  expect(state.preferences.stage).toBe(1);
  expect(state.preferences.aiReviewEnabled).toBe(false);
  expect(state.aiReviews).toHaveLength(1);
});
