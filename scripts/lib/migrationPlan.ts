export function migrationPlan(
  ids: string[],
  current: string | null,
  target: string | null,
  forwardOnly = false,
): { direction: "up" | "down"; ids: string[] } {
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate migration IDs");
  const currentIndex = current === null ? -1 : ids.indexOf(current);
  if (current !== null && currentIndex === -1) {
    throw new Error(`Unknown database schema version: ${current}`);
  }
  const targetIndex = target === null ? ids.length - 1 : ids.indexOf(target);
  if (target !== null && targetIndex === -1) {
    throw new Error(`Migration not found: ${target}`);
  }
  if (targetIndex < currentIndex) {
    if (forwardOnly) throw new Error("Deploy migrations cannot roll back the database");
    return { direction: "down", ids: ids.slice(targetIndex + 1, currentIndex + 1).reverse() };
  }
  return { direction: "up", ids: ids.slice(currentIndex + 1, targetIndex + 1) };
}
