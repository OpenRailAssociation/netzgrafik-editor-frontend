import {LinePatternRefs, TrainrunSectionDto} from "../data-structures/business.data.structures";
import {Node} from "./node.model";
import {Trainrun} from "./trainrun.model";
import {Vec2D} from "../utils/vec2D";
import {SimpleTrainrunSectionRouter} from "../services/util/trainrunsection.routing";
import {
  ColorRefType,
  PathDto,
  TimeLockDto,
  TrainrunSectionText,
  WarningDto,
} from "../data-structures/technical.data.structures";
import {TrainrunSectionValidator} from "../services/util/trainrunsection.validator";
import {formatDate} from "@angular/common";

export class TrainrunSection {
  private static currentId = 0;

  private id: number;

  private sourceNodeId: number;
  private sourcePortId: number;
  private targetNodeId: number;
  private targetPortId: number;

  private sourceArrival: TimeLockDto;
  private sourceDeparture: TimeLockDto;
  private targetArrival: TimeLockDto;
  private targetDeparture: TimeLockDto;
  private travelTime: TimeLockDto;
  private numberOfStops: number;

  private trainrunId: number;
  private resourceId: number;
  private specificTrainrunSectionFrequencyId: number;
  private path: PathDto;
  private pathVec2D: Vec2D[];
  private warnings: WarningDto[];

  private sourceNode: Node;
  private targetNode: Node;
  private trainrun: Trainrun;
  private isSelected: boolean;

  constructor(
    {
      id,
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
      sourceDeparture,
      sourceArrival,
      targetDeparture,
      targetArrival,
      travelTime,
      numberOfStops,
      trainrunId,
      resourceId,
      specificTrainrunSectionFrequencyId,
      path,
      warnings,
    }: TrainrunSectionDto = {
      id: TrainrunSection.incrementId(),
      sourceNodeId: 0,
      sourcePortId: 0,
      targetNodeId: 0,
      targetPortId: 0,
      sourceDeparture: {
        time: 0,
        consecutiveTime: 0,
        lock: false,
        warning: null,
        timeFormatter: null,
      },
      sourceArrival: {
        time: 0,
        consecutiveTime: 60,
        lock: false,
        warning: null,
        timeFormatter: null,
      },
      targetDeparture: {
        time: 59,
        consecutiveTime: 59,
        lock: false,
        warning: null,
        timeFormatter: null,
      },
      targetArrival: {
        time: 1,
        consecutiveTime: 1,
        lock: false,
        warning: null,
        timeFormatter: null,
      },
      travelTime: {
        time: 1,
        consecutiveTime: 1,
        lock: true,
        warning: null,
        timeFormatter: null,
      },
      trainrunId: 0,
      resourceId: 0,
      specificTrainrunSectionFrequencyId: null,
      numberOfStops: 0,
      path: {
        path: [],
        textPositions: {
          [TrainrunSectionText.SourceArrival]: {x: 0, y: 0},
          [TrainrunSectionText.SourceDeparture]: {x: 0, y: 0},
          [TrainrunSectionText.TargetArrival]: {x: 0, y: 0},
          [TrainrunSectionText.TargetDeparture]: {x: 0, y: 0},
          [TrainrunSectionText.TrainrunSectionName]: {x: 0, y: 0},
          [TrainrunSectionText.TrainrunSectionTravelTime]: {x: 0, y: 0},
          [TrainrunSectionText.TrainrunSectionNumberOfStops]: {x: 0, y: 0},
        },
      },
      warnings: null,
    },
  ) {
    this.id = id;
    this.sourceNodeId = sourceNodeId;
    this.sourcePortId = sourcePortId;
    this.targetNodeId = targetNodeId;
    this.targetPortId = targetPortId;
    this.sourceDeparture = sourceDeparture;
    this.sourceArrival = sourceArrival;
    this.targetDeparture = targetDeparture;
    this.targetArrival = targetArrival;
    this.travelTime = travelTime;
    this.trainrunId = trainrunId;
    this.resourceId = resourceId;
    this.specificTrainrunSectionFrequencyId = specificTrainrunSectionFrequencyId;
    this.path = path;
    this.warnings = warnings;
    this.isSelected = false;
    this.numberOfStops = numberOfStops;

    this.convertPathToVec2D();

    if (TrainrunSection.currentId < this.id) {
      TrainrunSection.currentId = this.id;
    }
  }

