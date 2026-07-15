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

abstract class BaseOperation<O extends OperationObjectType> {
  readonly type: OperationType;
  readonly objectType: O;

  /** @internal */
  constructor(type: OperationType, objectType: O) {
    this.type = type;
    this.objectType = objectType;
  }
}

class TrainrunOperation extends BaseOperation<OperationObjectType.trainrun> {
  readonly trainrun: TrainrunDto;

  /** @internal */
  constructor(operationType: OperationType, trainrun: Trainrun) {
    super(operationType, OperationObjectType.trainrun);
    this.trainrun = trainrun.getDto();
  }
}

class NodeOperation extends BaseOperation<OperationObjectType.node> {
  readonly node: NodeDto;

  /** @internal */
  constructor(operationType: OperationType, node: Node) {
    super(operationType, OperationObjectType.node);
    this.node = node.getDto();
  }
}

class LabelOperation extends BaseOperation<OperationObjectType.label> {
  readonly label: LabelDto;

  /** @internal */
  constructor(operationType: OperationType, label: Label) {
    super(operationType, OperationObjectType.label);
    this.label = label.getDto();
  }
}

class NoteOperation extends BaseOperation<OperationObjectType.note> {
  readonly note: FreeFloatingTextDto;

  /** @internal */
  constructor(operationType: OperationType, note: Note) {
    super(operationType, OperationObjectType.note);
    this.note = note.getDto();
  }
}

class MetadataOperation extends BaseOperation<OperationObjectType.metadata> {
  readonly metadata: MetadataDto;

  /** @internal */
  constructor(metadata: MetadataDto) {
    super(OperationType.update, OperationObjectType.metadata);
    this.metadata = metadata;
  }
}

class FilterSettingOperation extends BaseOperation<OperationObjectType.filterSetting> {
  readonly filterSetting: FilterSettingDto;

  /** @internal */
  constructor(filterSetting: FilterSettingDto) {
    super(OperationType.update, OperationObjectType.filterSetting);
    this.filterSetting = filterSetting;
  }
}

type Operation =
  | TrainrunOperation
  | NodeOperation
  | LabelOperation
  | NoteOperation
  | MetadataOperation
  | FilterSettingOperation;

export {
  OperationType,
  Operation,
  TrainrunOperation,
  NodeOperation,
  LabelOperation,
  NoteOperation,
  MetadataOperation,
  FilterSettingOperation,
};
