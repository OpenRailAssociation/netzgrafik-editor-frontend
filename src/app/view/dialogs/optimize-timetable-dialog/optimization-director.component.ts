import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from "@angular/core";
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {
  DIRECTOR_OBJECTIVE_ORDER,
  DirectorProfileId,
  DirectorModeSettings,
  HardConstraintConfig,
  HardConstraintId,
  ObjectiveConfig,
  OptimizationPolicy,
  OptimizationModeSettings,
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
  @Input() hasUnstoredPolicyChanges = false;
  @Output() policyChange = new EventEmitter<OptimizationPolicy>();
  @Output() storePolicyRequested = new EventEmitter<void>();
  @Output() resetRankingRequested = new EventEmitter<void>();

  readonly ratingValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly profiles: DirectorProfile[] = [
    {
      id: "stability",
      title: "app.view.dialogs.optimize-timetable-dialog.director.profile.stability",
      description:
        "app.view.dialogs.optimize-timetable-dialog.director.profile.stability-description",
      ratings: {
        minimalChanges: 10,
        connectionStability: 8,
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
        connectionStability: 6,
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
        connectionStability: 4,
        moreConnections: 4,
        lowerTravelTime: 4,
        lowerTrackUsage: 10,
        lowerEdgeTrackUsage: 10,
      },
    },
    {
      id: "flexibilityFrequencyFirst",
      title: "app.view.dialogs.optimize-timetable-dialog.director.profile.frequency-first",
      description:
        "app.view.dialogs.optimize-timetable-dialog.director.profile.frequency-first-description",
      ratings: {
        minimalChanges: 10,
        connectionStability: 8,
        moreConnections: 6,
        lowerTravelTime: 6,
        lowerTrackUsage: 4,
        lowerEdgeTrackUsage: 4,
      },
    },
    {
      id: "flexibilityCategoryFirst",
      title: "app.view.dialogs.optimize-timetable-dialog.director.profile.category-order-first",
      description:
        "app.view.dialogs.optimize-timetable-dialog.director.profile.category-order-first-description",
      ratings: {
        minimalChanges: 10,
        connectionStability: 8,
        moreConnections: 6,
        lowerTravelTime: 6,
        lowerTrackUsage: 4,
        lowerEdgeTrackUsage: 4,
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
    const mode = userDefined ? "userDefined" : "director";
    if (mode === this.policy.mode) {
      return;
    }

    const policy = this.withActiveSettingsSaved(this.policy);
    if (mode === "director") {
      const settings = policy.directorSettings ?? {
        directorProfile: policy.directorProfile,
        hardConstraints: policy.hardConstraints,
        objectives: policy.objectives,
      };
      this.updatePolicy({
        ...policy,
        mode,
        directorProfile: settings.directorProfile,
        hardConstraints: settings.hardConstraints,
        objectives: settings.objectives,
      });
    } else {
      const settings = policy.userDefinedSettings ?? {
        hardConstraints: policy.hardConstraints,
        objectives: policy.objectives,
      };
      this.updatePolicy({
        ...policy,
        mode,
        hardConstraints: settings.hardConstraints,
        objectives: settings.objectives,
      });
    }
  }

  selectProfile(profileId: DirectorProfileId): void {
    const profile = this.profiles.find((item) => item.id === profileId);
    if (profile === undefined) {
      return;
    }
    const flexible =
      profileId === "flexibilityFrequencyFirst" || profileId === "flexibilityCategoryFirst";
    this.updatePolicy({
      ...this.policy,
      directorProfile: profileId,
      hardConstraints: this.policy.hardConstraints.map((constraint) => {
        if (constraint.id === "timeLocks" || constraint.id === "travelTimeLocks") {
          return {...constraint, enabled: !flexible};
        }
        if (constraint.id === "maxTravelTimeExtension") {
          return {...constraint, enabled: flexible, value: 5};
        }
        return constraint;
      }),
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
    this.policyChange.emit(this.withActiveSettingsSaved(policy));
  }

  private withActiveSettingsSaved(policy: OptimizationPolicy): OptimizationPolicy {
    const settings: OptimizationModeSettings = {
      hardConstraints: policy.hardConstraints.map((constraint) => ({...constraint})),
      objectives: policy.objectives.map((objective) => ({...objective})),
    };
    if (policy.mode === "director") {
      const directorSettings: DirectorModeSettings = {
        ...settings,
        directorProfile: policy.directorProfile,
      };
      return {...policy, directorSettings};
    }
    return {...policy, userDefinedSettings: settings};
  }
}
