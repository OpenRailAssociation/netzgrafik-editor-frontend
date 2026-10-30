import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from "@angular/core";
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {
  HardConstraintConfig,
  HardConstraintId,
  ObjectiveConfig,
  OptimizationPolicy,
} from "../../../services/optimization/optimization-policy.model";

@Component({
  selector: "sbb-optimization-director",
  templateUrl: "./optimization-director.component.html",
  styleUrls: ["./optimization-director.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class OptimizationDirectorComponent {
  @Input({required: true}) policy: OptimizationPolicy;
  @Output() policyChange = new EventEmitter<OptimizationPolicy>();

  get orderedObjectives(): ObjectiveConfig[] {
    return [...this.policy.objectives].sort((a, b) => a.priority - b.priority);
  }

  setConstraintEnabled(id: HardConstraintId, enabled: boolean): void {
    this.updatePolicy({
      ...this.policy,
      hardConstraints: this.policy.hardConstraints.map((constraint) =>
        constraint.id === id && !constraint.mandatory ? {...constraint, enabled} : constraint,
      ),
    });
  }

  setConstraintValue(constraint: HardConstraintConfig, value: number): void {
    const minimum = constraint.id === "trackLimit" ? 1 : 0;
    const maximum = constraint.id === "maxTravelTimeExtension" ? 99 : Number.POSITIVE_INFINITY;
    const normalizedValue = Math.min(maximum, Math.max(minimum, Math.floor(value || 0)));
    this.updatePolicy({
      ...this.policy,
      hardConstraints: this.policy.hardConstraints.map((item) =>
        item.id === constraint.id ? {...item, value: normalizedValue} : item,
      ),
    });
  }

  adjustConstraintValue(constraint: HardConstraintConfig, adjustment: -1 | 1): void {
    this.setConstraintValue(constraint, (constraint.value ?? 0) + adjustment);
  }

  setObjectiveEnabled(objective: ObjectiveConfig, enabled: boolean): void {
    this.updatePolicy({
      ...this.policy,
      objectives: this.policy.objectives.map((item) =>
        item.id === objective.id ? {...item, enabled} : item,
      ),
    });
  }

  preventCheckboxDrag(event: MouseEvent | TouchEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest(".sbb-selection-container")) {
      event.stopPropagation();
    }
  }

  dropObjective(event: CdkDragDrop<ObjectiveConfig[]>): void {
    const objectives = this.orderedObjectives;
    moveItemInArray(objectives, event.previousIndex, event.currentIndex);
    this.updateObjectives(objectives);
  }

  moveObjective(index: number, direction: -1 | 1): void {
    const objectives = this.orderedObjectives;
    const target = index + direction;
    if (target < 0 || target >= objectives.length) {
      return;
    }
    moveItemInArray(objectives, index, target);
    this.updateObjectives(objectives);
  }

  private updateObjectives(objectives: ObjectiveConfig[]): void {
    this.updatePolicy({
      ...this.policy,
      objectives: objectives.map((objective, priority) => ({...objective, priority})),
    });
  }

  private updatePolicy(policy: OptimizationPolicy): void {
    this.policyChange.emit(policy);
  }
}
