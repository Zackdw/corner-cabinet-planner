export function parseMeasurement(text: string): number | null {
  const trimmed = text.trim();
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    const number = Number(trimmed);
    return Number.isFinite(number) ? number : null;
  }

  const match = trimmed.match(/^(\d+\s+)?(\d+)\/(\d+)$/);
  if (!match || Number(match[3]) === 0) return null;
  const result = Number(match[1] ?? 0) + Number(match[2]) / Number(match[3]);
  return Number.isFinite(result) ? result : null;
}

export function scrubMeasurement(start: number, pixels: number, min: number, max: number) {
  if (![start, pixels, min, max].every(Number.isFinite) || min > max)
    throw new Error('Scrubbing needs a finite measurement and valid bounds.');
  const minSteps = Math.ceil(min - start - 1e-8), maxSteps = Math.floor(max - start + 1e-8);
  if (minSteps > 0 || maxSteps < 0) throw new Error('Correct this measurement before dragging it.');
  // Browser pointer coordinates can round a whole-pixel movement slightly short.
  const requested = Math.trunc((pixels + Math.sign(pixels) * 0.001) / 12);
  const steps = Math.max(minSteps, Math.min(maxSteps, requested));
  return { value: Number((start + steps).toFixed(9)), limited: steps !== requested };
}
