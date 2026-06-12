/**
 * A tiny character-grid painter so maps are built correct-by-construction
 * (no hand-counted ASCII rows). Coordinates are (col, row), 0-based.
 */
export class Painter {
  private readonly grid: string[][];

  constructor(
    readonly width: number,
    readonly height: number,
    fillChar = ".",
  ) {
    this.grid = Array.from({ length: height }, () => Array.from({ length: width }, () => fillChar));
  }

  set(x: number, y: number, ch: string): this {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      throw new Error(`paint out of bounds: (${x},${y}) on ${this.width}x${this.height}`);
    }
    this.grid[y]![x] = ch;
    return this;
  }

  /** Fill a solid rectangle, inclusive of both corners. */
  fillRect(x1: number, y1: number, x2: number, y2: number, ch: string): this {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, ch);
    return this;
  }

  /** Draw only the 1-tile-thick border of a rectangle. */
  outlineRect(x1: number, y1: number, x2: number, y2: number, ch: string): this {
    for (let x = x1; x <= x2; x++) {
      this.set(x, y1, ch);
      this.set(x, y2, ch);
    }
    for (let y = y1; y <= y2; y++) {
      this.set(x1, y, ch);
      this.set(x2, y, ch);
    }
    return this;
  }

  hline(x1: number, x2: number, y: number, ch: string): this {
    return this.fillRect(Math.min(x1, x2), y, Math.max(x1, x2), y, ch);
  }

  vline(x: number, y1: number, y2: number, ch: string): this {
    return this.fillRect(x, Math.min(y1, y2), x, Math.max(y1, y2), ch);
  }

  /**
   * A simple wall-ring building with a wooden floor and a door gap.
   * `door` is the absolute x (for "s" side bottom/top) of the 2-wide gap.
   */
  building(x1: number, y1: number, x2: number, y2: number, doorX: number): this {
    this.fillRect(x1, y1, x2, y2, "=");
    this.outlineRect(x1, y1, x2, y2, "#");
    this.set(doorX, y2, "=");
    this.set(doorX + 1, y2, "=");
    return this;
  }

  rows(): string[] {
    return this.grid.map((r) => r.join(""));
  }
}
