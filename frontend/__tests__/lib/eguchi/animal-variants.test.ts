import {
  ANIMAL_ACCESSORY_VARIANTS,
  createDefaultEguchiAnimalVariantAssignments,
  loadEguchiAnimalVariantAssignments,
  resetEguchiAnimalVariantAssignments,
  saveEguchiAnimalVariantAssignments,
  shuffleEguchiAnimalVariantAssignments,
  type EguchiAnimalVariantAssignments,
} from '@/lib/eguchi/animal-variants';
import { ORDERED_CHORD_IDS } from '@/lib/eguchi/chords';
import { STORAGE_KEYS, type StorageService } from '@/lib/storage';

type StorageStub = StorageService & {
  setCalls: Array<[string, unknown]>;
};

const makeStorageStub = (storedValue: unknown = null): StorageStub => {
  const setCalls: Array<[string, unknown]> = [];
  return {
    setCalls,
    get: async () => storedValue as any,
    set: async (key, value) => {
      setCalls.push([key, value]);
    },
    remove: async () => undefined,
    clear: async () => undefined,
    getAllKeys: async () => [],
  };
};

describe('eguchi animal variants', () => {
  test('default assignments use plain animals for every chord', () => {
    const defaults = createDefaultEguchiAnimalVariantAssignments();
    expect(Object.keys(defaults).sort()).toEqual([...ORDERED_CHORD_IDS].sort());
    for (const chordId of ORDERED_CHORD_IDS) {
      expect(defaults[chordId]).toBe('default');
    }
  });

  test('load sanitizes invalid stored values', async () => {
    const storage = makeStorageStub({
      'C-E-G': 'top-hat',
      'F-A-C': 'missing-variant',
    });

    const loaded = await loadEguchiAnimalVariantAssignments(storage);
    expect(loaded['C-E-G']).toBe('top-hat');
    expect(loaded['F-A-C']).toBe('default');
  });

  test('shuffle assigns accessory variants and can avoid keeping the same one', () => {
    const current = createDefaultEguchiAnimalVariantAssignments();
    const randomValues = [0, 0.3, 0.6, 0.9];
    let index = 0;
    const next = shuffleEguchiAnimalVariantAssignments(current, () => {
      const value = randomValues[index % randomValues.length];
      index += 1;
      return value;
    });

    const accessoryIds = ANIMAL_ACCESSORY_VARIANTS.filter(
      variant => variant.id !== 'default'
    ).map(variant => variant.id);
    for (const chordId of ORDERED_CHORD_IDS) {
      expect(accessoryIds).toContain(next[chordId]);
    }
  });

  test('reset returns plain animals', () => {
    const current = createDefaultEguchiAnimalVariantAssignments();
    const shuffled = {
      ...current,
      'C-E-G': 'top-hat',
    } satisfies EguchiAnimalVariantAssignments;

    expect(resetEguchiAnimalVariantAssignments()).toEqual(current);
    expect(shuffled['C-E-G']).toBe('top-hat');
  });

  test('save writes to expected storage key', async () => {
    const storage = makeStorageStub();
    const assignments = createDefaultEguchiAnimalVariantAssignments();

    await saveEguchiAnimalVariantAssignments(assignments, storage);
    expect(storage.setCalls).toEqual([
      [STORAGE_KEYS.EGUCHI_ANIMAL_VARIANT_ASSIGNMENTS, assignments],
    ]);
  });
});
