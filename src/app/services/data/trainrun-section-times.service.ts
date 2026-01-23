import {Injectable} from "@angular/core";
import {MathUtils} from "../../utils/math";
import {LeftAndRightElement, TrainrunsectionHelper} from "../util/trainrunsection.helper";
import {DirectedTrainrunSectionProxy} from "../util/trainrun.iterator";
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
  bottomTravelTime: number;
}

export interface LeftAndRightLockStructure {
  leftLock: boolean;
  rightLock: boolean;
  travelTimeLock: boolean;
}

interface LeftAndRightSymmetryStructure {
  leftSymmetry: boolean;
  rightSymmetry: boolean;
}

const leftToRightStructureKeys = {
  tailDepartureTime: "leftDepartureTime",
  tailArrivalTime: "leftArrivalTime",
  tailLock: "leftLock",
  tailSymmetry: "leftSymmetry",
  headDepartureTime: "rightDepartureTime",
  headArrivalTime: "rightArrivalTime",
  headLock: "rightLock",
  headSymmetry: "rightSymmetry",
  travelTime: "travelTime",
  reverseTravelTime: "bottomTravelTime",
} as const;
const rightToLeftStructureKeys = {
  tailDepartureTime: "rightDepartureTime",
  tailArrivalTime: "rightArrivalTime",
  tailLock: "rightLock",
  tailSymmetry: "rightSymmetry",
  headDepartureTime: "leftDepartureTime",
  headArrivalTime: "leftArrivalTime",
  headLock: "leftLock",
  headSymmetry: "leftSymmetry",
  travelTime: "bottomTravelTime",
  reverseTravelTime: "travelTime",
} as const;

type LeftAndRightStructureKeys = typeof leftToRightStructureKeys | typeof rightToLeftStructureKeys;