  private static incrementId(): number {
    return ++TrainrunSection.currentId;
  }

  private static getDisplayTextWidth(time: TimeLockDto): number {
    if (!time.timeFormatter?.textWidth) {
      return undefined;
    }
    return time.timeFormatter.textWidth;
  }

  private static getDisplayHtmlStyle(time: TimeLockDto): string {
    if (!time.timeFormatter?.htmlStyle) {
      return undefined;
    }
    return time.timeFormatter.htmlStyle;
  }

  private static getDisplayColorRef(time: TimeLockDto): ColorRefType {
    if (!time.timeFormatter?.colorRef) {
      return undefined;
    }
    return time.timeFormatter.colorRef;
  }

  private static formatDisplayText(time: TimeLockDto, offset: number): string {
    if (!time?.timeFormatter?.stylePattern) {
      return undefined;
    }

    const consecutiveTimeDate = new Date(null);
    consecutiveTimeDate.setSeconds((time.consecutiveTime + offset) * 60);
    const timeDate = new Date(null);
    timeDate.setSeconds(((time.time + offset + 24 * 60) % 60) * 60);

    const patterns = {
      "{{consecutiveTime}}.format(HH:mm:ss)": formatDate(
        consecutiveTimeDate.toISOString(),
        "HH:mm:ss",
        "en-US",
        "UTC",
      ),
      "{{consecutiveTime}}.format(HH:mm)": formatDate(
        consecutiveTimeDate.toISOString(),
        "HH:mm",
        "en-US",
        "UTC",
      ),
      "{{consecutiveTime}}": "" + time.consecutiveTime,
      "{{time}}.format(HH:mm:ss)": formatDate(timeDate.toISOString(), "HH:mm:ss", "en-US", "UTC"),
      "{{time}}.format(HH:mm)": formatDate(timeDate.toISOString(), "HH:mm", "en-US", "UTC"),
      "{{time}}": "" + ((time.time + offset + 24 * 60) % 60),
    };

    let formattedText = time.timeFormatter.stylePattern;
    for (const pattern in patterns) {
      formattedText = formattedText.replace(pattern, patterns[pattern]);
    }

    return formattedText;
  }

  shiftAllTimes(translateMinutes: number, mirrorSourceDeparture: boolean) {
    this.sourceDeparture.time += translateMinutes;
    this.targetArrival.time += translateMinutes;
    this.sourceArrival.time += translateMinutes;
    this.targetDeparture.time += translateMinutes;

    this.sourceDeparture.time = this.sourceDeparture.time % 60;
    this.targetArrival.time = this.targetArrival.time % 60;
    this.sourceArrival.time = this.sourceArrival.time % 60;
    this.targetDeparture.time = this.targetDeparture.time % 60;

    if (mirrorSourceDeparture) {
      this.sourceArrival.time = (120 - this.sourceDeparture.time) % 60;
      this.targetDeparture.time = (120 - this.targetArrival.time) % 60;
    } else {
      this.sourceDeparture.time = (120 - this.sourceArrival.time) % 60;
      this.targetArrival.time = (120 - this.targetDeparture.time) % 60;
    }
  }

  setSourceAndTargetNodeReference(sourceNode: Node, targetNode: Node) {
    this.setSourceNode(sourceNode);
    this.setTargetNode(targetNode);
  }

  setTrainrun(trainrun: Trainrun) {
    this.trainrun = trainrun;
    this.trainrunId = trainrun.getId();
  }

  setSourceArrivalDto(sourceArrivalDto: TimeLockDto) {
    this.sourceArrival = sourceArrivalDto;
  }

  setTargetArrivalDto(targetArrivalDto: TimeLockDto) {
    this.targetArrival = targetArrivalDto;
  }

  setSourceDepartureDto(sourceDepartureDto: TimeLockDto) {
    this.sourceDeparture = sourceDepartureDto;
  }

  setTargetDepartureDto(targetDepartureDto: TimeLockDto) {
    this.targetDeparture = targetDepartureDto;
  }

  setTravelTimeDto(travelTimeDto: TimeLockDto) {
    this.travelTime = travelTimeDto;
  }

