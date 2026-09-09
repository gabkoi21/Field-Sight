export type Coordinates = { latitude: number; longitude: number };

export function parseKoboCoordinates(value: string | null | undefined): Coordinates | null {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).slice(0, 2).map(Number);
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return null;
  const [latitude, longitude] = parts;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function formatLocation(value: string | null | undefined): string {
  if (!value) return "Not captured";
  const point = parseKoboCoordinates(value);
  if (!point) return value;
  const latitude = `${Math.abs(point.latitude).toFixed(2)}° ${point.latitude >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(point.longitude).toFixed(2)}° ${point.longitude >= 0 ? "E" : "W"}`;
  return `(${latitude}, ${longitude})`;
}
