import {Injectable, OnDestroy} from "@angular/core";
import {
  NetzgrafikDto,
  TrainrunCategory,
  Direction,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from "../../data-structures/business.data.structures";
import {NetzgrafikDefault} from "../../sample-netzgrafik/netzgrafik.default";
import {NodeService} from "./node.service";
import {TrainrunSectionService} from "./trainrunsection.service";
import {TrainrunService} from "./trainrun.service";
import {StammdatenService} from "./stammdaten.service";
import {Stammdaten} from "../../models/stammdaten.model";
import {ResourceService} from "./resource.service";
import {BehaviorSubject, combineLatest, Observable, Subject} from "rxjs";
import {debounceTime, map, skip, takeUntil} from "rxjs/operators";
import {NoteService} from "./note.service";
import {LabelService} from "./label.service";
import {LabelGroupService} from "./labelgroup.service";
import {DataMigration} from "../../utils/data-migration";
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "./netzgrafikColoring.service";
import {Trainrun} from "src/app/models/trainrun.model";

export class NetzgrafikLoadedInfo {
  constructor(
    public load: boolean,
    public preview: boolean,
  ) {}
}

@Injectable({
  providedIn: "root",
})
export class DataService implements OnDestroy {
  private netzgrafikDtoStore: {netzgrafikDto: NetzgrafikDto} = {
    netzgrafikDto: NetzgrafikDefault.getDefaultNetzgrafik(),
  };

  private destroyed = new Subject<void>();

  private readonly netzgrafikLoadedInfoSubject = new BehaviorSubject<NetzgrafikLoadedInfo>(
    new NetzgrafikLoadedInfo(true, false),
  );
  private readonly netzgrafikLoadedInfo = this.netzgrafikLoadedInfoSubject.asObservable();

  constructor(
    private resourceService: ResourceService,
    private nodeService: NodeService,
    private trainrunSectionService: TrainrunSectionService,
    private trainrunService: TrainrunService,
    private stammdatenService: StammdatenService,
    private noteService: NoteService,
    private labelService: LabelService,
    private labelGroupService: LabelGroupService,
    private filterService: FilterService,
    private netzgrafikColoringService: NetzgrafikColoringService,
  ) {
    this.trainrunService.setDataService(this);
    this.nodeService.setDataService(this);
    this.filterService.setDataService(this);
    this.stammdatenService.stammdatenObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((stammdaten: Stammdaten[]) => {
        this.nodeService.setNodePropertiesFromStammdaten(stammdaten);
      });
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  loadNetzgrafikDto(netzgrafikDto: NetzgrafikDto, preview = false) {
    this.netzgrafikLoadedInfoSubject.next(new NetzgrafikLoadedInfo(true, preview));

    DataMigration.migrateNetzgrafikDto(netzgrafikDto);

    this.netzgrafikDtoStore.netzgrafikDto = netzgrafikDto;
    this.resourceService.setResourceData(this.netzgrafikDtoStore.netzgrafikDto.resources);
    this.nodeService.setNodeData(this.netzgrafikDtoStore.netzgrafikDto.nodes);
    this.trainrunSectionService.setTrainrunSectionsDataAndValidate(
      this.netzgrafikDtoStore.netzgrafikDto.trainrunSections,
    );
    this.trainrunService.setTrainrunData(this.netzgrafikDtoStore.netzgrafikDto.trainruns);
    this.noteService.setNoteData(this.netzgrafikDtoStore.netzgrafikDto.freeFloatingTexts);
    this.labelService.setLabelData(this.netzgrafikDtoStore.netzgrafikDto.labels);
    this.labelGroupService.setLabelGroupData(this.netzgrafikDtoStore.netzgrafikDto.labelGroups);
    this.filterService.setFilterData(this.netzgrafikDtoStore.netzgrafikDto.filterData);
    this.netzgrafikColoringService.setNetzgrafikColors(
      this.netzgrafikDtoStore.netzgrafikDto.metadata.netzgrafikColors,
    );

    this.initializeDataServices();

    // Ensure that all trainrun sections have a consistent chain direction
    this.trainrunService.getTrainruns().forEach((trainrun) => {
      this.trainrunSectionService.enforceConsistentSectionDirection(trainrun.getId());
    });

    // This must be done due of the bug fix - ensure that each resource object
    // is used in the Netzgrafik
    // https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/522
    this.ensureAllResourcesLinkedToNetzgrafikObjects();

    this.netzgrafikLoadedInfoSubject.next(new NetzgrafikLoadedInfo(false, preview));
  }

  insertCopyNetzgrafikDto(netzgrafikDto: NetzgrafikDto, enforceUpdate = true) {
    this.nodeService.unselectAllNodes();
    const nodeMap = this.nodeService.mergeNodes(netzgrafikDto.nodes);
    const trainrunMap = this.trainrunService.createNewTrainrunsFromDtoList(netzgrafikDto.trainruns);
    const trainrunSectionMap = this.trainrunSectionService.createNewTrainrunSectionsFromDtoList(
      netzgrafikDto.trainrunSections,
      nodeMap,
      trainrunMap,
      netzgrafikDto.nodes,
      enforceUpdate,
    );
    this.nodeService.mergeLabelNode(netzgrafikDto, nodeMap);
    this.nodeService.mergeConnections(netzgrafikDto, trainrunSectionMap, nodeMap);
    if (enforceUpdate) {
      this.nodeService.connectionsUpdated();
      this.nodeService.transitionsUpdated();
    }
    this.trainrunService.mergeLabelTrainrun(netzgrafikDto, trainrunMap);
    this.noteService.createNewNoteFromDtoList(netzgrafikDto.freeFloatingTexts);
  }

  mergeNetzgrafikDto(netzgrafikDto: NetzgrafikDto) {
    this.nodeService.unselectAllNodes();
    const nodeMap = this.nodeService.mergeNodes(netzgrafikDto.nodes);
    const trainrunMap = this.trainrunService.mergeTrainruns(netzgrafikDto.trainruns);
    this.trainrunSectionService.mergeTrainrunSections(
      netzgrafikDto.trainrunSections,
      nodeMap,
      trainrunMap,
      netzgrafikDto.nodes,
    );
    this.nodeService.mergeLabelNode(netzgrafikDto, nodeMap);
    this.trainrunService.mergeLabelTrainrun(netzgrafikDto, trainrunMap);
  }

  initializeDataServices() {
    // do not change the order of the following initialization procedure
    this.trainrunSectionService.initializeTrainrunSectionsWithReferencesToNodesAndTrainruns();
    this.nodeService.initializePortsWithReferencesToTrainrunSections();
    this.nodeService.initializeTransitionsWithReferencesToTrainrun();
    this.nodeService.initPortOrdering();
    this.trainrunSectionService.initializeTrainrunSectionRouting();
    this.nodeService.validateAllConnections();
    this.trainrunService.propagateInitialConsecutiveTimes();
    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.nodeService.connectionsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    this.noteService.notesUpdated();
    this.labelService.labelUpdated();
    this.labelGroupService.labelGroupUpdated();

    this.netzgrafikColoringService.generateGlobalStyles(
      this.getTrainrunCategories(),
      this.trainrunSectionService.getTrainrunSections(),
    );
    this.netzgrafikColoringService.netzgrafikColorUpdated();
  }

  triggerViewUpdate() {
    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.nodeService.connectionsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    this.noteService.notesUpdated();
    this.labelService.labelUpdated();
    this.labelGroupService.labelGroupUpdated();
  }

  getNetzgrafikDto(): NetzgrafikDto {
    const metadata = this.netzgrafikDtoStore.netzgrafikDto.metadata;
    metadata.netzgrafikColors = this.netzgrafikColoringService.getDtos();

    return {
      nodes: this.nodeService.getDtos(),
      trainrunSections: this.trainrunSectionService.getDtos(),
      trainruns: this.trainrunService.getDtos(),
      resources: this.resourceService.getDtos(),
      metadata: metadata,
      freeFloatingTexts: this.noteService.getDtos(),
      labels: this.labelService.getDtos(),
      labelGroups: this.labelGroupService.getDtos(),
      filterData: this.filterService.getDtos(),
    };
  }

  getTrainruns(): Trainrun[] {
    return this.trainrunService.getTrainruns();
  }

  getTrainrunCategory(categoryId: number): TrainrunCategory {
    const found = this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunCategories.find(
      (trainrunCategory) => trainrunCategory.id === categoryId,
    );
    if (found === undefined) {
      return this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunCategories.find((freq) => true);
    }
    return found;
  }

  getTrainrunFrequency(frequencyId: number): TrainrunFrequency {
    const found = this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunFrequencies.find(
      (trainrunFrequency) => trainrunFrequency.id === frequencyId,
    );
    if (found === undefined) {
      return this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunFrequencies.find(
        (freq) => true,
      );
    }
    return found;
  }

  getTrainrunTimeCategory(timeCategoryId: number): TrainrunTimeCategory {
    const found = this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunTimeCategories.find(
      (trainrunTimeCategory) => trainrunTimeCategory.id === timeCategoryId,
    );
    if (found === undefined) {
      return this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunTimeCategories.find(
        (freq) => true,
      );
    }
    return found;
  }

  getTrainrunCategories(): TrainrunCategory[] {
    return this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunCategories;
  }

  getTrainrunFrequencies(): TrainrunFrequency[] {
    return this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunFrequencies;
  }

  getTrainrunTimeCategories(): TrainrunTimeCategory[] {
    return this.netzgrafikDtoStore.netzgrafikDto.metadata.trainrunTimeCategories;
  }

  getDirections(): Direction[] {
    return Object.values(Direction);
  }

  getBPStammdaten(betriebspunktName: string): Stammdaten {
    return this.stammdatenService.getBPStammdaten(betriebspunktName);
  }

  /**
   * Returns an observable that emits if the current NetzgrafikDto in the editor is modified by the user.
   *
   * @param changeTimeout time [ms] to await further changes before emitting a change event
   */
  getNetzgrafikChangesObservable(changeTimeout: number): Observable<void> {
    return combineLatest([
      this.nodeService.nodes,
      this.trainrunSectionService.trainrunSections,
      this.trainrunService.trainruns,
      this.stammdatenService.stammdatenObservable,
      this.resourceService.resourceObservable,
      this.noteService.notes,
      this.labelService.labels,
      this.labelGroupService.labelGroups,
      this.filterService.filterSetting,
    ]).pipe(
      skip(1),
      map(() => null),
      debounceTime(changeTimeout),
    );
  }

  getNetzgrafikLoadedInfo(): Observable<NetzgrafikLoadedInfo> {
    return this.netzgrafikLoadedInfo;
  }

  private ensureAllResourcesLinkedToNetzgrafikObjects() {
    // Ensures that a resource has exactly one node attached. This function is important
    // to maintain the relationship between the resource and the node correctly and to
    // avoid errors.
    // fix: https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/522
    const resIds: number[] = [];
    // collect all resource (attached to node)
    this.nodeService.getNodes().forEach((n) => {
      resIds.push(n.getResourceId());
    });
    // clean / fix resource objects which have no attechment.
    this.resourceService.clearUnlinkedResources(resIds);
  }
}
