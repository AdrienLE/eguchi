/** Fit every active friend into the available iPad practice area. */
export const animalGridLayout = (count: number, width: number, height: number) => {
  let best = { columns: 1, size: 44 };
  for (let columns = 1; columns <= Math.min(count, 7); columns++) {
    const rows = Math.ceil(count / columns);
    const size = Math.floor(
      Math.min(
        280,
        (width - (columns - 1) * 10) / columns - 20,
        (height - (rows - 1) * 10) / rows - 54
      )
    );
    if (size > best.size) best = { columns, size };
  }
  return best;
};
