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

abstract class Operation {
  readonly type: OperationType;
  readonly objectType: OperationObjectType;

  constructor(type: OperationType, objectType: OperationObjectType) {
    this.type = type;
    this.objectType = objectType;
  }
}

class TrainrunOperation extends Operation {
  readonly trainrun: TrainrunDto;

  /** @internal */
  constructor(operationType: OperationType, trainrun: Trainrun) {
    super(operationType, OperationObjectType.trainrun);
    this.trainrun = trainrun.getDto();
  }
}

class NodeOperation extends Operation {
  readonly node: NodeDto;

  /** @internal */
  constructor(operationType: OperationType, node: Node) {
    super(operationType, OperationObjectType.node);
    this.node = node.getDto();
  }
}

class LabelOperation extends Operation {
  readonly label: LabelDto;

  /** @internal */
  constructor(operationType: OperationType, label: Label) {
    super(operationType, OperationObjectType.label);
    this.label = label.getDto();
  }
}

class NoteOperation extends Operation {
  readonly note: FreeFloatingTextDto;

  /** @internal */
  constructor(operationType: OperationType, note: Note) {
    super(operationType, OperationObjectType.note);
    this.note = note.getDto();
  }
}

class MetadataOperation extends Operation {
  readonly metadata: MetadataDto;

  /** @internal */
  constructor(metadata: MetadataDto) {
    super(OperationType.update, OperationObjectType.metadata);
    this.metadata = metadata;
  }
}

class FilterSettingOperation extends Operation {
  readonly filterSetting: FilterSettingDto;

  /** @internal */
  constructor(filterSetting: FilterSettingDto) {
    super(OperationType.update, OperationObjectType.filterSetting);
    this.filterSetting = filterSetting;
  }
}

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
