import {TransitionDto} from "../data-structures/technical.data.structures";
import {Vec2D} from "../utils/vec2D";
import {Trainrun} from "./trainrun.model";

export class Transition {
  private static currentId = 0;

  private id: number;
  private port1Id: number;
  private port2Id: number;
  private isNonStopTransit: boolean;

  private trainrun: Trainrun;
  private path: Vec2D[];

  constructor(
    {id, port1Id, port2Id, isNonStopTransit}: TransitionDto = {
      id: Transition.incrementId(),
      port1Id: 0,
      port2Id: 0,
      isNonStopTransit: false,
    },
  ) {
    this.id = id;
    this.port1Id = port1Id;
    this.port2Id = port2Id;
    this.isNonStopTransit = isNonStopTransit;

    if (Transition.currentId < this.id) {
      Transition.currentId = this.id;
    }
  }

  private static incrementId(): number {
    return ++Transition.currentId;
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

  setIsNonStopTransit(isNonStopTransit: boolean) {
    this.isNonStopTransit = isNonStopTransit;
  }

  toggleIsNonStopTransit() {
    this.isNonStopTransit = !this.getIsNonStopTransit();
  }

  getIsNonStopTransit(): boolean {
    return this.isNonStopTransit;
  }

  getPortId1(): number {
    return this.port1Id;
  }

  getPortId2(): number {
    return this.port2Id;
  }

  getOppositePort(portId: number): number {
    return portId === this.port1Id ? this.port2Id : this.port1Id;
  }

  getTrainrun(): Trainrun {
    return this.trainrun;
  }

  setTrainrun(trainrun: Trainrun) {
    this.trainrun = trainrun;
  }

  setPath(path: Vec2D[]) {
    this.path = path;
  }

  getPath(): Vec2D[] {
    return this.path;
  }

  getDto(): TransitionDto {
    return {
      id: this.id,
      port1Id: this.port1Id,
      port2Id: this.port2Id,
      isNonStopTransit: this.isNonStopTransit,
    };
  }
}
