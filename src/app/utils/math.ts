export class MathUtils {
  static roundAndForceValueGreaterEqualOne(value: number) {
    return Math.max(1, MathUtils.round(value, 1));
  }

  static round(value: number, precision: number): number {
    const multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
  }

  /** Computes the positive modulo 60 of a given number */
  static mod60(value: number): number {
    return ((value % 60) + 60) % 60;
  }

  /** Computes the positive modulo of a given number with respect to a divisor */
  static modulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
  }

  /** Checks if the given value is a finite number */
  static isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }

  /** Checks if the given value is a positive finite number */
  static isPositiveNumber(value: unknown): value is number {
    return this.isFiniteNumber(value) && value > 0;
  }
}