  getSourceArrivalDto(): TimeLockDto {
    return this.sourceArrival;
  }

  getTargetArrivalDto(): TimeLockDto {
    return this.targetArrival;
  }

  getSourceDepartureDto(): TimeLockDto {
    return this.sourceDeparture;
  }

  getTargetDepartureDto(): TimeLockDto {
    return this.targetDeparture;
  }

  getTravelTimeDto(): TimeLockDto {
    return this.travelTime;
  }

  getId(): number {
    return this.id;
  }

  getTravelTime(): number {
    return this.travelTime.time;
  }

  getSourceDeparture(): number {
    return this.sourceDeparture.time;
  }

  getSourceArrival(): number {
    return this.sourceArrival.time;
  }

  getTargetDeparture(): number {
    return this.targetDeparture.time;
  }

  getTargetArrival(): number {
    return this.targetArrival.time;
  }

  getTravelTimeFormattedDisplayText(offset = 0): string {
    return TrainrunSection.formatDisplayText(this.travelTime, offset);
  }

  getSourceDepartureFormattedDisplayText(offset = 0): string {
    return TrainrunSection.formatDisplayText(this.sourceDeparture, offset);
  }

  getSourceArrivalFormattedDisplayText(offset = 0): string {
    return TrainrunSection.formatDisplayText(this.sourceArrival, offset);
  }

  getTargetDepartureFormattedDisplayText(offset = 0): string {
    return TrainrunSection.formatDisplayText(this.targetDeparture, offset);
  }

  getTargetArrivalFormattedDisplayText(offset = 0): string {
    return TrainrunSection.formatDisplayText(this.targetArrival, offset);
  }

  getTravelTimeFormattedDisplayTextWidth(): number {
    return TrainrunSection.getDisplayTextWidth(this.travelTime);
  }

  getSourceDepartureFormattedDisplayTextWidth(): number {
    return TrainrunSection.getDisplayTextWidth(this.sourceDeparture);
  }

  getSourceArrivalFormattedDisplayTextWidth(): number {
    return TrainrunSection.getDisplayTextWidth(this.sourceArrival);
  }

  getTargetDepartureFormattedDisplayTextWidth(): number {
    return TrainrunSection.getDisplayTextWidth(this.targetDeparture);
  }

  getTargetArrivalFormattedDisplayTextWidth(): number {
    return TrainrunSection.getDisplayTextWidth(this.targetArrival);
  }

  getTravelTimeFormattedDisplayHtmlStyle(): string {
    return TrainrunSection.getDisplayHtmlStyle(this.travelTime);
  }

  getSourceDepartureFormattedDisplayHtmlStyle(): string {
    return TrainrunSection.getDisplayHtmlStyle(this.sourceDeparture);
  }

  getSourceArrivalFormattedDisplayHtmlStyle(): string {
    return TrainrunSection.getDisplayHtmlStyle(this.sourceArrival);
  }

  getTargetDepartureFormattedDisplayHtmlStyle(): string {
    return TrainrunSection.getDisplayHtmlStyle(this.targetDeparture);
  }

  getTargetArrivalFormattedDisplayHtmlStyle(): string {
    return TrainrunSection.getDisplayHtmlStyle(this.targetArrival);
  }

  getTravelTimeFormatterColorRef(): ColorRefType {
    return TrainrunSection.getDisplayColorRef(this.travelTime);
  }

  getSourceDepartureFormatterColorRef(): ColorRefType {
    return TrainrunSection.getDisplayColorRef(this.sourceDeparture);
  }

  getSourceArrivalFormatterColorRef(): ColorRefType {
    return TrainrunSection.getDisplayColorRef(this.sourceArrival);
  }

  getTargetDepartureFormatterColorRef(): ColorRefType {
    return TrainrunSection.getDisplayColorRef(this.targetDeparture);
  }

  getTargetArrivalFormatterColorRef(): ColorRefType {
    return TrainrunSection.getDisplayColorRef(this.targetArrival);
  }

  getNumberOfStops(): number {
    return this.numberOfStops;
  }

  setTravelTime(time: number) {
    this.travelTime.time = time;
    TrainrunSectionValidator.validateTravelTime(this, 1); // TODO: I don't think this should be done here
  }

