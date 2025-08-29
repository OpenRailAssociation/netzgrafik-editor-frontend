import {
  LinePatternRefs,
  TrainrunCategory,
  Direction,
  TrainrunDto,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from "../data-structures/business.data.structures";
import {DataMigration} from "../utils/data-migration";

export class Trainrun {
  public static DEFAULT_TRAINRUN_NAME = "X";
  public static DEFAULT_TRAINRUN_CATEGORY = 1; // default is IC
  public static DEFAULT_TRAINRUN_FREQUENCY = 3; // default is stuendlich
  public static DEFAULT_TRAINRUN_TIME_CATEGORY = 0; // default is täglich, immer
  private static currentId = 0;
  private id: number;
  private name: string;
  private categoryId: number;
  private frequencyId: number;
  private trainrunTimeCategoryId: number;
  private trainrunCategory: TrainrunCategory;
  private trainrunFrequency: TrainrunFrequency;
  private trainrunTimeCategory: TrainrunTimeCategory;
  private isSelected: boolean;
  private labelIds: number[];
  private direction: Direction;

  constructor(
    {
      id,
      name,
      categoryId,
      frequencyId,
      trainrunTimeCategoryId,
      labelIds,
      direction = Direction.ROUND_TRIP, // temporary, to allow migration of old trainruns
    }: TrainrunDto = {
      id: Trainrun.incrementId(),
      name: Trainrun.DEFAULT_TRAINRUN_NAME,
      categoryId: Trainrun.DEFAULT_TRAINRUN_CATEGORY,
      frequencyId: Trainrun.DEFAULT_TRAINRUN_FREQUENCY,
      trainrunTimeCategoryId: Trainrun.DEFAULT_TRAINRUN_TIME_CATEGORY,
      labelIds: [],
      direction: Direction.ROUND_TRIP,
    },
  ) {
    this.id = id;
    this.name = name;
    this.categoryId = categoryId;
    this.frequencyId = frequencyId;
    this.isSelected = false;
    this.trainrunTimeCategoryId = trainrunTimeCategoryId;
    this.labelIds = labelIds;
    this.direction = direction;

    if (Trainrun.currentId < this.id) {
      Trainrun.currentId = this.id;
    }

    DataMigration.migrateTrainrunLabelIds(this);
  }

  private static incrementId(): number {
    return ++Trainrun.currentId;
  }

  getTitle(): string {
    return this.name;
  }

  setTitle(title: string) {
    this.name = title;
  }

  getId(): number {
    return this.id;
  }

  getFrequency(): number {
    return this.trainrunFrequency.frequency;
  }

  getFrequencyOffset(): number {
    return this.trainrunFrequency.offset;
  }

  getFrequencyLinePatternRef(): LinePatternRefs {
    return this.trainrunFrequency.linePatternRef;
  }

  getCategoryShortName(): string {
    return this.trainrunCategory.shortName.toUpperCase();
  }

  getCategoryColorRef(): string {
    return this.trainrunCategory.colorRef;
  }

  getTimeCategoryLinePatternRef(): LinePatternRefs {
    return this.trainrunTimeCategory.linePatternRef;
  }

  setTrainrunFrequency(trainrunFrequency: TrainrunFrequency) {
    this.trainrunFrequency = trainrunFrequency;
  }

  getTrainrunFrequency(): TrainrunFrequency {
    return this.trainrunFrequency;
  }

  setTrainrunCategory(trainrunCategory: TrainrunCategory) {
    this.trainrunCategory = trainrunCategory;
  }

  getTrainrunCategory(): TrainrunCategory {
    return this.trainrunCategory;
  }

  getTimeCategoryShortName(): string {
    return this.trainrunTimeCategory.shortName;
  }

  setTrainrunTimeCategory(trainrunTimeCategory: TrainrunTimeCategory) {
    this.trainrunTimeCategory = trainrunTimeCategory;
  }

  getTrainrunTimeCategory(): TrainrunTimeCategory {
    return this.trainrunTimeCategory;
  }

  getCategoryOrder(): number {
    return this.trainrunCategory.order;
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

  getLabelIds(): number[] {
    return this.labelIds;
  }

  setLabelIds(labelIds: number[]) {
    this.labelIds = labelIds;
  }

  isRoundTrip(): boolean {
    return this.direction === Direction.ROUND_TRIP;
  }

  getDirection(): Direction {
    return this.direction;
  }

  setDirection(direction: Direction) {
    this.direction = direction;
  }

  getDto(): TrainrunDto {
    return {
      id: this.id,
      name: this.name,
      categoryId: this.trainrunCategory.id,
      frequencyId: this.trainrunFrequency.id,
      trainrunTimeCategoryId: this.trainrunTimeCategory.id,
      labelIds: this.labelIds,
      direction: this.direction,
    };
  }
}
