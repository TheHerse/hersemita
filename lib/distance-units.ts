export type DistanceUnit = "miles" | "kilometers";

export function normalizeDistanceUnit(value: unknown): DistanceUnit {
  return value === "kilometers" ? "kilometers" : "miles";
}

export function distanceUnitLabel(unit: DistanceUnit) {
  return unit === "kilometers" ? "km" : "mi";
}

export function distanceToMiles(value: number, unit: DistanceUnit) {
  return unit === "kilometers" ? value / 1.609344 : value;
}

export function milesToDistance(value: number, unit: DistanceUnit) {
  return unit === "kilometers" ? value * 1.609344 : value;
}

export function paceToMiles(value: number, unit: DistanceUnit) {
  return unit === "kilometers" ? value * 1.609344 : value;
}

export function paceFromMiles(value: number, unit: DistanceUnit) {
  return unit === "kilometers" ? value / 1.609344 : value;
}
