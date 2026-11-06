const MINUTES_PER_HOUR = 60;

export function isMinimumConnectionTimeSatisfied(
  baselineWait: number,
  arrivalShift: number,
  departureShift: number,
  minimumConnectionTime: number,
): boolean {
  const difference = departureShift - arrivalShift;
  const relativeShift =
    ((((difference + MINUTES_PER_HOUR / 2) % MINUTES_PER_HOUR) + MINUTES_PER_HOUR) %
      MINUTES_PER_HOUR) -
    MINUTES_PER_HOUR / 2;
  return baselineWait + relativeShift >= minimumConnectionTime - 1e-6;
}
