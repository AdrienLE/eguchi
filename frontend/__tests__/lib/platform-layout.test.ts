import {
  WEB_APP_MAX_WIDTH,
  getRootContentFrameStyle,
  getSettingsPresentation,
} from '@/lib/platform-layout';

describe('platform layout helpers', () => {
  test('keeps the web shell constrained', () => {
    expect(getRootContentFrameStyle('web')).toEqual({
      flex: 1,
      width: '100%',
      maxWidth: WEB_APP_MAX_WIDTH,
    });
  });

  test('lets native iPad use the full simulator width', () => {
    expect(getRootContentFrameStyle('ios')).toEqual({
      flex: 1,
      width: '100%',
    });
  });

  test('uses full-screen settings on iOS so long settings content can scroll', () => {
    expect(getSettingsPresentation('ios')).toBe('fullScreenModal');
    expect(getSettingsPresentation('web')).toBe('modal');
  });
});