/**
 * A service responsible for updating times for one or more trainrun sections.
 *
 * This service is used by the trainrun section tab in the trainrun dialog, as well as the
 * perlenkette.
 *
 * The user is presented time fields organized spatially: the node positioned on the left/top in the
 * editor main view is displayed on the left/top. Thus, the left node might be the source or the
 * target. (Same goes for the right/bottom node.)
 *
 * Because the logic for updating times on the left side is exactly the same as the one for updating
 * times on the right side, some functions use abstract tail/head nodes. When updating times on the
 * left side, the tail is the left and the head is the right. When updating times on the right side,
 * the tail is the right and the head is the left.
 *
 * Here is a visualization of all of the fields:
 *
 *                  ┌────────────────┐            ┌─────────────┐            ┌────────────────┐
 *                  │                │            │             │            │                │
 *     ┌───────────●│ Tail departure ├───────────►│ Travel time ├───────────►│  Head arrival  │●───────┐
 *     │            │                │            │             │            │                │        │
 *     │            └────────────────┘            └─────────────┘            └────────────────┘        │
 *     │  Tail                                                                                   Head  │
 *     │symmetry      Tail lock                Travel time lock                 Head lock      symmetry│
 *     │                                                                                               │
 *     │        ┌────────────────┐            ┌─────────────┐            ┌────────────────┐            │
 *     │        │                │            │             │            │                │            │
 *     └───────●│  Tail arrival  │◄───────────┤   Reverse   │◄───────────┤ Head departure │●───────────┘
 *              │                │            │ travel time │            │                │
 *              └────────────────┘            │             │            └────────────────┘
 *                                            └─────────────┘
 *
 * When one field changes, some other fields are recomputed. For instance, when the tail departure
 * time is updated by the user, the travel time or head arrival time are updated depending on locks.
 * Additionally, if symmetry is enabled, the tail arrival time is updated with the tail departure
 * time's symmetric, and the head departure time is updated with the head arrival time's symmetric.
 */
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
    bottomTravelTime: 0,
  };

  private nodesOrdered: Node[] = [];

  private lockStructure: LeftAndRightLockStructure = {
    leftLock: false,
    rightLock: false,
    travelTimeLock: false,
  };
  private showWarningTwoLocks = false;
  private onLockButtonClicked = false;

  private symmetryStructure: LeftAndRightSymmetryStructure = {
    leftSymmetry: true,
    rightSymmetry: true,
  };

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
    this.symmetryStructure = this.trainrunSectionHelper.getLeftAndRightSymmetries(
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

  public getSymmetryStructure(): LeftAndRightSymmetryStructure {
    return this.symmetryStructure;
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

  private enforceNonNegativeTime(keyValue: string) {
    // ensure non-negative time values for "keyValue"
    this.timeStructure[keyValue] = MathUtils.mod60(this.timeStructure[keyValue]);
  }

  private updateTravelTimeMinutes(key: "travelTime" | "bottomTravelTime", minutes: number) {
    const extraHour = this.timeStructure[key] - (this.timeStructure[key] % 60);
    this.timeStructure[key] = MathUtils.mod60(minutes);
    this.timeStructure[key] += extraHour;
  }

  private onNodeTailDepartureTimeChanged(keys: LeftAndRightStructureKeys) {
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    this.enforceNonNegativeTime(keys.tailDepartureTime);

    if (this.symmetryStructure[keys.tailSymmetry]) {
      this.timeStructure[keys.tailArrivalTime] = TrainrunsectionHelper.getSymmetricTime(
        this.timeStructure[keys.tailDepartureTime],
      );
    }
    if (!this.lockStructure[keys.headLock]) {
      this.timeStructure[keys.headArrivalTime] = MathUtils.mod60(
        this.timeStructure[keys.tailDepartureTime] + this.timeStructure[keys.travelTime],
      );
      if (this.symmetryStructure[keys.headSymmetry]) {
        this.timeStructure[keys.headDepartureTime] = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure[keys.headArrivalTime],
        );
        if (!this.symmetryStructure[keys.tailSymmetry]) {
          if (!this.lockStructure[keys.tailLock]) {
            this.timeStructure[keys.tailArrivalTime] = MathUtils.mod60(
              this.timeStructure[keys.headDepartureTime] +
                this.timeStructure[keys.reverseTravelTime],
            );
          } else if (!this.lockStructure.travelTimeLock) {
            this.updateTravelTimeMinutes(
              keys.reverseTravelTime,
              this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.headDepartureTime],
            );
          } else {
            this.showWarningTwoLocks = true;
          }
        }
      } else {
        this.timeStructure[keys.headDepartureTime] = MathUtils.mod60(
          this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.reverseTravelTime],
        );
      }
    } else if (!this.lockStructure.travelTimeLock) {
      this.updateTravelTimeMinutes(
        keys.travelTime,
        this.timeStructure[keys.headArrivalTime] - this.timeStructure[keys.tailDepartureTime],
      );
      this.updateTravelTimeMinutes(
        keys.reverseTravelTime,
        this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.headDepartureTime],
      );
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

    this.enforceNonNegativeTime(keys.tailArrivalTime);

    if (this.symmetryStructure[keys.tailSymmetry]) {
      this.timeStructure[keys.tailDepartureTime] = TrainrunsectionHelper.getSymmetricTime(
        this.timeStructure[keys.tailArrivalTime],
      );
    }
    if (!this.lockStructure[keys.headLock]) {
      this.timeStructure[keys.headDepartureTime] = MathUtils.mod60(
        this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.reverseTravelTime],
      );
      if (this.symmetryStructure[keys.headSymmetry]) {
        this.timeStructure[keys.headArrivalTime] = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure[keys.headDepartureTime],
        );
        if (!this.symmetryStructure[keys.tailSymmetry]) {
          if (!this.lockStructure[keys.tailLock]) {
            this.timeStructure[keys.tailDepartureTime] = MathUtils.mod60(
              this.timeStructure[keys.headArrivalTime] - this.timeStructure[keys.travelTime],
            );
          } else if (!this.lockStructure.travelTimeLock) {
            this.updateTravelTimeMinutes(
              keys.travelTime,
              this.timeStructure[keys.headArrivalTime] - this.timeStructure[keys.tailDepartureTime],
            );
          } else {
            this.showWarningTwoLocks = true;
          }
        }
      } else {
        this.timeStructure[keys.tailDepartureTime] = MathUtils.mod60(
          this.timeStructure[keys.headArrivalTime] - this.timeStructure[keys.travelTime],
        );
      }
    } else if (!this.lockStructure.travelTimeLock) {
      this.updateTravelTimeMinutes(
        keys.travelTime,
        this.timeStructure[keys.headArrivalTime] - this.timeStructure[keys.tailDepartureTime],
      );
      this.updateTravelTimeMinutes(
        keys.reverseTravelTime,
        this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.headDepartureTime],
      );
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
    this.onNodeTailDepartureTimeChanged(rightToLeftStructureKeys);
  }

  /* Travel Time */
  onTravelTimeButtonPlus() {
    this.timeStructure.travelTime += this.getTimeButtonPlusMinusStep(this.timeStructure.travelTime);
    this.highlightTravelTimeElement = false;
    this.onTravelTimeChanged();
  }

  onTravelTimeButtonMinus() {
    this.timeStructure.travelTime -= this.getTimeButtonPlusMinusStep(this.timeStructure.travelTime);
    this.timeStructure.travelTime = Math.max(1, this.timeStructure.travelTime);
    this.highlightTravelTimeElement = false;
    this.onTravelTimeChanged();
  }

  onTravelTimeChanged() {
    this.onDirectTravelTimeChanged(leftToRightStructureKeys);
  }

  private onDirectTravelTimeChanged(keys: LeftAndRightStructureKeys) {
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    if (this.symmetryStructure.leftSymmetry && this.symmetryStructure.rightSymmetry) {
      this.timeStructure[keys.reverseTravelTime] = this.timeStructure[keys.travelTime];
    }

    if (!this.lockStructure[keys.headLock]) {
      this.timeStructure[keys.headArrivalTime] = MathUtils.mod60(
        this.timeStructure[keys.tailDepartureTime] + this.timeStructure[keys.travelTime],
      );
      if (this.symmetryStructure[keys.headSymmetry]) {
        this.timeStructure[keys.headDepartureTime] = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure[keys.headArrivalTime],
        );
      }
      if (!this.symmetryStructure.leftSymmetry || !this.symmetryStructure.rightSymmetry) {
        if (!this.lockStructure[keys.tailLock]) {
          this.timeStructure[keys.tailArrivalTime] = MathUtils.mod60(
            this.timeStructure[keys.headDepartureTime] + this.timeStructure[keys.reverseTravelTime],
          );
        } else if (!this.lockStructure.travelTimeLock) {
          this.updateTravelTimeMinutes(
            keys.reverseTravelTime,
            this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.headDepartureTime],
          );
        } else {
          this.showWarningTwoLocks = true;
        }
      }
    } else if (!this.lockStructure[keys.tailLock]) {
      this.timeStructure[keys.tailDepartureTime] = MathUtils.mod60(
        this.timeStructure[keys.headArrivalTime] - this.timeStructure[keys.travelTime],
      );
      if (this.symmetryStructure[keys.tailSymmetry]) {
        this.timeStructure[keys.tailArrivalTime] = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure[keys.tailDepartureTime],
        );
        this.updateTravelTimeMinutes(
          keys.reverseTravelTime,
          this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.headDepartureTime],
        );
      }
    } else {
      this.showWarningTwoLocks = true;
    }

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
    this.timeStructure.bottomTravelTime = MathUtils.round(
      this.timeStructure.bottomTravelTime,
      timeDisplayPrecision,
    );
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
    this.timeStructure.bottomTravelTime =
      Math.round(this.timeStructure.bottomTravelTime * timeDisplayPrecision) / timeDisplayPrecision;
  }

  private updateTrainrunSectionTime() {
    if (this.nodesOrdered.length > 0) {
      const direction =
        this.nodesOrdered[0].getId() === this.selectedTrainrunSection.getSourceNode().getId()
          ? "sourceToTarget"
          : "targetToSource";
      this.trainrunSectionService.setTimeStructureToSingleTrainrunSection(
        new DirectedTrainrunSectionProxy(this.selectedTrainrunSection, direction),
        this.timeStructure,
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
