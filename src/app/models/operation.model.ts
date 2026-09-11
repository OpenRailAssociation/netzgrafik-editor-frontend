import {Node} from "./node.model";
import {Trainrun} from "./trainrun.model";
import {Label} from "./label.model";
import {Note} from "./note.model";
import {
  FilterSettingDto,
  FreeFloatingTextDto,
  LabelDto,
  NodeDto,
  TrafficSide,
  TrainrunDto,
} from "../data-structures/business.data.structures";
import {OrderingAlgorithm} from "../data-structures/technical.data.structures";

enum OperationType {
  create = "create",
  update = "update",
  delete = "delete",
}

enum OperationObjectType {
  trainrun = "trainrun",
  node = "node",
  label = "label",
  note = "note",
  metadata = "metadata",
  filterSetting = "filterSetting",
}

type MetadataDto = {
  orderingAlgorithm?: OrderingAlgorithm;
  trafficSide?: TrafficSide;
};

abstract class BaseOperation<O extends OperationObjectType, T extends OperationType> {
  readonly type: T;
  readonly objectType: O;

  /** @internal */
  constructor(type: T, objectType: O) {
    this.type = type;
    this.objectType = objectType;
  }
}

abstract class TrainrunOperation<T extends OperationType> extends BaseOperation<
  OperationObjectType.trainrun,
  T
> {
  readonly trainrun: TrainrunDto;

  /** @internal */
  constructor(operationType: T, trainrun: Trainrun) {
    super(operationType, OperationObjectType.trainrun);
    this.trainrun = trainrun.getDto();
  }
}

type TrainrunUpdateTag =
  | "nodes"
  | "times"
  | "numberOfStops"
  | "name"
  | "categoryId"
  | "frequencyId"
  | "timeCategoryId"
  | "labelIds"
  | "direction";

class TrainrunUpdateOperation extends TrainrunOperation<OperationType.update> {
  readonly tags: TrainrunUpdateTag[];
  readonly oneWayDirection?: "forward" | "backward";
  constructor(
    trainrun: Trainrun,
    tags: TrainrunUpdateTag[],
    oneWayDirection?: "forward" | "backward",
  ) {
    super(OperationType.update, trainrun);
    this.tags = tags;
    this.oneWayDirection = oneWayDirection;
  }
}

class TrainrunCreateOperation extends TrainrunOperation<OperationType.create> {
  readonly duplicatedTrainrunId?: number;
  constructor(trainrun: Trainrun, duplicatedTrainrunId?: number) {
    super(OperationType.create, trainrun);
    this.duplicatedTrainrunId = duplicatedTrainrunId;
  }
}

class TrainrunDeleteOperation extends TrainrunOperation<OperationType.delete> {
  constructor(trainrun: Trainrun) {
    super(OperationType.delete, trainrun);
  }
}

class NodeOperation extends BaseOperation<OperationObjectType.node, OperationType> {
  readonly node: NodeDto;

  /** @internal */
  constructor(operationType: OperationType, node: Node) {
    super(operationType, OperationObjectType.node);
    this.node = node.getDto();
  }
}

class LabelOperation extends BaseOperation<OperationObjectType.label, OperationType> {
  readonly label: LabelDto;

  /** @internal */
  constructor(operationType: OperationType, label: Label) {
    super(operationType, OperationObjectType.label);
    this.label = label.getDto();
  }
}

class NoteOperation extends BaseOperation<OperationObjectType.note, OperationType> {
  readonly note: FreeFloatingTextDto;

  /** @internal */
  constructor(operationType: OperationType, note: Note) {
    super(operationType, OperationObjectType.note);
    this.note = note.getDto();
  }
}

class MetadataOperation extends BaseOperation<OperationObjectType.metadata, OperationType> {
  readonly metadata: MetadataDto;

  /** @internal */
  constructor(metadata: MetadataDto) {
    super(OperationType.update, OperationObjectType.metadata);
    this.metadata = metadata;
  }
}

class FilterSettingOperation extends BaseOperation<
  OperationObjectType.filterSetting,
  OperationType
> {
  readonly filterSetting: FilterSettingDto;

  /** @internal */
  constructor(filterSetting: FilterSettingDto) {
    super(OperationType.update, OperationObjectType.filterSetting);
    this.filterSetting = filterSetting;
  }
}

type Operation =
  | TrainrunUpdateOperation
  | TrainrunCreateOperation
  | TrainrunDeleteOperation
  | NodeOperation
  | LabelOperation
  | NoteOperation
  | MetadataOperation
  | FilterSettingOperation;

export {
  OperationType,
  Operation,
  TrainrunUpdateOperation,
  TrainrunCreateOperation,
  TrainrunDeleteOperation,
  NodeOperation,
  LabelOperation,
  NoteOperation,
  MetadataOperation,
  FilterSettingOperation,
};
