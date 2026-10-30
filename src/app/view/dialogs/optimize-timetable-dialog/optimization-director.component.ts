import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from "@angular/core";
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {
  DIRECTOR_OBJECTIVE_ORDER,
  DirectorProfileId,
  HardConstraintConfig,
  HardConstraintId,
  ObjectiveConfig,
  OptimizationPolicy,
} from "../../../services/optimization/optimization-policy.model";

type DirectorProfile = {
  id: DirectorProfileId;
  title: string;
  description: string;
  ratings: Record<ObjectiveConfig["id"], number>;
};

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

  readonly ratingValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly profiles: DirectorProfile[] = [
    {
      id: "stability",
      title: "app.view.dialogs.optimize-timetable-dialog.director.profile.stability",
      description:
        "app.view.dialogs.optimize-timetable-dialog.director.profile.stability-description",
      ratings: {
        minimalChanges: 10,
        moreConnections: 6,
        lowerTravelTime: 6,
        lowerTrackUsage: 4,
        lowerEdgeTrackUsage: 4,
      },
    },
    {
      id: "connections",
      title: "app.view.dialogs.optimize-timetable-dialog.director.profile.connections",
      description:
        "app.view.dialogs.optimize-timetable-dialog.director.profile.connections-description",
      ratings: {
        minimalChanges: 6,
        moreConnections: 10,
        lowerTravelTime: 6,
        lowerTrackUsage: 4,
        lowerEdgeTrackUsage: 4,
      },
    },
    {
      id: "trackUsage",
      title: "app.view.dialogs.optimize-timetable-dialog.director.profile.track-usage",
      description:
        "app.view.dialogs.optimize-timetable-dialog.director.profile.track-usage-description",
      ratings: {
        minimalChanges: 6,
        moreConnections: 4,
        lowerTravelTime: 4,
        lowerTrackUsage: 10,
        lowerEdgeTrackUsage: 10,
      },
    },
  ];

  get isUserDefined(): boolean {
    return this.policy.mode === "userDefined";
  }

  get orderedObjectives(): ObjectiveConfig[] {
    return [...this.policy.objectives].sort((a, b) =>
      this.isUserDefined
        ? a.priority - b.priority
        : DIRECTOR_OBJECTIVE_ORDER.indexOf(a.id) - DIRECTOR_OBJECTIVE_ORDER.indexOf(b.id),
    );
  }

  setMode(userDefined: boolean): void {
    this.updatePolicy({...this.policy, mode: userDefined ? "userDefined" : "director"});
  }

  selectProfile(profileId: DirectorProfileId): void {
    const profile = this.profiles.find((item) => item.id === profileId);
    if (profile === undefined) {
      return;
    }
    this.updatePolicy({
      ...this.policy,
      directorProfile: profileId,
      objectives: this.policy.objectives.map((objective) => ({
        ...objective,
        rating: profile.ratings[objective.id],
      })),
    });
  }

  setObjectiveRating(objective: ObjectiveConfig, rating: number): void {
    const normalizedRating = Number.isFinite(rating)
      ? Math.max(1, Math.min(10, Math.floor(rating)))
      : 1;
    this.updatePolicy({
      ...this.policy,
      objectives: this.policy.objectives.map((item) =>
        item.id === objective.id ? {...item, rating: normalizedRating} : item,
      ),
    });
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
