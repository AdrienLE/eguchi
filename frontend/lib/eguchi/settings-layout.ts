export const SETTINGS_CONTENT_MAX_WIDTH = 760;
export const SETTINGS_HORIZONTAL_PADDING = 40;
export const LEVEL_CARD_HORIZONTAL_PADDING = 28;
export const ANIMAL_GRID_GAP = 8;

export type SettingsAnimalGridLayout = {
  contentWidth: number;
  gridInnerWidth: number;
  columns: number;
  cardWidth: number;
};

export const getSettingsAnimalGridColumns = (gridInnerWidth: number) => {
  if (gridInnerWidth >= 560) {
    return 5;
  }
  if (gridInnerWidth >= 460) {
    return 4;
  }
  if (gridInnerWidth >= 360) {
    return 3;
  }
  return 2;
};

export const getSettingsAnimalGridLayout = (windowWidth: number): SettingsAnimalGridLayout => {
  const contentWidth = Math.min(
    SETTINGS_CONTENT_MAX_WIDTH,
    Math.max(320, windowWidth - SETTINGS_HORIZONTAL_PADDING)
  );
  const gridInnerWidth = contentWidth - LEVEL_CARD_HORIZONTAL_PADDING;
  const columns = getSettingsAnimalGridColumns(gridInnerWidth);
  const cardWidth = Math.floor((gridInnerWidth - ANIMAL_GRID_GAP * columns) / columns);

  return {
    contentWidth,
    gridInnerWidth,
    columns,
    cardWidth,
  };
};
