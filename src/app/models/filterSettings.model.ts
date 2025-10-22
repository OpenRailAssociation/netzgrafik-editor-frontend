import {
  FilterSettingDto,
  TrainrunCategory,
  Direction,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from "../data-structures/business.data.structures";

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
  public filterDirectionArrows;
  public filterArrivalDepartureTime;
  public filterTravelTime;
  public filterTrainrunName;
  public filterConnections;
  public filterShowNonStopTime;
  public filterTrainrunCategory: TrainrunCategory[];
  public filterTrainrunFrequency: TrainrunFrequency[];
  public filterTrainrunTimeCategory: TrainrunTimeCategory[];
  public filterDirection: Direction[];
  public filterAllEmptyNodes;
  public filterAllNonStopNodes;
  public filterNotes;
  public timeDisplayPrecision;
  public isTemporaryDisableFilteringOfItemsInView;
  public temporaryEmptyAndNonStopFilteringSwitchedOff;

  constructor(
    {
      id,
      name,
      description,
      filterNodeLabels,
      filterNoteLabels,
      filterTrainrunLabels,
      filterDirectionArrows: filterDirectionArrows,
      filterArrivalDepartureTime,
      filterTravelTime,
      filterTrainrunName,
      filterConnections,
      filterShowNonStopTime,
      filterTrainrunCategory,
      filterTrainrunFrequency,
      filterTrainrunTimeCategory,
      filterDirection: filterDirection,
      filterAllEmptyNodes,
      filterAllNonStopNodes,
      filterNotes,
      timeDisplayPrecision,
      isTemporaryDisableFilteringOfItemsInView,
      temporaryEmptyAndNonStopFilteringSwitchedOff,
    }: FilterSettingDto = {
      id: FilterSetting.incrementId(),
      name: "Filter",
      description: "",
      filterNodeLabels: [],
      filterNoteLabels: [],
      filterTrainrunLabels: [],
      filterDirectionArrows: true,
      filterArrivalDepartureTime: true,
      filterTravelTime: true,
      filterTrainrunName: true,
      filterConnections: true,
      filterShowNonStopTime: true,
      filterTrainrunCategory: null,
      filterTrainrunFrequency: null,
      filterTrainrunTimeCategory: null,
      filterDirection: null,
      filterAllEmptyNodes: false,
      filterAllNonStopNodes: false,
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
    this.filterArrivalDepartureTime = filterArrivalDepartureTime;
    this.filterTravelTime = filterTravelTime;
    this.filterTrainrunName = filterTrainrunName;
    this.filterConnections = filterConnections;
    this.filterShowNonStopTime = filterShowNonStopTime;
    this.filterTrainrunCategory = filterTrainrunCategory;
    this.filterTrainrunFrequency = filterTrainrunFrequency;
    this.filterTrainrunTimeCategory = filterTrainrunTimeCategory;
    this.filterDirection = filterDirection;
    this.filterAllEmptyNodes = filterAllEmptyNodes;
    this.filterAllNonStopNodes = filterAllNonStopNodes;
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
    Object.keys(self).forEach((key) => {
      if (key !== FilterSetting.isTemporaryDisableFilteringOfItemsInViewAttribute) {
        if (JSON.stringify(this[key]) !== JSON.stringify(fs[key])) {
          eq = false;
        }
      }
    });
    return eq;
  }

  copyFilteringAttributes(fs: FilterSetting) {
    Object.keys(this).forEach((key) => {
      if (this[key] !== fs[key]) {
        if (key !== FilterSetting.isTemporaryDisableFilteringOfItemsInViewAttribute) {
          if (Array.isArray(fs[key])) {
            this[key] = Object.assign([], fs[key]);
          } else {
            this[key] = fs[key];
          }
        }
      }
    });
  }

  isEmpty(
    trainrunCategoriesLength: number,
    frainrunFrequenciesLength: number,
    trainrunTimeCategoryLength: number,
  ): boolean {
    return (
      this.filterNodeLabels.length === 0 &&
      this.filterNoteLabels.length === 0 &&
      this.filterTrainrunLabels.length === 0 &&
      this.filterDirectionArrows === true &&
      this.filterArrivalDepartureTime === true &&
      this.filterTravelTime === true &&
      this.filterTrainrunName === true &&
      this.filterConnections === true &&
      this.filterShowNonStopTime === true &&
      this.filterTrainrunCategory.length === trainrunCategoriesLength &&
      this.filterTrainrunFrequency.length === frainrunFrequenciesLength &&
      this.filterTrainrunTimeCategory.length === trainrunTimeCategoryLength &&
      this.filterDirection.length === Object.values(Direction).length &&
      this.filterAllEmptyNodes === false &&
      this.filterAllNonStopNodes === false &&
      this.filterNotes === false &&
      this.timeDisplayPrecision === 1 &&
      this.isTemporaryDisableFilteringOfItemsInView === false &&
      this.temporaryEmptyAndNonStopFilteringSwitchedOff === false
    );
  }

  getDto(): FilterSettingDto {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      filterNodeLabels: this.filterNodeLabels,
      filterNoteLabels: this.filterNoteLabels,
      filterTrainrunLabels: this.filterTrainrunLabels,
      filterDirectionArrows: this.filterDirectionArrows,
      filterArrivalDepartureTime: this.filterArrivalDepartureTime,
      filterTravelTime: this.filterTravelTime,
      filterTrainrunName: this.filterTrainrunName,
      filterConnections: this.filterConnections,
      filterShowNonStopTime: this.filterShowNonStopTime,
      filterTrainrunCategory: this.filterTrainrunCategory,
      filterTrainrunFrequency: this.filterTrainrunFrequency,
      filterTrainrunTimeCategory: this.filterTrainrunTimeCategory,
      filterDirection: this.filterDirection,
      filterAllEmptyNodes: this.filterAllEmptyNodes,
      filterAllNonStopNodes: this.filterAllNonStopNodes,
      filterNotes: this.filterNotes,
      timeDisplayPrecision: this.timeDisplayPrecision,
      isTemporaryDisableFilteringOfItemsInView: this.isTemporaryDisableFilteringOfItemsInView,
      temporaryEmptyAndNonStopFilteringSwitchedOff:
        this.temporaryEmptyAndNonStopFilteringSwitchedOff,
    };
  }
}