  setSourceDeparture(time: number) {
    this.sourceDeparture.time = time;
    TrainrunSectionValidator.validateOneSection(this);
  }

  setSourceArrival(time: number) {
    this.sourceArrival.time = time;
    TrainrunSectionValidator.validateOneSection(this);
  }

  setTargetDeparture(time: number) {
    this.targetDeparture.time = time;
    TrainrunSectionValidator.validateOneSection(this);
  }

  setTargetArrival(time: number) {
    this.targetArrival.time = time;
    TrainrunSectionValidator.validateOneSection(this);
  }

  getTravelTimeLock(): boolean {
    return this.travelTime.lock;
  }

  getSourceDepartureLock(): boolean {
    return this.sourceDeparture.lock;
  }

  getSourceArrivalLock(): boolean {
    return this.sourceArrival.lock;
  }

  getTargetDepartureLock(): boolean {
    return this.targetDeparture.lock;
  }

  getTargetArrivalLock(): boolean {
    return this.targetArrival.lock;
  }

  setTravelTimeLock(lock: boolean) {
    this.travelTime.lock = lock;
  }

  setSourceDepartureLock(lock: boolean) {
    this.sourceDeparture.lock = lock;
  }

  setSourceArrivalLock(lock: boolean) {
    this.sourceArrival.lock = lock;
  }

  setTargetDepartureLock(lock: boolean) {
    this.targetDeparture.lock = lock;
  }

  setTargetArrivalLock(lock: boolean) {
    this.targetArrival.lock = lock;
  }

  setNumberOfStops(numberOfStops: number) {
    this.numberOfStops = numberOfStops;
  }

  hasTravelTimeWarning(): boolean {
    return this.travelTime.warning !== null;
  }

  hasSourceDepartureWarning(): boolean {
    return this.sourceDeparture.warning !== null;
  }

  hasSourceArrivalWarning(): boolean {
    return this.sourceArrival.warning !== null;
  }

  hasTargetDepartureWarning(): boolean {
    return this.targetDeparture.warning !== null;
  }

  hasTargetArrivalWarning(): boolean {
    return this.targetArrival.warning !== null;
  }

  setTargetArrivalWarning(wargningTitle: string, warningDescription: string) {
    this.targetArrival.warning = {
      title: wargningTitle,
      description: warningDescription,
    };
  }

  setSourceArrivalWarning(wargningTitle: string, warningDescription: string) {
    this.sourceArrival.warning = {
      title: wargningTitle,
      description: warningDescription,
    };
  }

  setTargetDepartureWarning(wargningTitle: string, warningDescription: string) {
    this.targetDeparture.warning = {
      title: wargningTitle,
      description: warningDescription,
    };
  }

  setSourceDepartureWarning(warningTitle: string, warningDescription: string) {
    this.sourceDeparture.warning = {
      title: warningTitle,
      description: warningDescription,
    };
  }

  setTravelTimeWarning(warningTitle: string, warningDescription: string) {
    this.travelTime.warning = {
      title: warningTitle,
      description: warningDescription,
    };
  }

  getTargetArrivalWarning() {
    return this.targetArrival.warning;
  }

  getSourceArrivalWarning() {
    return this.sourceArrival.warning;
  }

  getTargetDepartureWarning() {
    return this.targetDeparture.warning;
  }

  getSourceDepartureWarning() {
    return this.sourceDeparture.warning;
  }

  getTravelTimeWarning() {
    return this.travelTime.warning;
  }

  resetTargetArrivalWarning() {
    this.targetArrival.warning = null;
  }

  resetSourceArrivalWarning() {
    this.sourceArrival.warning = null;
  }

  resetTargetDepartureWarning() {
    this.targetDeparture.warning = null;
  }

  resetSourceDepartureWarning() {
    this.sourceDeparture.warning = null;
  }

  resetTravelTimeWarning() {
    this.travelTime.warning = null;
  }

  getTrainrunId(): number {
    return this.trainrunId;
  }

  getSourcePortId(): number {
    return this.sourcePortId;
  }

  getTargetPortId(): number {
    return this.targetPortId;
  }

  getSourceNode(): Node {
    return this.sourceNode;
  }

  getSourceNodeId(): number {
    return this.sourceNodeId;
  }

  getTargetNode(): Node {
    return this.targetNode;
  }

