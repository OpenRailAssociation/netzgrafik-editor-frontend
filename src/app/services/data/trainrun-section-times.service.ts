import {Injectable} from "@angular/core";
import {MathUtils} from "../../utils/math";
import {LeftAndRightElement, TrainrunsectionHelper} from "../util/trainrunsection.helper";
import {TrainrunService} from "./trainrun.service";
import {TrainrunSectionService} from "./trainrunsection.service";
import {FilterService} from "../ui/filter.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";

export interface LeftAndRightTimeStructure {
  leftDepartureTime: number;
  leftArrivalTime: number;
  rightDepartureTime: number;
  rightArrivalTime: number;
  travelTime: number;
}

export interface LeftAndRightLockStructure {
  leftLock: boolean;
  rightLock: boolean;
  travelTimeLock: boolean;
}

const leftToRightStructureKeys = {
  tailDepartureTime: "leftDepartureTime",
  tailArrivalTime: "leftArrivalTime",
  tailLock: "leftLock",
  headDepartureTime: "rightDepartureTime",
  headArrivalTime: "rightArrivalTime",
  headLock: "rightLock",
} as const;
const rightToLeftStructureKeys = {
  tailDepartureTime: "rightDepartureTime",
  tailArrivalTime: "rightArrivalTime",
  tailLock: "rightLock",
  headDepartureTime: "leftDepartureTime",
  headArrivalTime: "leftArrivalTime",
  headLock: "leftLock",
} as const;

type LeftAndRightStructureKeys = typeof leftToRightStructureKeys | typeof rightToLeftStructureKeys;

@Injectable({
  providedIn: "root",
})
export class TrainrunSectionTimesService {
  private trainrunSectionHelper: TrainrunsectionHelper;
  private selectedTrainrunSection: TrainrunSection;

  private timeStructure: LeftAndRightTimeStructure;
  private originalTimeStructure: LeftAndRightTimeStructure = {
    leftDepartureTime: 0,
    leftArrivalTime: 0,
    rightDepartureTime: 0,
    rightArrivalTime: 0,
    travelTime: 0,
  };

  private nodesOrdered: Node[] = [];

  private lockStructure: LeftAndRightLockStructure = {
    leftLock: false,
    rightLock: false,
    travelTimeLock: false,
  };
  private showWarningTwoLocks = false;
  private onLockButtonClicked = false;

  private offset = 0;
  private offsetTransformationActive = false;

  private highlightTravelTimeElement: boolean;

