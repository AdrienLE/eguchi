import { storage, STORAGE_KEYS, type StorageService } from '@/lib/storage';
import { ORDERED_CHORD_IDS, type EguchiChordId } from './chords';

export const ANIMAL_ACCESSORY_VARIANTS = [
  { id: 'default', label: 'Plain' },
  { id: 'top-hat', label: 'Top Hat' },
  { id: 'party-hat', label: 'Party Hat' },
  { id: 'wizard-hat', label: 'Wizard Hat' },
  { id: 'baseball-cap', label: 'Baseball Cap' },
  { id: 'rain-hat', label: 'Rain Hat' },
  { id: 'crown', label: 'Crown' },
  { id: 'bow-tie', label: 'Bow Tie' },
  { id: 'flower-crown', label: 'Flower Crown' },
  { id: 'butterfly-bow', label: 'Butterfly Bow' },
  { id: 'round-glasses', label: 'Round Glasses' },
  { id: 'heart-glasses', label: 'Heart Glasses' },
  { id: 'star-glasses', label: 'Star Glasses' },
  { id: 'aviators', label: 'Aviators' },
  { id: 'monocle', label: 'Monocle' },
  { id: 'sleep-mask', label: 'Sleep Mask' },
  { id: 'necktie', label: 'Necktie' },
  { id: 'scarf', label: 'Scarf' },
  { id: 'medal', label: 'Medal' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'headphones', label: 'Headphones' },
] as const;

export type AnimalAccessoryVariantId = (typeof ANIMAL_ACCESSORY_VARIANTS)[number]['id'];
export type EguchiAnimalVariantAssignments = Record<EguchiChordId, AnimalAccessoryVariantId>;

const DEFAULT_ANIMAL_ACCESSORY_VARIANT: AnimalAccessoryVariantId = 'default';
const ACCESSORY_VARIANT_IDS = ANIMAL_ACCESSORY_VARIANTS.filter(
  variant => variant.id !== DEFAULT_ANIMAL_ACCESSORY_VARIANT
).map(variant => variant.id);

const isAnimalAccessoryVariantId = (
  candidate: unknown
): candidate is AnimalAccessoryVariantId =>
  ANIMAL_ACCESSORY_VARIANTS.some(variant => variant.id === candidate);

export const createDefaultEguchiAnimalVariantAssignments =
  (): EguchiAnimalVariantAssignments =>
    Object.fromEntries(
      ORDERED_CHORD_IDS.map(chordId => [chordId, DEFAULT_ANIMAL_ACCESSORY_VARIANT])
    ) as EguchiAnimalVariantAssignments;

export const loadEguchiAnimalVariantAssignments = async (
  storageService: StorageService = storage
): Promise<EguchiAnimalVariantAssignments> => {
  const stored = await storageService.get<Partial<Record<EguchiChordId, unknown>>>(
    STORAGE_KEYS.EGUCHI_ANIMAL_VARIANT_ASSIGNMENTS
  );
  if (!stored) {
    return createDefaultEguchiAnimalVariantAssignments();
  }

  const defaults = createDefaultEguchiAnimalVariantAssignments();
  for (const chordId of ORDERED_CHORD_IDS) {
    const storedValue = stored[chordId];
    defaults[chordId] = isAnimalAccessoryVariantId(storedValue)
      ? storedValue
      : DEFAULT_ANIMAL_ACCESSORY_VARIANT;
  }
  return defaults;
};

export const saveEguchiAnimalVariantAssignments = async (
  assignments: EguchiAnimalVariantAssignments,
  storageService: StorageService = storage
) => {
  await storageService.set(STORAGE_KEYS.EGUCHI_ANIMAL_VARIANT_ASSIGNMENTS, assignments);
};

const pickRandomVariant = (
  candidates: ReadonlyArray<AnimalAccessoryVariantId>,
  current: AnimalAccessoryVariantId,
  random: () => number
): AnimalAccessoryVariantId => {
  if (!candidates.length) {
    return DEFAULT_ANIMAL_ACCESSORY_VARIANT;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  let next = current;
  while (next === current) {
    next = candidates[Math.floor(random() * candidates.length)];
  }
  return next;
};

export const shuffleEguchiAnimalVariantAssignments = (
  previous: EguchiAnimalVariantAssignments,
  random: () => number = Math.random
): EguchiAnimalVariantAssignments =>
  Object.fromEntries(
    ORDERED_CHORD_IDS.map(chordId => [
      chordId,
      pickRandomVariant(ACCESSORY_VARIANT_IDS, previous[chordId], random),
    ])
  ) as EguchiAnimalVariantAssignments;

export const resetEguchiAnimalVariantAssignments =
  (): EguchiAnimalVariantAssignments => createDefaultEguchiAnimalVariantAssignments();
