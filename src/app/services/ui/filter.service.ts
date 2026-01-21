import {Injectable, OnDestroy} from "@angular/core";
import {
  FilterDataDto,
  LabelRef,
  TrainrunCategory,
  Direction,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from "../../data-structures/business.data.structures";
import {BehaviorSubject, Subject} from "rxjs";
import {DataService} from "../data/data.service";
import {Node} from "../../models/node.model";
import {LabelService} from "../data/label.service";
import {Label} from "../../models/label.model";
import {LabelGroupService} from "../data/labelgroup.service";
import {LabelGroup, LogicalFilterOperator} from "../../models/labelGroup.model";
import {Trainrun} from "../../models/trainrun.model";
import {Port} from "../../models/port.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Note} from "../../models/note.model";
import {FilterSetting} from "../../models/filterSettings.model";

@Injectable({
  providedIn: "root",
})
export class FilterService implements OnDestroy {
  filterSubject = new BehaviorSubject<void>(null);
  readonly filter = this.filterSubject.asObservable();

  filterSettingSubject = new BehaviorSubject<FilterSetting[]>(null);
  readonly filterSetting = this.filterSettingSubject.asObservable();
  filterSettingStore: {filterSettings: FilterSetting[]} = {filterSettings: []}; // store the data in memory

  private activeFilterSetting: FilterSetting = null;
  private destroyed = new Subject<void>();
  private dataService: DataService;

  constructor(
    private labelService: LabelService,
    private labelGroupService: LabelGroupService,
  ) {
    this.activeFilterSetting = new FilterSetting();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getFilterSettingFromId(filterSettingId: number): FilterSetting {
    return this.filterSettingStore.filterSettings.find(
      (fs: FilterSetting) => fs.getId() === filterSettingId,
    );
  }

  filterSettingUpdated() {
    this.filterSettingSubject.next(Object.assign([], this.filterSettingStore).filterSettings);
  }

  getDtos(): FilterDataDto {
    const filterSettings = this.filterSettingStore.filterSettings.map((filterSetting) =>
      filterSetting.getDto(),
    );
    return {
      filterSettings,
    };
  }

  setFilterData(filterData: FilterDataDto) {
    this.activeFilterSetting = new FilterSetting();
    this.initializeFilterSetting(this.activeFilterSetting);
    this.filterSettingStore.filterSettings = filterData.filterSettings.map(
      (fs) => new FilterSetting(fs),
    );
    this.filterSettingStore.filterSettings.forEach((fs) => this.initializeFilterSetting(fs));
  }

  activateFilterSetting(activeFilterSettingId: number): FilterSetting {
    const activeFilterSetting = this.getFilterSettingFromId(activeFilterSettingId);
    if (activeFilterSetting !== undefined) {
      this.activeFilterSetting.copyFilteringAttributes(activeFilterSetting);
    }
    this.filterChanged();
    return this.activeFilterSetting;
  }

  getActiveFilterSettingId(): number {
    return this.activeFilterSetting.getId();
  }

  getActiveFilterSetting(): FilterSetting {
    return this.activeFilterSetting.copy();
  }

  setActiveFilterSetting(fs: FilterSetting) {
    this.activeFilterSetting = fs.copy();
    this.filterChanged();
  }

  isActiveFilterSettingEqual(filterSettingId: number): boolean {
    return this.activeFilterSetting.areFilteringAttributesEqual(
      this.getFilterSettingFromId(filterSettingId),
    );
  }

  isFilterSettingEnabled(filterSettingId: number): boolean {
    return this.activeFilterSetting.getId() === filterSettingId;
  }

  saveFilterSetting(filterSetting: FilterSetting) {
    const idx = this.filterSettingStore.filterSettings.findIndex(
      (fs) => fs.getId() === filterSetting.getId(),
    );
    this.filterSettingStore.filterSettings[idx].copyFilteringAttributes(this.activeFilterSetting);
    this.activateFilterSetting(this.filterSettingStore.filterSettings[idx].getId());
    this.filterSettingUpdated();
  }

  saveAsNewFilterSetting(): FilterSetting {
    const fs = this.activeFilterSetting.copy();
    this.filterSettingStore.filterSettings.push(fs);
    this.activateFilterSetting(fs.getId());
    this.setActiveFilterSettingName($localize`:@@app.services.ui.newFilter:New filter`, fs.getId());
    this.filterSettingUpdated();
    return fs;
  }

  getFilterSettings(): FilterSetting[] {
    return Object.assign([], this.filterSettingStore.filterSettings);
  }

  setFilterSettings(fs: FilterSetting[]) {
    this.filterSettingStore.filterSettings = fs;
  }

  setActiveFilterSettingName(name: string, filterSettingId: number) {
    const fs = this.getFilterSettingFromId(filterSettingId);
    if (fs !== undefined) {
      fs.name = name;
    }
  }

  deleteFilterSetting(filterSettingId: number) {
    const idx = this.filterSettingStore.filterSettings.findIndex(
      (fs) => fs.getId() === filterSettingId,
    );
    if (this.activeFilterSetting.getId() === filterSettingId) {
      if (idx > 0) {
        this.activateFilterSetting(this.filterSettingStore.filterSettings[idx - 1].getId());
      } else {
        if (this.filterSettingStore.filterSettings.length > 1) {
          this.activateFilterSetting(this.filterSettingStore.filterSettings[idx + 1].getId());
        }
      }
    }
    this.filterSettingStore.filterSettings = this.filterSettingStore.filterSettings.filter(
      (fs) => fs.getId() !== filterSettingId,
    );
    if (this.filterSettingStore.filterSettings.length === 0) {
      this.activeFilterSetting = new FilterSetting();
      this.initializeFilterSetting(this.activeFilterSetting);
    }
    this.filterSettingUpdated();
    this.filterChanged();
  }

  setDataService(dataService: DataService) {
    this.dataService = dataService;
    this.initializeFilterSetting(this.activeFilterSetting);
  }

  resetTemporaryEmptyAndNonStopFilteringSwitchedOff() {
    if (!this.isTemporaryEmptyAndNonStopFilteringSwitchedOff()) {
      // disable filtering in view (render empty and only non stop nodes)
      return;
    }

    if (
      this.activeFilterSetting.filterAllEmptyNodes ||
      this.activeFilterSetting.filterAllNonStopNodes
    ) {
      this.activeFilterSetting.temporaryEmptyAndNonStopFilteringSwitchedOff = false;
      this.filterChanged();
    }
  }

  isTemporaryEmptyAndNonStopFilteringSwitchedOff(): boolean {
    return this.activeFilterSetting.temporaryEmptyAndNonStopFilteringSwitchedOff;
  }

  switchOffTemporaryEmptyAndNonStopFiltering() {
    if (
      this.activeFilterSetting.filterAllEmptyNodes ||
      this.activeFilterSetting.filterAllNonStopNodes
    ) {
      this.activeFilterSetting.temporaryEmptyAndNonStopFilteringSwitchedOff = true;
      this.filterChanged();
    }
  }

  resetTemporaryDisableFilteringOfItemsInView() {
    this.activeFilterSetting.isTemporaryDisableFilteringOfItemsInView = false;
  }

  isTemporaryDisableFilteringOfItemsInViewEnabled(): boolean {
    return this.activeFilterSetting.isTemporaryDisableFilteringOfItemsInView;
  }

  toggleTemporaryDisableFilteringOfItemsInView() {
    this.activeFilterSetting.isTemporaryDisableFilteringOfItemsInView =
      !this.activeFilterSetting.isTemporaryDisableFilteringOfItemsInView;
    this.filterChanged(false);
  }

  setFilterNodeLabels(labelIds: number[]) {
    this.activeFilterSetting.filterNodeLabels = labelIds;
    this.filterChanged();
  }

  setFilterNoteLabels(labelIds: number[]) {
    this.activeFilterSetting.filterNoteLabels = labelIds;
    this.filterChanged();
  }

  setFilterTrainrunLabels(labelIds: number[]) {
    this.activeFilterSetting.filterTrainrunLabels = labelIds;
    this.filterChanged();
  }

  getFilterNodeLabels(): number[] {
    return this.activeFilterSetting.filterNodeLabels;
  }

  getFilterNoteLabels(): number[] {
    return this.activeFilterSetting.filterNoteLabels;
  }

  getFilterTrainrunLabels(): number[] {
    return this.activeFilterSetting.filterTrainrunLabels;
  }

  checkFilterNode(node: Node): boolean {
    return this.checkFilterNodeLabels(node.getLabelIds());
  }

  enableFilterNotes() {
    this.activeFilterSetting.filterNotes = true;
    this.filterChanged();
  }

  disableFilterNotes() {
    this.activeFilterSetting.filterNotes = false;
    this.filterChanged();
  }

  isFilterNotesEnabled(): boolean {
    return this.activeFilterSetting.filterNotes;
  }

  isFilteringAllEmptyNodes(): boolean {
    return this.activeFilterSetting.filterAllEmptyNodes;
  }

  enableFilterAllEmptyNodes() {
    this.activeFilterSetting.filterAllEmptyNodes = true;
    this.filterChanged();
  }

  disableFilterAllEmptyNodes() {
    this.activeFilterSetting.filterAllEmptyNodes = false;
    this.filterChanged();
  }

  isFilteringAllNonStopNodes(): boolean {
    return this.activeFilterSetting.filterAllNonStopNodes;
  }

  enableFilterAllNonStopNodes() {
    this.activeFilterSetting.filterAllNonStopNodes = true;
    this.filterChanged();
  }

  disableFilterAllNonStopNodes() {
    this.activeFilterSetting.filterAllNonStopNodes = false;
    this.filterChanged();
  }

  filterTrainrunsection(trainrunSection: TrainrunSection): boolean {
    if (this.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      // disable filtering in view (render all objects)
      return true;
    }

    const filterSourceNode = this.checkFilterNode(trainrunSection.getSourceNode());
    const filterTragetNode = this.checkFilterNode(trainrunSection.getTargetNode());
    return (
      this.filterTrainrun(trainrunSection.getTrainrun()) && (filterSourceNode || filterTragetNode)
    );
  }

  filterNode(node: Node): boolean {
    if (this.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      // disable filtering in view (render all objects)
      return true;
    }

    /* Impelement user defined filtering */
    return (
      this.checkFilterNode(node) &&
      this.checkFilterNonStopNode(node) &&
      this.checkFilterEmptyNode(node)
    );
  }

  checkFilterNonStopNode(node: Node): boolean {
    if (this.isTemporaryEmptyAndNonStopFilteringSwitchedOff()) {
      // disable filtering in view (render empty and only non stop nodes)
      return true;
    }

    if (!this.checkFilterNode(node)) {
      return true;
    }

    if (!this.isFilteringAllNonStopNodes()) {
      return true;
    }

    return !node.isNonStopNode();
  }

  isJunctionNode(node: Node): boolean {
    const oppNodes: number[] = [];
    node.getPorts().forEach((p) => {
      if (this.filterTrainrun(p.getTrainrunSection().getTrainrun())) {
        const oppNode = node.getOppositeNode(p.getTrainrunSection());
        if (oppNodes.find((n) => n === oppNode.getId()) === undefined) {
          oppNodes.push(oppNode.getId());
        }
      }
    });
    return oppNodes.length > 2;
  }

  isNodeVisible(node: Node) {
    return this.filterNode(node);
  }

  checkFilterEmptyNode(node: Node): boolean {
    if (this.isTemporaryEmptyAndNonStopFilteringSwitchedOff()) {
      // disable filtering in view (render empty and only non stop nodes)
      return true;
    }

    if (!this.isFilteringAllEmptyNodes()) {
      return true;
    }

    let retVal = false;
    node.getPorts().forEach((p: Port) => {
      retVal = retVal || this.filterTrainrun(p.getTrainrunSection().getTrainrun());
    });
    return retVal;
  }

  filterTrainrun(trainrun: Trainrun): boolean {
    if (this.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      // disable filtering in view (render all objects)
      return true;
    }
    /* Impelement user defined filtering */
    const filterTrainrunSection = this.checkFilterTrainrunLabels(trainrun.getLabelIds());
    return (
      filterTrainrunSection &&
      this.isFilterTrainrunFrequencyEnabled(trainrun.getTrainrunFrequency()) &&
      this.isFilterTrainrunCategoryEnabled(trainrun.getTrainrunCategory()) &&
      this.isFilterTrainrunTimeCategoryEnabled(trainrun.getTrainrunTimeCategory()) &&
      this.isFilterDirectionEnabled(trainrun.getDirection())
    );
  }

  filterNote(note: Note): boolean {
    if (this.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      // disable filtering in view (render all objects)
      return true;
    }

    /* Impelement user defined filtering */
    const filter = this.checkFilterNoteLabels(note.getLabelIds());
    return !this.isFilterNotesEnabled() && filter;
  }

  clearFilterNodeLabels() {
    this.activeFilterSetting.filterNodeLabels = [];
    this.filterChanged();
  }

  clearDeletetFilterNodeLabels(deletetLabelIds: number[]) {
    deletetLabelIds.forEach((deletetLabelId) => {
      this.clearDeletetFilterNodeLabel(deletetLabelId);
    });
  }

  clearDeletetFilterNodeLabel(deletetLabelId: number) {
    this.activeFilterSetting.filterNodeLabels = this.activeFilterSetting.filterNodeLabels.filter(
      (labelId) => labelId !== deletetLabelId,
    );
    this.getFilterSettings().forEach((filterSetting) => {
      filterSetting.filterNodeLabels = filterSetting.filterNodeLabels.filter(
        (filterNodeId) => filterNodeId !== deletetLabelId,
      );
      this.deleteClearFilterSetting(filterSetting);
    });
  }

  clearFilterNoteLabels() {
    this.activeFilterSetting.filterNoteLabels = [];
    this.filterChanged();
  }

  clearDeletetFilterNoteLabels(deletetLabelIds: number[]) {
    deletetLabelIds.forEach((deletetLabelId) => {
      this.clearDeletetFilterNoteLabel(deletetLabelId);
    });
  }

  clearDeletetFilterNoteLabel(deletetLabelId: number) {
    this.activeFilterSetting.filterNoteLabels = this.activeFilterSetting.filterNoteLabels.filter(
      (labelId) => labelId !== deletetLabelId,
    );
    this.getFilterSettings().forEach((filterSetting) => {
      filterSetting.filterNoteLabels = filterSetting.filterNoteLabels.filter(
        (filterLabelId) => filterLabelId !== deletetLabelId,
      );
      this.deleteClearFilterSetting(filterSetting);
    });
  }

  clearFilterTrainrunLabels() {
    this.activeFilterSetting.filterTrainrunLabels = [];
    this.filterChanged();
  }

  clearDeletetFilterTrainrunLabels(deletetLabelIds: number[]) {
    deletetLabelIds.forEach((deletetLabelId) => {
      this.clearDeletetFilterTrainrunLabel(deletetLabelId);
    });
  }

  clearDeletetFilterTrainrunLabel(deletetLabelId: number) {
    this.activeFilterSetting.filterTrainrunLabels =
      this.activeFilterSetting.filterTrainrunLabels.filter((labelId) => labelId !== deletetLabelId);
    this.getFilterSettings().forEach((filterSetting) => {
      filterSetting.filterTrainrunLabels = filterSetting.filterTrainrunLabels.filter(
        (filterLabelId) => filterLabelId !== deletetLabelId,
      );
      this.deleteClearFilterSetting(filterSetting);
    });
  }

  deleteClearFilterSetting(filterSetting: FilterSetting) {
    const trainrunCategoriesLength = this.dataService.getTrainrunCategories().length;
    const frainrunFrequenciesLength = this.dataService.getTrainrunFrequencies().length;
    const trainrunTimeCategoryLength = this.dataService.getTrainrunTimeCategories().length;
    if (
      filterSetting.getId() !== this.getActiveFilterSettingId() &&
      filterSetting.isEmpty(
        trainrunCategoriesLength,
        frainrunFrequenciesLength,
        trainrunTimeCategoryLength,
      )
    ) {
      this.deleteFilterSetting(filterSetting.getId());
    }
  }

  isFilteringNodeLabels(): boolean {
    if (
      this.labelGroupService
        .getLabelGroupsFromLabelRef(LabelRef.Node)
        .find((grp: LabelGroup) => grp.getLogicalFilterOperator() !== LogicalFilterOperator.OR) !==
      undefined
    ) {
      return true;
    }
    return this.activeFilterSetting.filterNodeLabels.length > 0;
  }

  isFilteringNoteLabels(): boolean {
    if (
      this.labelGroupService
        .getLabelGroupsFromLabelRef(LabelRef.Note)
        .find((grp: LabelGroup) => grp.getLogicalFilterOperator() !== LogicalFilterOperator.OR) !==
      undefined
    ) {
      return true;
    }
    return this.activeFilterSetting.filterNoteLabels.length > 0;
  }

  isFilteringTrainrunLabels(): boolean {
    if (
      this.labelGroupService
        .getLabelGroupsFromLabelRef(LabelRef.Trainrun)
        .find((grp: LabelGroup) => grp.getLogicalFilterOperator() !== LogicalFilterOperator.OR) !==
      undefined
    ) {
      return true;
    }
    return this.activeFilterSetting.filterTrainrunLabels.length > 0;
  }

  getTimeDisplayPrecision(): number {
    return this.activeFilterSetting.timeDisplayPrecision;
  }

  setTimeDisplayPrecision(precision: number) {
    this.activeFilterSetting.timeDisplayPrecision = precision;
    this.filterChanged();
  }

  filterChanged(enforceIsTemporaryDisableFilteringOfItemsInView = true) {
    if (enforceIsTemporaryDisableFilteringOfItemsInView) {
      this.activeFilterSetting.isTemporaryDisableFilteringOfItemsInView = false;
    }
    this.filterSubject.next();
  }

  isFilterDirectionArrowsEnabled(): boolean {
    return this.activeFilterSetting.filterDirectionArrows;
  }

  enableFilterDirectionArrows() {
    this.activeFilterSetting.filterDirectionArrows = true;
    this.filterChanged();
  }

  disableFilterDirectionArrows() {
    this.activeFilterSetting.filterDirectionArrows = false;
    this.filterChanged();
  }

  isFilterAsymmetryArrowsEnabled(): boolean {
    return this.activeFilterSetting.filterAsymmetryArrows;
  }

  enableFilterAsymmetryArrows() {
    this.activeFilterSetting.filterAsymmetryArrows = true;
    this.filterChanged();
  }

  disableFilterAsymmetryArrows() {
    this.activeFilterSetting.filterAsymmetryArrows = false;
    this.filterChanged();
  }

  isFilterArrivalDepartureTimeEnabled(): boolean {
    return this.activeFilterSetting.filterArrivalDepartureTime;
  }

  enableFilterArrivalDepartureTime() {
    this.activeFilterSetting.filterArrivalDepartureTime = true;
    this.filterChanged();
  }

  disableFilterArrivalDepartureTime() {
    this.activeFilterSetting.filterArrivalDepartureTime = false;
    this.filterChanged();
  }

  isFilterShowNonStopTimeEnabled(): boolean {
    return this.activeFilterSetting.filterShowNonStopTime;
  }

  enableFilterShowNonStopTime() {
    this.activeFilterSetting.filterShowNonStopTime = true;
    this.filterChanged();
  }

  disableFilterShowNonStopTime() {
    this.activeFilterSetting.filterShowNonStopTime = false;
    this.filterChanged();
  }

  isFilterTravelTimeEnabled(): boolean {
    return this.activeFilterSetting.filterTravelTime;
  }

  enableFilterTravelTime() {
    this.activeFilterSetting.filterTravelTime = true;
    this.filterChanged();
  }

  disableFilterTravelTime() {
    this.activeFilterSetting.filterTravelTime = false;
    this.filterChanged();
  }

  isFilterTrainrunNameEnabled(): boolean {
    return this.activeFilterSetting.filterTrainrunName;
  }

  enableFilterTrainrunName() {
    this.activeFilterSetting.filterTrainrunName = true;
    this.filterChanged();
  }

  disableFilterTrainrunName() {
    this.activeFilterSetting.filterTrainrunName = false;
    this.filterChanged();
  }

  isFilterConnectionsEnabled(): boolean {
    return this.activeFilterSetting.filterConnections;
  }

  enableFilterConnections() {
    this.activeFilterSetting.filterConnections = true;
    this.filterChanged();
  }

  disableFilterConnections() {
    this.activeFilterSetting.filterConnections = false;
    this.filterChanged();
  }

  isFilterTrainrunCategoryEnabled(trainrunCategory: TrainrunCategory): boolean {
    const found = this.activeFilterSetting.filterTrainrunCategory.find(
      (element) => element.id === trainrunCategory.id,
    );
    return found !== undefined;
  }

  getAllVisibleTrainrunCategoryIds(): number[] {
    return this.activeFilterSetting.filterTrainrunCategory.map((element) => element.id);
  }

  enableFilterTrainrunCategory(trainrunCategory: TrainrunCategory) {
    this.activeFilterSetting.filterTrainrunCategory.push(trainrunCategory);
    this.filterChanged();
  }

  disableFilterTrainrunCategory(trainrunCategory: TrainrunCategory) {
    this.activeFilterSetting.filterTrainrunCategory =
      this.activeFilterSetting.filterTrainrunCategory.filter(
        (element) => element.id !== trainrunCategory.id,
      );
    this.filterChanged();
  }

  resetFilterTrainrunCategory() {
    this.activeFilterSetting.filterTrainrunCategory = this.dataService.getTrainrunCategories();
    this.filterChanged();
  }

  isFilterTrainrunFrequencyEnabled(trainrunFrequency: TrainrunFrequency): boolean {
    const found = this.activeFilterSetting.filterTrainrunFrequency.find(
      (element) => element.id === trainrunFrequency.id,
    );
    return found !== undefined;
  }

  enableFilterTrainrunFrequency(trainrunFrequency: TrainrunFrequency) {
    this.activeFilterSetting.filterTrainrunFrequency.push(trainrunFrequency);
    this.filterChanged();
  }

  disableFilterTrainrunFrequency(trainrunFrequency: TrainrunFrequency) {
    this.activeFilterSetting.filterTrainrunFrequency =
      this.activeFilterSetting.filterTrainrunFrequency.filter(
        (element) => element.id !== trainrunFrequency.id,
      );
    this.filterChanged();
  }

  resetFilterTrainrunFrequency() {
    this.activeFilterSetting.filterTrainrunFrequency = this.dataService.getTrainrunFrequencies();
    this.filterChanged();
  }

  isFilterTrainrunTimeCategoryEnabled(trainrunTimeCategory: TrainrunTimeCategory): boolean {
    const found = this.activeFilterSetting.filterTrainrunTimeCategory.find(
      (element) => element.id === trainrunTimeCategory.id,
    );
    return found !== undefined;
  }

  enableFilterTrainrunTimeCategory(trainrunTimeCategory: TrainrunTimeCategory) {
    this.activeFilterSetting.filterTrainrunTimeCategory.push(trainrunTimeCategory);
    this.filterChanged();
  }

  disableFilterTrainrunTimeCategory(trainrunTimeCategory: TrainrunTimeCategory) {
    this.activeFilterSetting.filterTrainrunTimeCategory =
      this.activeFilterSetting.filterTrainrunTimeCategory.filter(
        (element) => element.id !== trainrunTimeCategory.id,
      );
    this.filterChanged();
  }

  resetFilterTrainrunTimeCategory() {
    this.activeFilterSetting.filterTrainrunTimeCategory =
      this.dataService.getTrainrunTimeCategories();
    this.filterChanged();
  }

  isFilterDirectionEnabled(direction: Direction): boolean {
    return this.activeFilterSetting.filterDirection.includes(direction);
  }

  enableFilterDirection(direction: Direction) {
    if (!this.activeFilterSetting.filterDirection.includes(direction)) {
      this.activeFilterSetting.filterDirection.push(direction);
      this.filterChanged();
    }
  }

  disableFilterDirection(direction: Direction) {
    this.activeFilterSetting.filterDirection = this.activeFilterSetting.filterDirection.filter(
      (dir) => dir !== direction,
    );
    this.filterChanged();
  }

  resetFilterDirection() {
    this.activeFilterSetting.filterDirection = Object.values(Direction);
    this.filterChanged();
  }

  isAnyFilterActive(): boolean {
    return (
      !this.isDisplayFilteringActive() ||
      !this.isTrainrunFilteringActive() ||
      !this.isNodeFilteringActive() ||
      !(
        !this.isFilteringNodeLabels() &&
        !this.isFilteringNoteLabels() &&
        !this.isFilteringTrainrunLabels()
      )
    );
  }

  isTrainrunFilteringActive(): boolean {
    let isActive = true;
    this.dataService.getTrainrunFrequencies().forEach((freq: TrainrunFrequency) => {
      const isFilter = this.isFilterTrainrunFrequencyEnabled(freq);
      if (!isFilter) {
        isActive = false;
        return;
      }
    });
    this.dataService.getTrainrunCategories().forEach((cat: TrainrunCategory) => {
      const isFilter = this.isFilterTrainrunCategoryEnabled(cat);
      if (!isFilter) {
        isActive = false;
        return;
      }
    });
    this.dataService.getTrainrunTimeCategories().forEach((catTime: TrainrunTimeCategory) => {
      const isFilter = this.isFilterTrainrunTimeCategoryEnabled(catTime);
      if (!isFilter) {
        isActive = false;
        return;
      }
    });
    this.dataService.getDirections().forEach((direction: Direction) => {
      const isFilter = this.isFilterDirectionEnabled(direction);
      if (!isFilter) {
        isActive = false;
        return;
      }
    });
    return isActive;
  }

  isNodeFilteringActive(): boolean {
    return !this.isFilteringAllNonStopNodes() && !this.isFilteringAllEmptyNodes();
  }

  isDisplayFilteringActive(): boolean {
    return (
      !this.isFilterNotesEnabled() &&
      this.isFilterDirectionArrowsEnabled() &&
      this.isFilterAsymmetryArrowsEnabled() &&
      this.isFilterArrivalDepartureTimeEnabled() &&
      this.isFilterConnectionsEnabled() &&
      this.isFilterTrainrunNameEnabled() &&
      this.isFilterTravelTimeEnabled() &&
      this.isFilterShowNonStopTimeEnabled()
    );
  }

  resetFiltering() {
    this.activeFilterSetting = new FilterSetting();
    this.initializeFilterSetting(this.activeFilterSetting);
    this.filterChanged();
  }

  private checkFilterNodeLabels(labelIds: number[]): boolean {
    return this.filterLabels(labelIds, this.getFilterNodeLabels(), LabelRef.Node);
  }

  private checkFilterNoteLabels(labelIds: number[]): boolean {
    return this.filterLabels(labelIds, this.getFilterNoteLabels(), LabelRef.Note);
  }

  private checkFilterTrainrunLabels(labelIds: number[]): boolean {
    return this.filterLabels(labelIds, this.getFilterTrainrunLabels(), LabelRef.Trainrun);
  }

  private filterLabels(labelIds: number[], filterLabelIds: number[], labelRef: LabelRef): boolean {
    if (labelIds.length === 0) {
      return true;
    }
    const labelsFromEnvironment = this.labelService.getLabelsFromIds(labelIds);
    const labelsFromFilter = this.labelService.getLabelsFromIds(filterLabelIds);
    const uniqueLabelGroupsFilter = labelsFromFilter
      .map((label: Label) => label.getLabelGroupId())
      .filter((v, i, a) => a.indexOf(v) === i);

    this.labelGroupService.getLabelGroupsFromLabelRef(labelRef).forEach((grp: LabelGroup) => {
      if (grp.getLogicalFilterOperator() === LogicalFilterOperator.AND) {
        if (!uniqueLabelGroupsFilter.includes(grp.getId())) {
          uniqueLabelGroupsFilter.push(grp.getId());
        }
      }
    });

    let doFiltering = true;
    uniqueLabelGroupsFilter.forEach((grpId: number) => {
      const groupOfInterest = this.labelGroupService.getLabelGroup(grpId);
      const groupedLabelsFromEnvironment = labelsFromEnvironment.filter(
        (l: Label) => l.getLabelGroupId() === grpId,
      );
      const groupedLabelsFromFilter = labelsFromFilter.filter(
        (l: Label) => l.getLabelGroupId() === grpId,
      );

      if (groupOfInterest.getLogicalFilterOperator() === LogicalFilterOperator.OR) {
        if (groupedLabelsFromEnvironment.length > 0) {
          doFiltering =
            doFiltering &&
            groupedLabelsFromEnvironment.filter((value) => !groupedLabelsFromFilter.includes(value))
              .length > 0;
        }
      } else {
        const groupedLabelsAllMinusFilter = this.labelService
          .getLabelsFromLabelGroupId(grpId)
          .filter((grp) => !groupedLabelsFromFilter.includes(grp));
        doFiltering =
          doFiltering &&
          groupedLabelsFromEnvironment.filter(
            (value) => groupedLabelsAllMinusFilter.indexOf(value) !== -1,
          ).length === groupedLabelsAllMinusFilter.length;
      }
    });
    return doFiltering;
  }

  private initializeFilterSetting(filterSetting: FilterSetting) {
    if (filterSetting !== undefined) {
      if (filterSetting.filterTrainrunCategory === null) {
        filterSetting.filterTrainrunCategory = this.dataService.getTrainrunCategories();
      }
      if (filterSetting.filterTrainrunFrequency === null) {
        filterSetting.filterTrainrunFrequency = this.dataService.getTrainrunFrequencies();
      }
      if (filterSetting.filterTrainrunTimeCategory === null) {
        filterSetting.filterTrainrunTimeCategory = this.dataService.getTrainrunTimeCategories();
      }
      if (filterSetting.filterDirection === null) {
        filterSetting.filterDirection = this.dataService.getDirections();
      }
    }
  }
}
