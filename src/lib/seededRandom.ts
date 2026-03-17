/**
 * SeededRandom - Deterministic random number generator
 * Used for consistent mock/demo data generation across the app
 */

export class SeededRandom {
  private seed: number;

  constructor(seed: number | string) {
    this.seed = typeof seed === 'string' ? this.hashString(seed) : seed;
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  between(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Alias for between() - used by some modules
  range(min: number, max: number): number {
    return this.between(min, max);
  }

  intBetween(min: number, max: number): number {
    return Math.floor(this.between(min, max + 1));
  }

  // Alias for intBetween() - used by some modules
  intRange(min: number, max: number): number {
    return this.intBetween(min, max);
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weightedPick<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = this.next() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  boolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }
}

/**
 * Hash a string to a number (for creating seeds from identifiers)
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}
