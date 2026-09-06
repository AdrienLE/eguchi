import { test, expect } from '@jest/globals';
import {
  CHORD_CURRICULUM,
  curriculumThrough,
  planPresentations,
} from '@/lib/foundation/curriculum';
import { animalGridLayout } from '@/lib/foundation/grid';
import { useColorScheme } from '@/hooks/useColorScheme';
test('the full official sequence has stable colors and English pitches', () => {
  expect(CHORD_CURRICULUM.map(c => [c.id, c.color])).toEqual([
    ['C-E-G', 'Red'],
    ['C-F-A', 'Yellow'],
    ['B-D-G', 'Blue'],
    ['A-C-F', 'Black'],
    ['D-G-B', 'Green'],
    ['E-G-C', 'Orange'],
    ['F-A-C', 'Purple'],
    ['G-B-D', 'Pink'],
    ['G-C-E', 'Brown'],
    ['A-C#-E', 'Light green'],
    ['D-F#-A', 'Peach'],
    ['E-G#-B', 'Lavender'],
    ['Bb-D-F', 'Gray'],
    ['Eb-G-Bb', 'Light blue'],
  ]);
  expect(CHORD_CURRICULUM[12].notes).toEqual(['B♭3', 'D4', 'F4']);
});
test('parents can use all fourteen, while introducing a second color sparingly', () => {
  expect(
    planPresentations(curriculumThrough(2), 'C-F-A', () => 0.4).filter(c => c === 'C-F-A')
  ).toHaveLength(2);
  const all = planPresentations(curriculumThrough(14), null, () => 0.4);
  expect(all).toHaveLength(30);
  expect(new Set(all).size).toBe(14);
  const introducing = planPresentations(curriculumThrough(14), 'Eb-G-Bb', () => 0.4);
  expect(introducing.filter(c => c === 'Eb-G-Bb')).toHaveLength(3);
  expect(new Set(introducing).size).toBe(14);
});
test.each([
  [980, 900],
  [900, 650],
  [730, 650],
])('fourteen cards fit the measured iPad grid %i by %i', (width, height) => {
  const grid = animalGridLayout(14, width, height);
  const rows = Math.ceil(14 / grid.columns);
  expect(grid.size).toBeGreaterThanOrEqual(90);
  expect(grid.columns * (grid.size + 20) + (grid.columns - 1) * 10).toBeLessThanOrEqual(width);
  expect(rows * (grid.size + 54) + (rows - 1) * 10).toBeLessThanOrEqual(height);
});
test('the app has a fixed light palette', () => {
  expect(useColorScheme()).toBe('light');
});
