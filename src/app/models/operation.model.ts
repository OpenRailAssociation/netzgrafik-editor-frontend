import {Node} from "./node.model";
import {Trainrun} from "./trainrun.model";
import {Label} from "./label.model";
import {Note} from "./note.model";
import {
  FreeFloatingTextDto,
  LabelDto,
  NodeDto,
  TrainrunDto,
} from "../data-structures/business.data.structures";

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
}

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

  constructor(operationType: OperationType, trainrun: Trainrun) {
    super(operationType, OperationObjectType.trainrun);
    this.trainrun = trainrun.getDto();
  }
}

class NodeOperation extends Operation {
  readonly node: NodeDto;

  constructor(operationType: OperationType, node: Node) {
    super(operationType, OperationObjectType.node);
    this.node = node.getDto();
  }
}

class LabelOperation extends Operation {
  readonly label: LabelDto;

  constructor(operationType: OperationType, label: Label) {
    super(operationType, OperationObjectType.label);
    this.label = label.getDto();
  }
}

class NoteOperation extends Operation {
  readonly note: FreeFloatingTextDto;

  constructor(operationType: OperationType, note: Note) {
    super(operationType, OperationObjectType.note);
    this.note = note.getDto();
  }
}

export {OperationType, Operation, TrainrunOperation, NodeOperation, LabelOperation, NoteOperation};
