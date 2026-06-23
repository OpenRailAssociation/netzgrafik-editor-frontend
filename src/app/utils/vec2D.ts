import {PointDto} from "../data-structures/technical.data.structures";

export class Vec2D {
  private x: number;
  private y: number;

  constructor(x = 0.0, y = 0.0) {
    this.setData(x, y);
  }

  static equal(a: Vec2D, b: Vec2D): boolean {
    return a.getX() === b.getX() && a.getY() === b.getY();
  }

  static getNorthVec2D(): Vec2D {
    return new Vec2D(0, -1);
  }

  static getEastVec2D(): Vec2D {
    return new Vec2D(1, 0);
  }

  static getSouthVec2D(): Vec2D {
    return new Vec2D(0, 1);
  }

  static getWestVec2D(): Vec2D {
    return new Vec2D(-1, 0);
  }

  static rot90(a: Vec2D, inverse = false): Vec2D {
    if (inverse) {
      return new Vec2D().setData(a.getY(), -a.getX());
    }
    return new Vec2D().setData(-a.getY(), a.getX());
  }

  static add(a: Vec2D, b: Vec2D): Vec2D {
    return new Vec2D().setData(a.getX() + b.getX(), a.getY() + b.getY());
  }

  static sub(a: Vec2D, b: Vec2D): Vec2D {
    return new Vec2D().setData(a.getX() - b.getX(), a.getY() - b.getY());
  }

  static scale(a: Vec2D, s: number): Vec2D {
    return new Vec2D().setData(s * a.getX(), s * a.getY());
  }

  static norm(a: Vec2D): number {
    return Math.sqrt(a.getX() * a.getX() + a.getY() * a.getY());
  }

  static normalize(a: Vec2D): Vec2D {
    let n: number = Vec2D.norm(a);
    if (n === 0) {
      n = 1.0;
    }
    return Vec2D.scale(a, 1.0 / n);
  }

  static dotProduct(a: Vec2D, b: Vec2D): number {
    return a.getX() * b.getX() + a.getY() * b.getY();
  }

  static calculateCentroidOfPoints(points: Vec2D[]): Vec2D {
    let x = 0;
    let y = 0;
    points.forEach((p) => {
      x += p.getX() / points.length;
      y += p.getY() / points.length;
    });
    return new Vec2D(x, y);
  }

  public toString(): string {
    return "(" + this.getX() + "," + this.getY() + ")";
  }

  public setDataFromString(x: string, y: string): Vec2D {
    this.x = parseFloat(x);
    this.y = parseFloat(y);
    return this;
  }

  public setData(x: number, y: number): Vec2D {
    this.x = x;
    this.y = y;
    return this;
  }

  public getX(): number {
    return this.x;
  }

  public getY(): number {
    return this.y;
  }

  public setX(v: number): Vec2D {
    this.x = v;
    return this;
  }

  public setY(v: number): Vec2D {
    this.y = v;
    return this;
  }

  public toPointDto(): PointDto {
    return {x: this.x, y: this.y};
  }

  public copy(): Vec2D {
    return new Vec2D().setData(this.getX(), this.getY());
  }
}
