import { getSettingsAnimalGridLayout } from '@/lib/eguchi/settings-layout';

describe('settings layout helpers', () => {
  test('fits five compact animal cards on iPad portrait and landscape widths', () => {
    const simulatorEffectiveWidth = getSettingsAnimalGridLayout(744);
    expect(simulatorEffectiveWidth.columns).toBe(5);
    expect(simulatorEffectiveWidth.cardWidth).toBe(127);

    const portrait = getSettingsAnimalGridLayout(768);
    expect(portrait.columns).toBe(5);
    expect(portrait.cardWidth).toBe(132);

    const landscape = getSettingsAnimalGridLayout(1024);
    expect(landscape.columns).toBe(5);
    expect(landscape.cardWidth).toBe(138);
  });

  test('keeps narrower devices to fewer animal grid columns', () => {
    expect(getSettingsAnimalGridLayout(600).columns).toBe(4);
    expect(getSettingsAnimalGridLayout(520).columns).toBe(3);
    expect(getSettingsAnimalGridLayout(390).columns).toBe(2);
  });
});
