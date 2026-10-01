/** Chooses the active business with the fewest coupons assigned in this race. */
export function chooseLeastAssignedBusiness<T extends { id: string; name: string }>(
  businesses: T[],
  assignedCoupons: ReadonlyMap<string, number>,
): T {
  if (!businesses.length) throw new Error("No hay comercios a los que asignar los bonos.");

  return businesses.reduce((chosen, candidate) => {
    const chosenCount = assignedCoupons.get(chosen.id) ?? 0;
    const candidateCount = assignedCoupons.get(candidate.id) ?? 0;
    if (candidateCount < chosenCount) return candidate;
    if (candidateCount > chosenCount) return chosen;
    const alphabetical = candidate.name.localeCompare(chosen.name, "es", { sensitivity: "base" });
    return alphabetical < 0 || (alphabetical === 0 && candidate.id < chosen.id) ? candidate : chosen;
  });
}
