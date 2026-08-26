import {
  FilterSettingDto,
  TrainrunCategory,
  Direction,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from "../data-structures/business.data.structures";

/** FilterSettingDto but with some properties that are nullable. */
export type FilterSettingInit = {
  [K in keyof FilterSettingDto]: K extends
    | "filterTrainrunCategory"
    | "filterTrainrunFrequency"
    | "filterTrainrunTimeCategory"
    | "filterDirection"
    ? FilterSettingDto[K] | null
    : FilterSettingDto[K];
};

export class FilterSetting {
  // special field/case: isTemporaryDisableFilteringOfItemsInView should not be compared nor copied
  private static isTemporaryDisableFilteringOfItemsInViewAttribute =
    "isTemporaryDisableFilteringOfItemsInView";

  private static currentId = 0;

  public id: number;
  public name: string;
  public description: string;
  public filterNodeLabels: number[];
  public filterNoteLabels: number[];
  public filterTrainrunLabels: number[];
  public filterDirectionArrows: boolean;
  public filterAsymmetryArrows: boolean;
  public filterArrivalDepartureTime: boolean;
  public filterTravelTime: boolean;
  public filterBackwardTravelTime: boolean;
  public filterTrainrunName: boolean;
  public filterConnections: boolean;
  public filterShowNonStopTime: boolean;
  public filterTrainrunCategory: TrainrunCategory[] | null;
  public filterTrainrunFrequency: TrainrunFrequency[] | null;
  public filterTrainrunTimeCategory: TrainrunTimeCategory[] | null;
  public filterDirection: Direction[] | null;
  public filterSymmetry: boolean[];
  public filterAllEmptyNodes: boolean;
  public filterAllNonStopNodes: boolean;
  public displayNodesFullName: boolean;
  public filterNotes: boolean;
  public timeDisplayPrecision: number;
  public isTemporaryDisableFilteringOfItemsInView: boolean;
  public temporaryEmptyAndNonStopFilteringSwitchedOff: boolean;

  constructor(
    {
      id,
      name,
      description,
      filterNodeLabels,
      filterNoteLabels,
      filterTrainrunLabels,
      filterDirectionArrows,
      filterAsymmetryArrows,
      filterArrivalDepartureTime,
      filterTravelTime,
      filterBackwardTravelTime,
      filterTrainrunName,
      filterConnections,
      filterShowNonStopTime,
      filterTrainrunCategory,
      filterTrainrunFrequency,
      filterTrainrunTimeCategory,
      filterDirection,
      filterSymmetry,
      filterAllEmptyNodes,
      filterAllNonStopNodes,
      displayNodesFullName,
      filterNotes,
      timeDisplayPrecision,
      isTemporaryDisableFilteringOfItemsInView,
      temporaryEmptyAndNonStopFilteringSwitchedOff,
    }: FilterSettingInit = {
      id: FilterSetting.incrementId(),
      name: "Filter",
      description: "",
      filterNodeLabels: [],
      filterNoteLabels: [],
      filterTrainrunLabels: [],
      filterDirectionArrows: true,
      filterAsymmetryArrows: true,
      filterArrivalDepartureTime: true,
      filterTravelTime: true,
      filterBackwardTravelTime: true,
      filterTrainrunName: true,
      filterConnections: true,
      filterShowNonStopTime: true,
      filterTrainrunCategory: null,
      filterTrainrunFrequency: null,
      filterTrainrunTimeCategory: null,
      filterDirection: null,
      filterSymmetry: [true, false],
      filterAllEmptyNodes: false,
      filterAllNonStopNodes: false,
      displayNodesFullName: false,
      filterNotes: false,
      timeDisplayPrecision: 1,
      isTemporaryDisableFilteringOfItemsInView: false,
      temporaryEmptyAndNonStopFilteringSwitchedOff: false,
    },
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.filterNodeLabels = filterNodeLabels;
    this.filterNoteLabels = filterNoteLabels;
    this.filterTrainrunLabels = filterTrainrunLabels;
    this.filterDirectionArrows = filterDirectionArrows;
    this.filterAsymmetryArrows = filterAsymmetryArrows;
    this.filterArrivalDepartureTime = filterArrivalDepartureTime;
    this.filterTravelTime = filterTravelTime;
    this.filterBackwardTravelTime = filterBackwardTravelTime;
    this.filterTrainrunName = filterTrainrunName;
    this.filterConnections = filterConnections;
    this.filterShowNonStopTime = filterShowNonStopTime;
    this.filterTrainrunCategory = filterTrainrunCategory;
    this.filterTrainrunFrequency = filterTrainrunFrequency;
    this.filterTrainrunTimeCategory = filterTrainrunTimeCategory;
    this.filterDirection = filterDirection;
    this.filterSymmetry = filterSymmetry;
    this.filterAllEmptyNodes = filterAllEmptyNodes;
    this.filterAllNonStopNodes = filterAllNonStopNodes;
    this.displayNodesFullName = displayNodesFullName;
    this.filterNotes = filterNotes;
    this.timeDisplayPrecision = timeDisplayPrecision;
    this.isTemporaryDisableFilteringOfItemsInView = isTemporaryDisableFilteringOfItemsInView;
    this.temporaryEmptyAndNonStopFilteringSwitchedOff =
      temporaryEmptyAndNonStopFilteringSwitchedOff;

    if (FilterSetting.currentId < this.id) {
      FilterSetting.currentId = this.id;
    }
  }

  private static incrementId(): number {
    return ++FilterSetting.currentId;
  }

  getId(): number {
    return this.id;
  }

  copy(): FilterSetting {
    const newFilterSetting = new FilterSetting(Object.assign({}, this.getDto()));
    newFilterSetting.id = FilterSetting.incrementId();
    return newFilterSetting;
  }

  areFilteringAttributesEqual(fs: FilterSetting): boolean {
    const self = this.getDto();
    let eq = true;
    (Object.keys(self) as (keyof FilterSettingDto)[]).forEach((key) => {
      if (key !== FilterSetting.isTemporaryDisableFilteringOfItemsInViewAttribute) {
        if (JSON.stringify(this[key]) !== JSON.stringify(fs[key])) {
          eq = false;
        }
      }
    });
    return eq;
  }

  copyFilteringAttributes(fs: FilterSetting) {
    (Object.keys(this) as (keyof FilterSettingDto)[]).forEach((key) => {
      if (this[key] !== fs[key]) {
        if (key !== FilterSetting.isTemporaryDisableFilteringOfItemsInViewAttribute) {
          Object.assign(this, {[key]: Array.isArray(fs[key]) ? [...fs[key]] : fs[key]});
        }
      }
    });
  }

  isEmpty(
    trainrunCategoriesLength: number,
    frainrunFrequenciesLength: number,
    trainrunTimeCategoryLength: number,
  ): boolean {
    if (
      this.filterTrainrunCategory === null ||
      this.filterTrainrunFrequency === null ||
      this.filterTrainrunTimeCategory === null ||
      this.filterDirection === null
    ) {
      throw Error("FilterSetting.isEmpty() called before filter init");
    }
    return (
      this.filterNodeLabels.length === 0 &&
      this.filterNoteLabels.length === 0 &&
      this.filterTrainrunLabels.length === 0 &&
      this.filterDirectionArrows === true &&
      this.filterAsymmetryArrows === true &&
      this.filterArrivalDepartureTime === true &&
      this.filterTravelTime === true &&
      this.filterBackwardTravelTime === true &&
      this.filterTrainrunName === true &&
      this.filterConnections === true &&
      this.filterShowNonStopTime === true &&
      this.filterTrainrunCategory.length === trainrunCategoriesLength &&
      this.filterTrainrunFrequency.length === frainrunFrequenciesLength &&
      this.filterTrainrunTimeCategory.length === trainrunTimeCategoryLength &&
      this.filterDirection.length === Object.values(Direction).length &&
      this.filterSymmetry.length === 2 &&
      this.filterAllEmptyNodes === false &&
      this.filterAllNonStopNodes === false &&
      this.displayNodesFullName === false &&
      this.filterNotes === false &&
      this.timeDisplayPrecision === 1 &&
      this.isTemporaryDisableFilteringOfItemsInView === false &&
      this.temporaryEmptyAndNonStopFilteringSwitchedOff === false
    );
  }

  getDto(): FilterSettingDto {
    if (
      this.filterTrainrunCategory === null ||
      this.filterTrainrunFrequency === null ||
      this.filterTrainrunTimeCategory === null ||
      this.filterDirection === null
    ) {
      throw Error("FilterSetting.getDto() called before filter init");
    }
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      filterNodeLabels: this.filterNodeLabels,
      filterNoteLabels: this.filterNoteLabels,
      filterTrainrunLabels: this.filterTrainrunLabels,
      filterDirectionArrows: this.filterDirectionArrows,
      filterAsymmetryArrows: this.filterAsymmetryArrows,
      filterArrivalDepartureTime: this.filterArrivalDepartureTime,
      filterTravelTime: this.filterTravelTime,
      filterBackwardTravelTime: this.filterBackwardTravelTime,
      filterTrainrunName: this.filterTrainrunName,
      filterConnections: this.filterConnections,
      filterShowNonStopTime: this.filterShowNonStopTime,
      filterTrainrunCategory: this.filterTrainrunCategory,
      filterTrainrunFrequency: this.filterTrainrunFrequency,
      filterTrainrunTimeCategory: this.filterTrainrunTimeCategory,
      filterDirection: this.filterDirection,
      filterSymmetry: this.filterSymmetry,
      filterAllEmptyNodes: this.filterAllEmptyNodes,
      filterAllNonStopNodes: this.filterAllNonStopNodes,
      displayNodesFullName: this.displayNodesFullName,
      filterNotes: this.filterNotes,
      timeDisplayPrecision: this.timeDisplayPrecision,
      isTemporaryDisableFilteringOfItemsInView: this.isTemporaryDisableFilteringOfItemsInView,
      temporaryEmptyAndNonStopFilteringSwitchedOff:
        this.temporaryEmptyAndNonStopFilteringSwitchedOff,
    };
  }
}
