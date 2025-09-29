import {LabelGroupDto, LabelRef} from "../data-structures/business.data.structures";

export enum LogicalFilterOperator {
  OR,
  AND,
}

export class LabelGroup {
  private static defaultGroupName = "Standard";
  private static currentId = 0;
  private id: number;
  private name: string;
  private labelRef: LabelRef;
  private logicalFilterOperator: LogicalFilterOperator = LogicalFilterOperator.OR;

  constructor(
    {id, name, labelRef}: LabelGroupDto = {
      id: LabelGroup.incrementId(),
      name: LabelGroup.defaultGroupName,
      labelRef: LabelRef.Undefinded,
    },
  ) {
    this.id = id;
    this.name = name;
    this.labelRef = labelRef;
    if (LabelGroup.currentId < this.id) {
      LabelGroup.currentId = this.id;
    }
    this.enableLogicalFilterOperatorOr();
  }

  private static incrementId(): number {
    return ++LabelGroup.currentId;
  }

  enableLogicalFilterOperatorAnd() {
    this.logicalFilterOperator = LogicalFilterOperator.AND;
  }

  enableLogicalFilterOperatorOr() {
    this.logicalFilterOperator = LogicalFilterOperator.OR;
  }

  getLogicalFilterOperator(): LogicalFilterOperator {
    return this.logicalFilterOperator;
  }

  getId(): number {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  setName(name: string) {
    this.name = name;
  }

  getLabelRef(): LabelRef {
    return this.labelRef;
  }

  setLabelRef(labelRef: LabelRef) {
    this.labelRef = labelRef;
  }

  getDto(): LabelGroupDto {
    return {
      id: this.id,
      name: this.name,
      labelRef: this.labelRef,
    };
  }
}
