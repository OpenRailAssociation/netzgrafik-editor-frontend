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
import {SymmetryOn, SymmetryReference} from "../util/symmetry-toggle.service";

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
  private highlightBottomTravelTimeElement: boolean;

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

  public getHighlightBottomTravelTimeElement() {
    return this.highlightBottomTravelTimeElement;
  }

  public setHighlightBottomTravelTimeElement(highlightBottomTravelTimeElement: boolean) {
    this.highlightBottomTravelTimeElement = highlightBottomTravelTimeElement;
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

    if (!this.lockStructure[keys.headLock]) {
      this.timeStructure[keys.headArrivalTime] = MathUtils.mod60(
        this.timeStructure[keys.tailDepartureTime] + (this.timeStructure[keys.travelTime] % 60),
      );
      if (this.symmetryStructure[keys.headSymmetry]) {
        this.timeStructure[keys.headDepartureTime] = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure[keys.headArrivalTime],
        );
      }
      if (this.symmetryStructure[keys.tailSymmetry]) {
        this.timeStructure[keys.tailArrivalTime] = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure[keys.tailDepartureTime],
        );
      } else if (this.symmetryStructure[keys.headSymmetry]) {
        if (this.lockStructure[keys.tailLock] && !this.lockStructure.travelTimeLock) {
          this.timeStructure[keys.reverseTravelTime] = MathUtils.mod60(
            this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.headDepartureTime],
          );
        } else {
          this.timeStructure[keys.tailArrivalTime] = MathUtils.mod60(
            this.timeStructure[keys.headDepartureTime] + this.timeStructure[keys.reverseTravelTime],
          );
        }
      }
      if (!this.symmetryStructure[keys.headSymmetry]) {
        this.timeStructure[keys.headDepartureTime] = MathUtils.mod60(
          this.timeStructure[keys.tailArrivalTime] - this.timeStructure[keys.reverseTravelTime],
        );
      }
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure[keys.headLock]) {
      if (this.symmetryStructure[keys.tailSymmetry]) {
        this.timeStructure[keys.tailArrivalTime] = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure[keys.tailDepartureTime],
        );
      }
      this.timeStructure[keys.travelTime] = MathUtils.mod60(
        this.timeStructure[keys.headArrivalTime] - this.timeStructure[keys.tailDepartureTime],
      );
      this.timeStructure[keys.reverseTravelTime] = MathUtils.mod60(
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
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

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

    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
  }

  onBottomTravelTimeButtonPlus() {}
  onBottomTravelTimeButtonMinus() {}
  onBottomTravelTimeChanged() {}

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

  /* Symmetry */
  onLeftNodeSymmetryChanged(
    isLeftNodeSymmetric: boolean,
    isPositionSwapped: boolean,
    reference: SymmetryReference = null,
  ) {
    if (isPositionSwapped) {
      this.trainrunSectionService.updateTargetSymmetry(
        this.selectedTrainrunSection.getId(),
        isLeftNodeSymmetric,
      );
    } else {
      this.trainrunSectionService.updateSourceSymmetry(
        this.selectedTrainrunSection.getId(),
        isLeftNodeSymmetric,
      );
    }

    if (reference === null) return;

    this.removeOffsetAndBackTransformTimeStructure();
    this.timeStructure = this.calculateTimeStructureAfterSymmetrySelection(
      SymmetryOn.LeftNode,
      reference,
    );
    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
  }

  onRightNodeSymmetryChanged(
    isRightNodeSymmetric: boolean,
    isPositionSwapped: boolean,
    reference: SymmetryReference = null,
  ) {
    if (isPositionSwapped) {
      this.trainrunSectionService.updateSourceSymmetry(
        this.selectedTrainrunSection.getId(),
        isRightNodeSymmetric,
      );
    } else {
      this.trainrunSectionService.updateTargetSymmetry(
        this.selectedTrainrunSection.getId(),
        isRightNodeSymmetric,
      );
    }

    if (reference === null) return;

    this.removeOffsetAndBackTransformTimeStructure();
    this.timeStructure = this.calculateTimeStructureAfterSymmetrySelection(
      SymmetryOn.RightNode,
      reference,
    );
    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
  }

  onTrainrunSymmetryChanged(trainrunId: number, reference: SymmetryReference = null) {
    this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(trainrunId).forEach((section) => {
      if (!reference) {
        // on/off case
        section.resetSymmetry();
      } else {
        this.removeOffsetAndBackTransformTimeStructure();
        section.resetSymmetry();
        this.trainrunSectionService.setTimeStructureToSingleTrainrunSection(
          new DirectedTrainrunSectionProxy(section, "sourceToTarget"),
          this.calculateTimeStructureAfterSymmetrySelectionForTrainrunSection(reference, section),
        );
        this.applyOffsetAndTransformTimeStructure();
      }
    });
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

  calculateTimeStructureAfterSymmetrySelection(
    symmetryOn: SymmetryOn,
    reference: SymmetryReference,
  ): LeftAndRightTimeStructure {
    const timeStructure = Object.assign({}, this.timeStructure);
    switch (symmetryOn) {
      case SymmetryOn.LeftNode: {
        if (reference === SymmetryReference.Top) {
          timeStructure.leftArrivalTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.leftDepartureTime,
          );
        } else {
          timeStructure.leftDepartureTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.leftArrivalTime,
          );
        }
        if (this.isRightNodeSymmetric()) {
          if (reference === SymmetryReference.Top) {
            timeStructure.bottomTravelTime = timeStructure.travelTime;
          } else {
            timeStructure.travelTime = timeStructure.bottomTravelTime;
          }
          timeStructure.rightArrivalTime =
            timeStructure.leftDepartureTime + timeStructure.travelTime;
          timeStructure.rightArrivalTime %= 60;
          timeStructure.rightDepartureTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.rightArrivalTime,
          );
        } else {
          if (!this.lockStructure.rightLock) {
            timeStructure.rightDepartureTime =
              timeStructure.leftArrivalTime - timeStructure.bottomTravelTime;
            timeStructure.rightDepartureTime += timeStructure.rightDepartureTime < 0 ? 60 : 0;
            timeStructure.rightDepartureTime %= 60;
            timeStructure.rightArrivalTime =
              timeStructure.leftDepartureTime + timeStructure.travelTime;
            timeStructure.rightArrivalTime %= 60;
          } else if (!this.lockStructure.travelTimeLock) {
            timeStructure.travelTime =
              timeStructure.rightArrivalTime - timeStructure.leftDepartureTime;
            timeStructure.travelTime += timeStructure.travelTime <= 0 ? 60 : 0;
            timeStructure.bottomTravelTime =
              timeStructure.leftArrivalTime - timeStructure.rightDepartureTime;
            timeStructure.bottomTravelTime += timeStructure.bottomTravelTime <= 0 ? 60 : 0;
          }
        }
        return timeStructure;
      }

      case SymmetryOn.RightNode: {
        if (reference === SymmetryReference.Top) {
          timeStructure.rightDepartureTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.rightArrivalTime,
          );
        } else {
          timeStructure.rightArrivalTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.rightDepartureTime,
          );
        }
        if (this.isLeftNodeSymmetric()) {
          if (reference === SymmetryReference.Top) {
            timeStructure.bottomTravelTime = timeStructure.travelTime;
          } else {
            timeStructure.travelTime = timeStructure.bottomTravelTime;
          }
          timeStructure.leftArrivalTime =
            timeStructure.rightDepartureTime + timeStructure.bottomTravelTime;
          timeStructure.leftArrivalTime %= 60;
          timeStructure.leftDepartureTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.leftArrivalTime,
          );
        } else {
          if (!this.lockStructure.leftLock) {
            timeStructure.leftDepartureTime =
              timeStructure.rightArrivalTime - timeStructure.travelTime;
            timeStructure.leftDepartureTime += timeStructure.leftDepartureTime < 0 ? 60 : 0;
            timeStructure.leftDepartureTime %= 60;
            timeStructure.leftArrivalTime =
              timeStructure.rightDepartureTime + timeStructure.bottomTravelTime;
            timeStructure.leftArrivalTime %= 60;
          } else if (!this.lockStructure.travelTimeLock) {
            timeStructure.travelTime =
              timeStructure.rightArrivalTime - timeStructure.leftDepartureTime;
            timeStructure.travelTime += timeStructure.travelTime <= 0 ? 60 : 0;
            timeStructure.bottomTravelTime =
              timeStructure.leftArrivalTime - timeStructure.rightDepartureTime;
            timeStructure.bottomTravelTime += timeStructure.bottomTravelTime <= 0 ? 60 : 0;
          }
        }
        return timeStructure;
      }

      case SymmetryOn.Trainrun: {
        // TODO faire pareil que trainrunSection
        const {firstTrainrunSection, lastTrainrunSection, swapped} =
          this.trainrunService.getFirstAndLastTrainrunSections(
            this.selectedTrainrunSection.getTrainrunId(),
          );

        timeStructure.leftArrivalTime = swapped
          ? firstTrainrunSection.getTargetArrival()
          : firstTrainrunSection.getSourceArrival();
        timeStructure.leftDepartureTime = swapped
          ? firstTrainrunSection.getTargetDeparture()
          : firstTrainrunSection.getSourceDeparture();
        timeStructure.rightArrivalTime = swapped
          ? lastTrainrunSection.getSourceArrival()
          : lastTrainrunSection.getTargetArrival();
        timeStructure.rightDepartureTime = swapped
          ? lastTrainrunSection.getSourceDeparture()
          : lastTrainrunSection.getTargetDeparture();

        if (reference === SymmetryReference.Top) {
          timeStructure.leftArrivalTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.leftDepartureTime,
          );
          timeStructure.rightDepartureTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.rightArrivalTime,
          );
        } else {
          timeStructure.leftDepartureTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.leftArrivalTime,
          );
          timeStructure.rightArrivalTime = TrainrunsectionHelper.getSymmetricTime(
            timeStructure.rightDepartureTime,
          );
        }

        timeStructure.travelTime = null; // not used in this context
        timeStructure.bottomTravelTime = null; // not used in this context
        return timeStructure;
      }

      default:
        return timeStructure;
    }
  }

  calculateTimeStructureAfterSymmetrySelectionForTrainrunSection(
    reference: SymmetryReference,
    trainrunSection: TrainrunSection,
  ): LeftAndRightTimeStructure {
    if (reference === SymmetryReference.Top) {
      return {
        leftDepartureTime: trainrunSection.getSourceDeparture(),
        travelTime: trainrunSection.getTravelTime(),
        rightArrivalTime: trainrunSection.getTargetArrival(),
        rightDepartureTime: TrainrunsectionHelper.getSymmetricTime(
          trainrunSection.getTargetArrival(),
        ),
        bottomTravelTime: trainrunSection.getTravelTime(),
        leftArrivalTime: TrainrunsectionHelper.getSymmetricTime(
          trainrunSection.getSourceDeparture(),
        ),
      };
    } else {
      return {
        leftDepartureTime: TrainrunsectionHelper.getSymmetricTime(
          trainrunSection.getSourceArrival(),
        ),
        travelTime: trainrunSection.getBackwardTravelTime(),
        rightArrivalTime: TrainrunsectionHelper.getSymmetricTime(
          trainrunSection.getTargetDeparture(),
        ),
        rightDepartureTime: trainrunSection.getTargetDeparture(),
        bottomTravelTime: trainrunSection.getBackwardTravelTime(),
        leftArrivalTime: trainrunSection.getSourceArrival(),
      };
    }
  }

  areLeftAndRightTimeStructuresEqual(symmetryOn: SymmetryOn) {
    const top = this.calculateTimeStructureAfterSymmetrySelection(
      symmetryOn,
      SymmetryReference.Top,
    );
    const bottom = this.calculateTimeStructureAfterSymmetrySelection(
      symmetryOn,
      SymmetryReference.Bottom,
    );
    return (
      top.leftDepartureTime === bottom.leftDepartureTime &&
      top.leftArrivalTime === bottom.leftArrivalTime &&
      top.rightDepartureTime === bottom.rightDepartureTime &&
      top.rightArrivalTime === bottom.rightArrivalTime &&
      top.travelTime === bottom.travelTime &&
      top.bottomTravelTime === bottom.bottomTravelTime
    );
  }

  areAllTimeStructuresEqual(trainrunId: number): boolean {
    return this.trainrunSectionService
      .getAllTrainrunSectionsForTrainrun(trainrunId)
      .every((section) => {
        const top = this.calculateTimeStructureAfterSymmetrySelectionForTrainrunSection(
          SymmetryReference.Top,
          section,
        );
        const bottom = this.calculateTimeStructureAfterSymmetrySelectionForTrainrunSection(
          SymmetryReference.Bottom,
          section,
        );
        return (
          top.leftDepartureTime === bottom.leftDepartureTime &&
          top.leftArrivalTime === bottom.leftArrivalTime &&
          top.rightDepartureTime === bottom.rightDepartureTime &&
          top.rightArrivalTime === bottom.rightArrivalTime &&
          top.travelTime === bottom.travelTime &&
          top.bottomTravelTime === bottom.bottomTravelTime
        );
      });
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

  private isLeftNodeSymmetric(): boolean {
    if (TrainrunsectionHelper.isTargetRightOrBottom(this.selectedTrainrunSection)) {
      return this.selectedTrainrunSection.getSourceSymmetry();
    } else {
      return this.selectedTrainrunSection.getTargetSymmetry();
    }
  }

  private isRightNodeSymmetric(): boolean {
    if (TrainrunsectionHelper.isTargetRightOrBottom(this.selectedTrainrunSection)) {
      return this.selectedTrainrunSection.getTargetSymmetry();
    } else {
      return this.selectedTrainrunSection.getSourceSymmetry();
    }
  }
}
