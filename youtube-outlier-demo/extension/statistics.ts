export interface BucketDefinition<K extends string = string> {
  key: K;
  min: number;
  max: number;
}

function finiteValues(values: readonly (number | null | undefined)[]): number[] {
  return values.filter((value): value is number => Number.isFinite(value));
}

export function mean(values: readonly (number | null | undefined)[]): number | null {
  const valid = finiteValues(values);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

export function median(values: readonly (number | null | undefined)[]): number | null {
  const valid = finiteValues(values).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  const current = valid[middle];
  if (current === undefined) return null;
  if (valid.length % 2) return current;
  const previous = valid[middle - 1];
  return previous === undefined ? null : (previous + current) / 2;
}

export function standardDeviation(values: readonly (number | null | undefined)[]): number | null {
  const valid = finiteValues(values);
  const average = mean(valid);
  if (!valid.length || average === null) return null;
  return Math.sqrt(valid.reduce((sum, value) => sum + (value - average) ** 2, 0) / valid.length);
}

export function linearRegressionSlope(values: readonly (number | null | undefined)[]): number | null {
  const valid = values.map((value, index) => ({ x: index, y: value }))
    .filter((point): point is { x: number; y: number } => Number.isFinite(point.y));
  if (valid.length < 2) return null;
  const meanX = mean(valid.map((point) => point.x));
  const meanY = mean(valid.map((point) => point.y));
  if (meanX === null || meanY === null) return null;
  const denominator = valid.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (!denominator) return null;
  return valid.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator;
}

export function safeDivide(numerator: number | null | undefined, denominator: number | null | undefined): number | null {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? (numerator as number) / (denominator as number)
    : null;
}

export function percentageDifference(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null) return null;
  const ratio = safeDivide(value - baseline, Math.abs(baseline));
  return ratio === null ? null : ratio * 100;
}

export function rollingMedian(values: readonly (number | null | undefined)[], previousOnly = false): (number | null)[] {
  const result: (number | null)[] = [];
  const seen: number[] = [];
  for (const value of values) {
    result.push(median(previousOnly ? seen : [...seen, value]));
    if (Number.isFinite(value)) seen.push(value as number);
  }
  return result;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function bucket<K extends string>(value: number | null, definitions: readonly BucketDefinition<K>[]): K | null {
  if (!Number.isFinite(value)) return null;
  return definitions.find((definition) => (value as number) >= definition.min && (value as number) < definition.max)?.key ?? null;
}

export function compactNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits }).format(value as number);
}

export function fullNumber(value: number | null | undefined): string {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(Math.round(value as number)) : "Unavailable";
}

export function formatDuration(seconds: number | null): string {
  if (!Number.isFinite(seconds) || (seconds as number) < 0) return "Unavailable";
  const total = Math.round(seconds as number);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function formatAge(hours: number | null): string {
  if (!Number.isFinite(hours) || (hours as number) < 0) return "Unavailable";
  if ((hours as number) < 24) return `${Math.max(1, Math.floor(hours as number))}h`;
  const days = Math.floor((hours as number) / 24);
  return days < 365 ? `${days}d` : `${(days / 365.25).toFixed(1)}y`;
}

export const stats = { mean, median, standardDeviation, linearRegressionSlope, safeDivide, percentageDifference, rollingMedian, clamp, bucket, compactNumber, fullNumber, formatDuration, formatAge };
