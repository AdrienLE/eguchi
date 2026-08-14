import {
  DEFAULT_PLAYROOM_BACKGROUND_ID,
  PLAYROOM_BACKGROUNDS,
  getPlayroomBackground,
  normalizePlayroomBackgroundId,
} from '@/lib/eguchi/playroom-backgrounds';

describe('playroom backgrounds', () => {
  test('offers six unique, softly colored choices with pink first', () => {
    expect(PLAYROOM_BACKGROUNDS.length).toBe(6);
    expect(PLAYROOM_BACKGROUNDS[0]).toEqual({
      id: 'pink',
      label: 'Pink',
      color: '#FFD6E7',
    });
    expect(new Set(PLAYROOM_BACKGROUNDS.map(background => background.id)).size).toBe(6);
    for (const background of PLAYROOM_BACKGROUNDS) {
      expect(background.color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  test('normalizes missing or invalid stored choices to pink', () => {
    expect(DEFAULT_PLAYROOM_BACKGROUND_ID).toBe('pink');
    expect(normalizePlayroomBackgroundId(undefined)).toBe('pink');
    expect(normalizePlayroomBackgroundId('hot-pink')).toBe('pink');
    expect(normalizePlayroomBackgroundId('mint')).toBe('mint');
  });

  test('resolves palette metadata by id', () => {
    expect(getPlayroomBackground('sky')).toEqual({
      id: 'sky',
      label: 'Sky',
      color: '#E7F5FF',
    });
  });
});
