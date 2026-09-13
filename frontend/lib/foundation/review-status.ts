/** Only the AI schedule belongs here; parent-note dates do not schedule AI reviews. */
export function aiReviewSchedule(nextReviewOn: string | null | undefined, today: string) {
  if (!nextReviewOn) return 'The first AI review is two weeks after synced practice begins.';
  if (nextReviewOn <= today) return 'AI review pending. Keep practicing as usual.';
  const date = new Date(`${nextReviewOn}T12:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Next AI review: ${date}.`;
}