  getTargetNodeId(): number {
    return this.targetNodeId;
  }

  getTrainrun(): Trainrun {
    return this.trainrun;
  }

  getTextPositionX(lineTextElement: TrainrunSectionText): number {
    return this.path.textPositions[lineTextElement].x;
  }

  getTextPositionY(lineTextElement: TrainrunSectionText): number {
    return this.path.textPositions[lineTextElement].y;
  }

  getPositionAtSourceNode(): Vec2D {
    return this.pathVec2D[0];
  }

  getPositionAtTargetNode(): Vec2D {
    return this.pathVec2D[3];
  }

  getFrequency(): number {
    return this.trainrun.getFrequency();
  }

  getFrequencyOffset(): number {
    return this.trainrun.getFrequencyOffset();
  }

  getFrequencyLinePatternRef(): LinePatternRefs {
    return this.trainrun.getFrequencyLinePatternRef();
  }

  getTimeCategoryLinePatternRef(): LinePatternRefs {
    return this.trainrun.getTimeCategoryLinePatternRef();
  }

  getPath(): Vec2D[] {
    return this.pathVec2D;
  }

  isPathEmpty(): boolean {
    return this.pathVec2D.length === 0;
  }

  routeEdgeAndPlaceText() {
    this.pathVec2D = SimpleTrainrunSectionRouter.routeTrainrunSection(
      this.sourceNode,
      this.sourceNode.getPort(this.sourcePortId),
      this.targetNode,
      this.targetNode.getPort(this.targetPortId),
    );

    this.path.textPositions = SimpleTrainrunSectionRouter.placeTextOnTrainrunSection(
      this.pathVec2D,
      this.sourceNode.getPort(this.sourcePortId),
    );
  }

  setSourcePortId(sourcePortId: number) {
    this.sourcePortId = sourcePortId;
  }

  setTargetPortId(targetPortId: number) {
    this.targetPortId = targetPortId;
  }

  getDto(): TrainrunSectionDto {
    this.convertVec2DToPath();
    return {
      id: this.id,
      sourceNodeId: this.sourceNodeId,
      sourcePortId: this.sourcePortId,
      targetNodeId: this.targetNodeId,
      targetPortId: this.targetPortId,
      travelTime: this.travelTime,

      sourceDeparture: this.sourceDeparture,
      sourceArrival: this.sourceArrival,
      targetDeparture: this.targetDeparture,
      targetArrival: this.targetArrival,

      numberOfStops: this.numberOfStops,

      trainrunId: this.trainrunId,
      resourceId: this.resourceId,

      specificTrainrunSectionFrequencyId: this.specificTrainrunSectionFrequencyId,
      path: this.path,
      warnings: this.warnings,
    };
  }

  setSourceNode(sourceNode: Node) {
    this.sourceNode = sourceNode;
    this.sourceNodeId = sourceNode.getId();
  }

  setTargetNode(targetNode: Node) {
    this.targetNode = targetNode;
    this.targetNodeId = targetNode.getId();
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

  setSourceDepartureConsecutiveTime(time: number) {
    this.sourceDeparture.consecutiveTime = time;
  }

  setSourceArrivalConsecutiveTime(time: number) {
    this.sourceArrival.consecutiveTime = time;
  }

  setTargetDepartureConsecutiveTime(time: number) {
    this.targetDeparture.consecutiveTime = time;
  }

  setTargetArrivalConsecutiveTime(time: number) {
    this.targetArrival.consecutiveTime = time;
  }

  getSourceDepartureConsecutiveTime(): number {
    return this.sourceDeparture.consecutiveTime;
  }

  getSourceArrivalConsecutiveTime(): number {
    return this.sourceArrival.consecutiveTime;
  }

  getTargetDepartureConsecutiveTime(): number {
    return this.targetDeparture.consecutiveTime;
  }

  getTargetArrivalConsecutiveTime(): number {
    return this.targetArrival.consecutiveTime;
  }

  private convertPathToVec2D() {
    this.pathVec2D = this.path.path.map((point) => new Vec2D(point.x, point.y));
  }

  convertVec2DToPath() {
    this.path = {
      path: this.pathVec2D.map((point) => ({
        x: point.getX(),
        y: point.getY(),
      })),
      textPositions: this.path.textPositions,
    };
  }
}