  private initialLeftAndRightElement: LeftAndRightElement = LeftAndRightElement.LeftArrival;

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private filterService: FilterService,
    private loadPerlenketteService: LoadPerlenketteService,
  ) {
    this.trainrunSectionHelper = new TrainrunsectionHelper(this.trainrunService);
  }

  public setTrainrunSection(trainrunSection: TrainrunSection) {
    this.selectedTrainrunSection = trainrunSection;
    this.originalTimeStructure = this.trainrunSectionHelper.getLeftAndRightTimes(
      this.selectedTrainrunSection,
      this.nodesOrdered,
    );
    this.timeStructure = Object.assign({}, this.originalTimeStructure);
    this.lockStructure = this.trainrunSectionHelper.getLeftAndRightLock(
      this.selectedTrainrunSection,
      this.nodesOrdered,
    );
  }

  public getTimeStructure(): LeftAndRightTimeStructure {
    return this.timeStructure;
  }

  public getOffsetTransformationActive(): boolean {
    return this.offsetTransformationActive;
  }

  public getShowWarningTwoLocks(): boolean {
    return this.showWarningTwoLocks;
  }

  public getNodesOrdered(): Node[] {
    return this.nodesOrdered;
  }

  public setNodesOrdered(nodesOrdered: Node[]) {
    this.nodesOrdered = nodesOrdered;
  }

  public getLockStructure(): LeftAndRightLockStructure {
    return this.lockStructure;
  }

  public getOffset(): number {
    return this.offset;
  }

  public setOffset(offset: number) {
    this.offset = offset;
  }

  public getHighlightTravelTimeElement() {
    return this.highlightTravelTimeElement;
  }

  public setHighlightTravelTimeElement(highlightTravelTimeElement: boolean) {
    this.highlightTravelTimeElement = highlightTravelTimeElement;
  }

  public setInitialLeftAndRightElement(initialLeftAndRightElement: LeftAndRightElement) {
    this.initialLeftAndRightElement = initialLeftAndRightElement;
  }

  private getTimeButtonPlusMinusStep(val: number) {
    return 1 - val + Math.floor(val);
  }

  private onNodeTailDepartureTimeChanged(keys: LeftAndRightStructureKeys) {
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    this.timeStructure[keys.tailArrivalTime] = TrainrunsectionHelper.getSymmetricTime(
      this.timeStructure[keys.tailDepartureTime],
    );
    if (!this.lockStructure[keys.headLock]) {
      this.timeStructure[keys.headArrivalTime] = MathUtils.mod60(
        this.timeStructure[keys.tailDepartureTime] + (this.timeStructure.travelTime % 60),
      );
      this.timeStructure[keys.headDepartureTime] = TrainrunsectionHelper.getSymmetricTime(
        this.timeStructure[keys.headArrivalTime],
      );
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure[keys.headLock]) {
      const extraHour = this.timeStructure.travelTime - (this.timeStructure.travelTime % 60);
      this.timeStructure.travelTime = MathUtils.mod60(
        this.timeStructure[keys.headArrivalTime] - this.timeStructure[keys.tailDepartureTime],
      );
      this.timeStructure.travelTime += extraHour;
    } else {
      this.showWarningTwoLocks = true;
    }

    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
  }

  private onNodeTailArrivalTimeChanged(keys: LeftAndRightStructureKeys) {
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    this.timeStructure[keys.tailDepartureTime] = TrainrunsectionHelper.getSymmetricTime(
      this.timeStructure[keys.tailArrivalTime],
    );
    if (!this.lockStructure[keys.headLock]) {
      this.timeStructure[keys.headDepartureTime] = MathUtils.mod60(
        this.timeStructure[keys.tailArrivalTime] - (this.timeStructure.travelTime % 60),
      );
      this.timeStructure[keys.headArrivalTime] = TrainrunsectionHelper.getSymmetricTime(
        this.timeStructure[keys.headDepartureTime],
      );
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure[keys.headLock]) {
      const extraHour = this.timeStructure.travelTime - (this.timeStructure.travelTime % 60);
      this.timeStructure.travelTime = MathUtils.mod60(
        this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.headDepartureTime],
      );
      this.timeStructure.travelTime += extraHour;
    } else {
      this.showWarningTwoLocks = true;
    }

    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
  }

  /* Left Departure Time */
  onNodeLeftDepartureTimeButtonPlus() {
    this.timeStructure.leftDepartureTime += this.getTimeButtonPlusMinusStep(
      this.timeStructure.leftDepartureTime,
    );
    this.timeStructure.leftDepartureTime %= 60;
    this.onNodeLeftDepartureTimeChanged();
  }

  onNodeLeftDepartureTimeButtonMinus() {
    this.timeStructure.leftDepartureTime -= this.getTimeButtonPlusMinusStep(
      this.timeStructure.leftDepartureTime,
    );
    this.timeStructure.leftDepartureTime += this.timeStructure.leftDepartureTime < 0 ? 60 : 0;
    this.onNodeLeftDepartureTimeChanged();
  }

  onNodeLeftDepartureTimeChanged() {
    // Clamp to valid range [0..59]
    this.timeStructure.leftDepartureTime = Math.max(0, Math.min(59, this.timeStructure.leftDepartureTime));
    this.onNodeTailDepartureTimeChanged(leftToRightStructureKeys);
  }

  /* Left Arrival Time */
  onNodeLeftArrivalTimeButtonPlus() {
    this.timeStructure.leftArrivalTime += this.getTimeButtonPlusMinusStep(
      this.timeStructure.leftArrivalTime,
    );
    this.timeStructure.leftArrivalTime %= 60;
    this.onNodeLeftArrivalTimeChanged();
  }

  onNodeLeftArrivalTimeButtonMinus() {
    this.timeStructure.leftArrivalTime -= this.getTimeButtonPlusMinusStep(
      this.timeStructure.leftArrivalTime,
    );
    this.timeStructure.leftArrivalTime += this.timeStructure.leftArrivalTime < 0 ? 60 : 0;
    this.onNodeLeftArrivalTimeChanged();
  }

  onNodeLeftArrivalTimeChanged() {
    // Clamp to valid range [0..59]
    this.timeStructure.leftArrivalTime = Math.max(0, Math.min(59, this.timeStructure.leftArrivalTime));
    this.onNodeTailArrivalTimeChanged(leftToRightStructureKeys);
  }

  /* Right Arrival Time */
  onNodeRightArrivalTimeButtonPlus() {
    this.timeStructure.rightArrivalTime += this.getTimeButtonPlusMinusStep(
      this.timeStructure.rightArrivalTime,
    );
    this.timeStructure.rightArrivalTime %= 60;
    this.onNodeRightArrivalTimeChanged();
  }

  onNodeRightArrivalTimeButtonMinus() {
    this.timeStructure.rightArrivalTime -= this.getTimeButtonPlusMinusStep(
      this.timeStructure.rightArrivalTime,
    );
    this.timeStructure.rightArrivalTime += this.timeStructure.rightArrivalTime < 0 ? 60 : 0;
    this.onNodeRightArrivalTimeChanged();
  }

  onNodeRightArrivalTimeChanged() {
    // Clamp to valid range [0..59]
    this.timeStructure.rightArrivalTime = Math.max(0, Math.min(59, this.timeStructure.rightArrivalTime));
    this.onNodeTailArrivalTimeChanged(rightToLeftStructureKeys);
  }

  /* Right Departure Time */
  onNodeRightDepartureTimeButtonPlus() {
    this.timeStructure.rightDepartureTime += this.getTimeButtonPlusMinusStep(
      this.timeStructure.rightDepartureTime,
    );
    this.timeStructure.rightDepartureTime %= 60;
    this.onNodeRightDepartureTimeChanged();
  }

  onNodeRightDepartureTimeButtonMinus() {
    this.timeStructure.rightDepartureTime -= this.getTimeButtonPlusMinusStep(
      this.timeStructure.rightDepartureTime,
    );
    this.timeStructure.rightDepartureTime += this.timeStructure.rightDepartureTime < 0 ? 60 : 0;
    this.onNodeRightDepartureTimeChanged();
  }

  onNodeRightDepartureTimeChanged() {
    // Clamp to valid range [0..59]
    this.timeStructure.rightDepartureTime = Math.max(0, Math.min(59, this.timeStructure.rightDepartureTime));
    this.onNodeTailDepartureTimeChanged(rightToLeftStructureKeys);
  }

  /* Travel Time */
  onInputTravelTimeElementButtonPlus() {
    this.timeStructure.travelTime += this.getTimeButtonPlusMinusStep(this.timeStructure.travelTime);
    this.highlightTravelTimeElement = false;
    this.onInputTravelTimeChanged();
  }

  onInputTravelTimeElementButtonMinus() {
    this.timeStructure.travelTime -= this.getTimeButtonPlusMinusStep(this.timeStructure.travelTime);
    this.timeStructure.travelTime = Math.max(1, this.timeStructure.travelTime);
    this.highlightTravelTimeElement = false;
    this.onInputTravelTimeChanged();
  }

  updateTravelTimeChanged() {
    this.showWarningTwoLocks = false;
    this.roundAllTimes();

    if (!this.lockStructure.rightLock) {
      this.timeStructure.rightArrivalTime = MathUtils.mod60(
        this.timeStructure.leftDepartureTime + this.timeStructure.travelTime,
      );
      this.timeStructure.rightDepartureTime = TrainrunsectionHelper.getSymmetricTime(
        this.timeStructure.rightArrivalTime,
      );
    } else if (!this.lockStructure.leftLock) {
      this.timeStructure.leftArrivalTime = MathUtils.mod60(
        this.timeStructure.rightDepartureTime + this.timeStructure.travelTime,
      );
      this.timeStructure.leftDepartureTime = TrainrunsectionHelper.getSymmetricTime(
        this.timeStructure.leftArrivalTime,
      );
    } else {
      this.showWarningTwoLocks = true;
    }
  }

  onInputTravelTimeChanged() {
    // Ensure travel time is always greater than 0
    this.timeStructure.travelTime = Math.max(0.0001, this.timeStructure.travelTime);
    this.removeOffsetAndBackTransformTimeStructure();
    this.updateTravelTimeChanged();
    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
  }

  /* Lock */
  onButtonTravelTimeLock() {
    this.lockStructure.travelTimeLock = !this.lockStructure.travelTimeLock;
    this.setHighlightTravelTimeElement(false);
    this.onLockButtonClicked = true;
    this.updateTrainrunSectionTimeLock();
  }

  onButtonNodeLeftLock() {
    this.lockStructure.leftLock = !this.lockStructure.leftLock;
    this.onLockButtonClicked = true;
    this.updateTrainrunSectionTimeLock();
  }

  onButtonNodeRightLock() {
    this.lockStructure.rightLock = !this.lockStructure.rightLock;
    this.onLockButtonClicked = true;
    this.updateTrainrunSectionTimeLock();
  }

  updateTrainrunSectionTimeLock() {
    if (this.nodesOrdered.length > 0) {
      const leftIsSource =
        this.nodesOrdered[0].getId() === this.selectedTrainrunSection.getSourceNode().getId();
      this.trainrunSectionService.updateTrainrunSectionTimeLock(
        this.selectedTrainrunSection.getId(),
        leftIsSource ? this.lockStructure.leftLock : this.lockStructure.rightLock,
        leftIsSource ? this.lockStructure.rightLock : this.lockStructure.leftLock,
        this.lockStructure.travelTimeLock,
        true,
      );
      return;
    }

    const leftRight = this.trainrunSectionHelper.getLeftRightSections(this.selectedTrainrunSection);

    this.trainrunSectionService.updateTrainrunSectionTimeLock(
      leftRight.leftSection.getId(),
      this.trainrunSectionHelper.getSourceLock(this.lockStructure, leftRight.leftSection),
      this.trainrunSectionHelper.getTargetLock(this.lockStructure, leftRight.leftSection),
      this.lockStructure.travelTimeLock,
      true,
    );

    this.trainrunSectionService.updateTrainrunSectionTimeLock(
      leftRight.rightSection.getId(),
      this.trainrunSectionHelper.getSourceLock(this.lockStructure, leftRight.rightSection),
      this.trainrunSectionHelper.getTargetLock(this.lockStructure, leftRight.rightSection),
      undefined,
      true,
    );
  }

  /* Buttons in Footer */
  onPropagateTimeLeft(trainrunSection: TrainrunSection) {
    const nextStopRightNodeId = this.trainrunSectionHelper
      .getNextStopRightNode(trainrunSection, this.nodesOrdered)
      .getId();
    this.trainrunSectionService.propagateTimeAlongTrainrun(
      trainrunSection.getId(),
      nextStopRightNodeId,
    );
    this.loadPerlenketteService.render();
  }

  onPropagateTimeRight(trainrunSection: TrainrunSection) {
    const nextStopLeftNodeId = this.trainrunSectionHelper
      .getNextStopLeftNode(trainrunSection, this.nodesOrdered)
      .getId();
    this.trainrunSectionService.propagateTimeAlongTrainrun(
      trainrunSection.getId(),
      nextStopLeftNodeId,
    );
    this.loadPerlenketteService.render();
  }

  applyOffsetAndTransformTimeStructure() {
    this.originalTimeStructure = this.trainrunSectionHelper.getLeftAndRightTimes(
      this.selectedTrainrunSection,
      this.nodesOrdered,
    );
    this.timeStructure = Object.assign({}, this.originalTimeStructure);

    const maxMinutes = 7 * 24 * 60;
    if (
      this.initialLeftAndRightElement === LeftAndRightElement.LeftDeparture ||
      this.initialLeftAndRightElement === LeftAndRightElement.RightArrival ||
      this.initialLeftAndRightElement === LeftAndRightElement.LeftRightTrainrunName
    ) {
      this.timeStructure.leftDepartureTime =
        (this.timeStructure.leftDepartureTime + this.offset) % 60;
      this.timeStructure.rightArrivalTime =
        (this.timeStructure.rightArrivalTime + this.offset) % 60;
      this.timeStructure.leftArrivalTime =
        (maxMinutes + this.timeStructure.leftArrivalTime - this.offset) % 60;
      this.timeStructure.rightDepartureTime =
        (maxMinutes + this.timeStructure.rightDepartureTime - this.offset) % 60;
    } else {
      this.timeStructure.leftDepartureTime =
        (maxMinutes + this.timeStructure.leftDepartureTime - this.offset) % 60;
      this.timeStructure.rightArrivalTime =
        (maxMinutes + this.timeStructure.rightArrivalTime - this.offset) % 60;
      this.timeStructure.leftArrivalTime = (this.timeStructure.leftArrivalTime + this.offset) % 60;
      this.timeStructure.rightDepartureTime =
        (this.timeStructure.rightDepartureTime + this.offset) % 60;
    }
    this.offsetTransformationActive = true;
    this.fixAllTimesPrecision();
  }

  removeOffsetAndBackTransformTimeStructure() {
    const maxMinutes = 7 * 24 * 60;
    if (
      this.initialLeftAndRightElement === LeftAndRightElement.LeftDeparture ||
      this.initialLeftAndRightElement === LeftAndRightElement.RightArrival ||
      this.initialLeftAndRightElement === LeftAndRightElement.LeftRightTrainrunName
    ) {
      this.timeStructure.leftDepartureTime =
        (maxMinutes + this.timeStructure.leftDepartureTime - this.offset) % 60;
      this.timeStructure.rightArrivalTime =
        (maxMinutes + this.timeStructure.rightArrivalTime - this.offset) % 60;
      this.timeStructure.leftArrivalTime = (this.timeStructure.leftArrivalTime + this.offset) % 60;
      this.timeStructure.rightDepartureTime =
        (this.timeStructure.rightDepartureTime + this.offset) % 60;
    } else {
      this.timeStructure.leftDepartureTime =
        (this.timeStructure.leftDepartureTime + this.offset) % 60;
      this.timeStructure.rightArrivalTime =
        (this.timeStructure.rightArrivalTime + this.offset) % 60;
      this.timeStructure.leftArrivalTime =
        (maxMinutes + this.timeStructure.leftArrivalTime - this.offset) % 60;
      this.timeStructure.rightDepartureTime =
        (maxMinutes + this.timeStructure.rightDepartureTime - this.offset) % 60;
    }
    this.originalTimeStructure = this.trainrunSectionHelper.getLeftAndRightTimes(
      this.selectedTrainrunSection,
      this.nodesOrdered,
    );
    this.offsetTransformationActive = false;
  }

  private roundAllTimes() {
    const timeDisplayPrecision = this.filterService.getTimeDisplayPrecision();
    this.timeStructure.leftArrivalTime = MathUtils.round(
      this.timeStructure.leftArrivalTime,
      timeDisplayPrecision,
    );
    this.timeStructure.leftDepartureTime = MathUtils.round(
      this.timeStructure.leftDepartureTime,
      timeDisplayPrecision,
    );
    this.timeStructure.rightArrivalTime = MathUtils.round(
      this.timeStructure.rightArrivalTime,
      timeDisplayPrecision,
    );
    this.timeStructure.rightDepartureTime = MathUtils.round(
      this.timeStructure.rightDepartureTime,
      timeDisplayPrecision,
    );
    this.timeStructure.travelTime = MathUtils.round(
      this.timeStructure.travelTime,
      timeDisplayPrecision,
    );
    
    // Validate and clamp departure/arrival times to [0..59] range
    this.timeStructure.leftArrivalTime = Math.max(0, Math.min(59, this.timeStructure.leftArrivalTime));
    this.timeStructure.leftDepartureTime = Math.max(0, Math.min(59, this.timeStructure.leftDepartureTime));
    this.timeStructure.rightArrivalTime = Math.max(0, Math.min(59, this.timeStructure.rightArrivalTime));
    this.timeStructure.rightDepartureTime = Math.max(0, Math.min(59, this.timeStructure.rightDepartureTime));
    
    // Ensure travel time is always greater than 0
    this.timeStructure.travelTime = Math.max(0.0001, this.timeStructure.travelTime);
  }

  private fixAllTimesPrecision() {
    const timeDisplayPrecision = 1000;
    this.timeStructure.leftArrivalTime =
      Math.round(this.timeStructure.leftArrivalTime * timeDisplayPrecision) / timeDisplayPrecision;
    this.timeStructure.leftDepartureTime =
      Math.round(this.timeStructure.leftDepartureTime * timeDisplayPrecision) /
      timeDisplayPrecision;
    this.timeStructure.rightArrivalTime =
      Math.round(this.timeStructure.rightArrivalTime * timeDisplayPrecision) / timeDisplayPrecision;
    this.timeStructure.rightDepartureTime =
      Math.round(this.timeStructure.rightDepartureTime * timeDisplayPrecision) /
      timeDisplayPrecision;
    this.timeStructure.travelTime =
      Math.round(this.timeStructure.travelTime * timeDisplayPrecision) / timeDisplayPrecision;
  }

  private updateTrainrunSectionTime() {
    if (this.nodesOrdered.length > 0) {
      const leftIsSource =
        this.nodesOrdered[0].getId() === this.selectedTrainrunSection.getSourceNode().getId();
      this.trainrunSectionService.updateTrainrunSectionTime(
        this.selectedTrainrunSection.getId(),
        leftIsSource ? this.timeStructure.leftArrivalTime : this.timeStructure.rightArrivalTime,
        leftIsSource ? this.timeStructure.leftDepartureTime : this.timeStructure.rightDepartureTime,
        leftIsSource ? this.timeStructure.rightArrivalTime : this.timeStructure.leftArrivalTime,
        leftIsSource ? this.timeStructure.rightDepartureTime : this.timeStructure.leftDepartureTime,
        this.timeStructure.travelTime,
      );
      this.trainrunSectionService.trainrunSectionsUpdated();
      return;
    }

    this.trainrunSectionService.setTimeStructureToTrainrunSections(
      this.trainrunSectionHelper.mapLeftAndRightTimes(
        this.selectedTrainrunSection,
        this.nodesOrdered,
        this.timeStructure,
      ),
      this.selectedTrainrunSection,
      this.filterService.getTimeDisplayPrecision(),
    );
  }
}
