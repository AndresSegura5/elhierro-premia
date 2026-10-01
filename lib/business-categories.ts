export const businessCategories = [
  "Alimentación y producto local",
  "Material deportivo",
  "Restaurante",
  "Salud",
  "Artesanía y regalos",
] as const;

export function isBusinessCategory(value: string): value is (typeof businessCategories)[number] {
  return businessCategories.includes(value as (typeof businessCategories)[number]);
}
