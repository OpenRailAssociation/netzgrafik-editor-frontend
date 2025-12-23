import {ConnectionDto, WarningDto} from "../data-structures/technical.data.structures";
import {Vec2D} from "../utils/vec2D";

export class Connection {
  private static currentId = 0;

  private id: number;
  private port1Id: number;
  private port2Id: number;

  private path: Vec2D[];
  private warning: WarningDto | null = null;

  private isSelected = false;

  constructor(
    {id, port1Id, port2Id}: ConnectionDto = {
      id: Connection.incrementId(),
      port1Id: 0,
      port2Id: 0,
    },
  ) {
    this.id = id;
    this.port1Id = port1Id;
    this.port2Id = port2Id;
    this.isSelected = false;

    if (Connection.currentId < this.id) {
      Connection.currentId = this.id;
    }
  }

  private static incrementId(): number {
    return ++Connection.currentId;
  }

  getId(): number {
    return this.id;
  }

  setPort1Id(port1Id: number) {
    this.port1Id = port1Id;
  }

  setPort2Id(port2Id: number) {
    this.port2Id = port2Id;
  }

  getPortId1(): number {
    return this.port1Id;
  }

  getPortId2(): number {
    return this.port2Id;
  }

  setPath(path: Vec2D[]) {
    this.path = path;
  }

  getPath(): Vec2D[] {
    return this.path;
  }

  setWarning(warningTitle: string, warningDescription = "") {
    this.warning = {
      title: warningTitle,
      description: warningDescription,
    };
  }

  resetWarning() {
    this.warning = null;
  }

  hasWarning() {
    return this.warning !== null;
  }

  select() {
    this.isSelected = true;
  }

  unselect() {
    this.isSelected = false;
  }

  selected(): boolean {
    return this.isSelected;
  }

  getDto(): ConnectionDto {
    return {
      id: this.id,
      port1Id: this.port1Id,
      port2Id: this.port2Id,
    };
  }
}
