import {Injectable} from "@angular/core";
import {MathUtils} from "../../utils/math";
import {LeftAndRightElement, TrainrunsectionHelper} from "../util/trainrunsection.helper";
import {
  LeftAndRightLockStructure,
  LeftAndRightTimeStructure,
} from "../../view/dialogs/trainrun-and-section-dialog/trainrunsection-tab/trainrun-section-tab.component";
import {TrainrunService} from "./trainrun.service";
import {TrainrunSectionService} from "./trainrunsection.service";
import {FilterService} from "../ui/filter.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";

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

  private offset: number;
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

  public setLockStructure(lockStructure: LeftAndRightLockStructure) {
    this.lockStructure = lockStructure;
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
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    if (!this.lockStructure.rightLock) {
      this.timeStructure.rightArrivalTime =
        this.timeStructure.leftDepartureTime + (this.timeStructure.travelTime % 60);
      this.timeStructure.rightArrivalTime %= 60;
      this.timeStructure.rightDepartureTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isRightNodeSymmetric(),
        this.timeStructure.rightDepartureTime,
        this.timeStructure.rightArrivalTime,
      );
      if (this.isLeftNodeSymmetric()) {
        this.timeStructure.leftArrivalTime = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure.leftDepartureTime,
        );
      } else if (this.isRightNodeSymmetric()) {
        if (this.lockStructure.leftLock && !this.lockStructure.travelTimeLock) {
          this.timeStructure.bottomTravelTime =
            this.timeStructure.leftArrivalTime - this.timeStructure.rightDepartureTime;
          this.timeStructure.bottomTravelTime += this.timeStructure.bottomTravelTime <= 0 ? 60 : 0;
        } else {
          this.timeStructure.leftArrivalTime =
            this.timeStructure.rightDepartureTime + (this.timeStructure.bottomTravelTime % 60);
          this.timeStructure.leftArrivalTime %= 60;
        }
      }
      if (!this.isRightNodeSymmetric()) {
        this.timeStructure.rightDepartureTime =
          this.timeStructure.leftArrivalTime - (this.timeStructure.bottomTravelTime % 60);
        this.timeStructure.rightDepartureTime += this.timeStructure.rightDepartureTime < 0 ? 60 : 0;
      }
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure.rightLock) {
      this.timeStructure.leftArrivalTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isLeftNodeSymmetric(),
        this.timeStructure.leftArrivalTime,
        this.timeStructure.leftDepartureTime,
      );
      this.timeStructure.travelTime =
        this.timeStructure.rightArrivalTime - this.timeStructure.leftDepartureTime;
      this.timeStructure.travelTime += this.timeStructure.travelTime <= 0 ? 60 : 0;
      this.timeStructure.bottomTravelTime =
        this.timeStructure.leftArrivalTime - this.timeStructure.rightDepartureTime;
      this.timeStructure.bottomTravelTime += this.timeStructure.bottomTravelTime <= 0 ? 60 : 0;
    } else {
      this.showWarningTwoLocks = true;
    }

    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
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
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    if (!this.lockStructure.rightLock) {
      this.timeStructure.rightDepartureTime =
        this.timeStructure.leftArrivalTime - (this.timeStructure.bottomTravelTime % 60);
      this.timeStructure.rightDepartureTime += this.timeStructure.rightDepartureTime < 0 ? 60 : 0;
      this.timeStructure.leftDepartureTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isLeftNodeSymmetric(),
        this.timeStructure.leftDepartureTime,
        this.timeStructure.leftArrivalTime,
      );
      if (this.isRightNodeSymmetric()) {
        this.timeStructure.rightArrivalTime = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure.rightDepartureTime,
        );
      } else {
        this.timeStructure.rightArrivalTime =
          this.timeStructure.leftDepartureTime + (this.timeStructure.travelTime % 60);
        this.timeStructure.rightArrivalTime %= 60;
      }
      if (!this.isLeftNodeSymmetric()) {
        if (this.lockStructure.leftLock) {
          this.timeStructure.travelTime =
            this.timeStructure.rightArrivalTime - this.timeStructure.leftDepartureTime;
          this.timeStructure.travelTime += this.timeStructure.travelTime <= 0 ? 60 : 0;
        } else {
          this.timeStructure.leftDepartureTime =
            this.timeStructure.rightArrivalTime - (this.timeStructure.travelTime % 60);
          this.timeStructure.leftDepartureTime += this.timeStructure.leftDepartureTime < 0 ? 60 : 0;
        }
      }
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure.rightLock) {
      this.timeStructure.leftDepartureTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isLeftNodeSymmetric(),
        this.timeStructure.leftDepartureTime,
        this.timeStructure.leftArrivalTime,
      );
      this.timeStructure.bottomTravelTime =
        this.timeStructure.leftArrivalTime - this.timeStructure.rightDepartureTime;
      this.timeStructure.bottomTravelTime += this.timeStructure.bottomTravelTime <= 0 ? 60 : 0;
      this.timeStructure.travelTime =
        this.timeStructure.rightArrivalTime - this.timeStructure.leftDepartureTime;
      this.timeStructure.travelTime += this.timeStructure.travelTime <= 0 ? 60 : 0;
    } else {
      this.showWarningTwoLocks = true;
    }

    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
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
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    if (!this.lockStructure.leftLock) {
      this.timeStructure.leftDepartureTime =
        this.timeStructure.rightArrivalTime - (this.timeStructure.travelTime % 60);
      this.timeStructure.leftDepartureTime += this.timeStructure.leftDepartureTime < 0 ? 60 : 0;
      this.timeStructure.rightDepartureTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isRightNodeSymmetric(),
        this.timeStructure.rightDepartureTime,
        this.timeStructure.rightArrivalTime,
      );
      if (this.isLeftNodeSymmetric()) {
        this.timeStructure.leftArrivalTime = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure.leftDepartureTime,
        );
      } else {
        this.timeStructure.leftArrivalTime =
          this.timeStructure.rightDepartureTime + (this.timeStructure.bottomTravelTime % 60);
        this.timeStructure.leftArrivalTime %= 60;
      }
      if (!this.isRightNodeSymmetric()) {
        if (this.lockStructure.rightLock) {
          this.timeStructure.bottomTravelTime =
            this.timeStructure.leftArrivalTime - this.timeStructure.rightDepartureTime;
          this.timeStructure.bottomTravelTime += this.timeStructure.bottomTravelTime <= 0 ? 60 : 0;
        } else {
          this.timeStructure.rightDepartureTime =
            this.timeStructure.leftArrivalTime - (this.timeStructure.bottomTravelTime % 60);
          this.timeStructure.rightDepartureTime +=
            this.timeStructure.rightDepartureTime < 0 ? 60 : 0;
        }
      }
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure.leftLock) {
      this.timeStructure.rightDepartureTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isRightNodeSymmetric(),
        this.timeStructure.rightDepartureTime,
        this.timeStructure.rightArrivalTime,
      );
      this.timeStructure.travelTime =
        this.timeStructure.rightArrivalTime - this.timeStructure.leftDepartureTime;
      this.timeStructure.travelTime += this.timeStructure.travelTime <= 0 ? 60 : 0;
      this.timeStructure.bottomTravelTime =
        this.timeStructure.leftArrivalTime - this.timeStructure.rightDepartureTime;
      this.timeStructure.bottomTravelTime += this.timeStructure.bottomTravelTime <= 0 ? 60 : 0;
    } else {
      this.showWarningTwoLocks = true;
    }

    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
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
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    if (!this.lockStructure.leftLock) {
      this.timeStructure.leftArrivalTime =
        this.timeStructure.rightDepartureTime + (this.timeStructure.bottomTravelTime % 60);
      this.timeStructure.leftArrivalTime %= 60;
      this.timeStructure.leftDepartureTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isLeftNodeSymmetric(),
        this.timeStructure.leftDepartureTime,
        this.timeStructure.leftArrivalTime,
      );
      if (this.isRightNodeSymmetric()) {
        this.timeStructure.rightArrivalTime = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure.rightDepartureTime,
        );
      } else if (this.isLeftNodeSymmetric()) {
        if (this.lockStructure.rightLock && !this.lockStructure.travelTimeLock) {
          this.timeStructure.travelTime =
            this.timeStructure.rightArrivalTime - this.timeStructure.leftDepartureTime;
          this.timeStructure.travelTime += this.timeStructure.travelTime <= 0 ? 60 : 0;
        } else {
          this.timeStructure.rightArrivalTime =
            this.timeStructure.leftDepartureTime + (this.timeStructure.travelTime % 60);
          this.timeStructure.rightArrivalTime %= 60;
        }
      }
      if (!this.isLeftNodeSymmetric()) {
        this.timeStructure.leftDepartureTime =
          this.timeStructure.rightArrivalTime - (this.timeStructure.travelTime % 60);
        this.timeStructure.leftDepartureTime += this.timeStructure.leftDepartureTime < 0 ? 60 : 0;
      }
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure.leftLock) {
      this.timeStructure.rightArrivalTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isRightNodeSymmetric(),
        this.timeStructure.rightArrivalTime,
        this.timeStructure.rightDepartureTime,
      );
      this.timeStructure.travelTime =
        this.timeStructure.rightArrivalTime - this.timeStructure.leftDepartureTime;
      this.timeStructure.travelTime += this.timeStructure.travelTime <= 0 ? 60 : 0;
      this.timeStructure.bottomTravelTime =
        this.timeStructure.leftArrivalTime - this.timeStructure.rightDepartureTime;
      this.timeStructure.bottomTravelTime += this.timeStructure.bottomTravelTime <= 0 ? 60 : 0;
    } else {
      this.showWarningTwoLocks = true;
    }

    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
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

    if (this.selectedTrainrunSection.isSymmetric()) {
      this.timeStructure.bottomTravelTime = this.timeStructure.travelTime;
    }

    if (!this.lockStructure.rightLock) {
      this.timeStructure.rightArrivalTime =
        this.timeStructure.leftDepartureTime + this.timeStructure.travelTime;
      this.timeStructure.rightArrivalTime += this.timeStructure.rightArrivalTime < 0 ? 60 : 0;
      this.timeStructure.rightArrivalTime %= 60;
      this.timeStructure.rightDepartureTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isRightNodeSymmetric(),
        this.timeStructure.rightDepartureTime,
        this.timeStructure.rightArrivalTime,
      );
      if (!this.selectedTrainrunSection.isSymmetric()) {
        if (this.lockStructure.leftLock) {
          this.timeStructure.bottomTravelTime =
            this.timeStructure.leftArrivalTime - this.timeStructure.rightDepartureTime;
          this.timeStructure.bottomTravelTime += this.timeStructure.bottomTravelTime <= 0 ? 60 : 0;
        } else {
          this.timeStructure.leftArrivalTime =
            this.timeStructure.rightDepartureTime + this.timeStructure.bottomTravelTime;
          this.timeStructure.leftArrivalTime += this.timeStructure.leftArrivalTime < 0 ? 60 : 0;
          this.timeStructure.leftArrivalTime %= 60;
        }
      }
    } else if (!this.lockStructure.leftLock && this.lockStructure.rightLock) {
      this.timeStructure.leftDepartureTime =
        this.timeStructure.rightArrivalTime - this.timeStructure.travelTime;
      this.timeStructure.leftDepartureTime += this.timeStructure.leftDepartureTime < 0 ? 60 : 0;
      this.timeStructure.leftDepartureTime %= 60;
      if (this.isLeftNodeSymmetric()) {
        this.timeStructure.leftArrivalTime = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure.leftDepartureTime,
        );
        this.timeStructure.bottomTravelTime =
          this.timeStructure.leftArrivalTime - this.timeStructure.rightDepartureTime;
        this.timeStructure.bottomTravelTime += this.timeStructure.bottomTravelTime <= 0 ? 60 : 0;
      }
    } else {
      this.showWarningTwoLocks = true;
    }

    this.updateTrainrunSectionTime();
    this.applyOffsetAndTransformTimeStructure();
  }

  /* Bottom Travel Time */
  onBottomTravelTimeButtonPlus() {
    this.timeStructure.bottomTravelTime += this.getTimeButtonPlusMinusStep(
      this.timeStructure.bottomTravelTime,
    );
    this.highlightBottomTravelTimeElement = false;
    this.onBottomTravelTimeChanged();
  }

  onBottomTravelTimeButtonMinus() {
    this.timeStructure.bottomTravelTime -= this.getTimeButtonPlusMinusStep(
      this.timeStructure.bottomTravelTime,
    );
    this.timeStructure.bottomTravelTime = Math.max(1, this.timeStructure.bottomTravelTime);
    this.highlightBottomTravelTimeElement = false;
    this.onBottomTravelTimeChanged();
  }

  onBottomTravelTimeChanged() {
    this.showWarningTwoLocks = false;
    this.roundAllTimes();
    this.removeOffsetAndBackTransformTimeStructure();

    if (!this.lockStructure.leftLock) {
      this.timeStructure.leftArrivalTime =
        this.timeStructure.rightDepartureTime + this.timeStructure.bottomTravelTime;
      this.timeStructure.leftArrivalTime += this.timeStructure.leftArrivalTime < 0 ? 60 : 0;
      this.timeStructure.leftArrivalTime %= 60;
      this.timeStructure.leftDepartureTime = TrainrunsectionHelper.getAdjustedTimeBasedOnSymmetry(
        this.isLeftNodeSymmetric(),
        this.timeStructure.leftDepartureTime,
        this.timeStructure.leftArrivalTime,
      );
      if (!this.selectedTrainrunSection.isSymmetric()) {
        if (this.lockStructure.rightLock) {
          this.timeStructure.travelTime =
            this.timeStructure.rightArrivalTime - this.timeStructure.leftDepartureTime;
          this.timeStructure.travelTime += this.timeStructure.travelTime <= 0 ? 60 : 0;
        } else {
          this.timeStructure.rightArrivalTime =
            this.timeStructure.leftDepartureTime + this.timeStructure.travelTime;
          this.timeStructure.rightArrivalTime += this.timeStructure.rightArrivalTime < 0 ? 60 : 0;
          this.timeStructure.rightArrivalTime %= 60;
        }
      }
    } else if (this.lockStructure.leftLock && !this.lockStructure.rightLock) {
      this.timeStructure.rightDepartureTime =
        this.timeStructure.leftArrivalTime - this.timeStructure.bottomTravelTime;
      this.timeStructure.rightDepartureTime += this.timeStructure.rightDepartureTime < 0 ? 60 : 0;
      this.timeStructure.rightDepartureTime %= 60;
      if (this.isRightNodeSymmetric()) {
        this.timeStructure.rightArrivalTime = TrainrunsectionHelper.getSymmetricTime(
          this.timeStructure.rightDepartureTime,
        );
        this.timeStructure.travelTime =
          this.timeStructure.rightArrivalTime - this.timeStructure.leftDepartureTime;
        this.timeStructure.travelTime += this.timeStructure.travelTime <= 0 ? 60 : 0;
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

    // TODO: not sure if it's important to keep this, but it breaks the asymmetry
    if (this.selectedTrainrunSection.isSymmetric()) {
      this.timeStructure = Object.assign({}, this.originalTimeStructure);
    }

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

  getTrainrunLeftAndRightTimeStructure(): Omit<
    LeftAndRightTimeStructure,
    "travelTime" | "bottomTravelTime"
  > {
    const {firstTrainrunSection, lastTrainrunSection, swapped} =
      this.trainrunService.getFirstAndLastTrainrunSections(
        this.selectedTrainrunSection.getTrainrunId(),
      );
    return {
      leftDepartureTime: swapped
        ? firstTrainrunSection.getTargetDeparture()
        : firstTrainrunSection.getSourceDeparture(),
      leftArrivalTime: swapped
        ? firstTrainrunSection.getTargetArrival()
        : firstTrainrunSection.getSourceArrival(),
      rightDepartureTime: swapped
        ? lastTrainrunSection.getSourceDeparture()
        : lastTrainrunSection.getTargetDeparture(),
      rightArrivalTime: swapped
        ? lastTrainrunSection.getSourceArrival()
        : lastTrainrunSection.getTargetArrival(),
    };
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

  private updateTrainrunSectionTime(
    trainrunSection: TrainrunSection = this.selectedTrainrunSection,
    timeStructure: LeftAndRightTimeStructure = this.timeStructure,
  ) {
    this.trainrunSectionService.setTimeStructureToTrainrunSections(
      this.trainrunSectionHelper.mapLeftAndRightTimes(
        trainrunSection,
        this.nodesOrdered,
        timeStructure,
      ),
      trainrunSection,
      this.filterService.getTimeDisplayPrecision(),
    );
  }

  private isLeftNodeSymmetric(): boolean {
    return TrainrunsectionHelper.isLeftNodeSymmetric(this.selectedTrainrunSection);
  }

  private isRightNodeSymmetric(): boolean {
    return TrainrunsectionHelper.isRightNodeSymmetric(this.selectedTrainrunSection);
  }
}
