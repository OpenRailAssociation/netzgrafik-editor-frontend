import {Injectable} from "@angular/core";
import {
  createDefaultOptimizationPolicy,
  AdjustableParameterConfig,
  DirectorModeSettings,
  DirectorProfileId,
  HardConstraintConfig,
  HardConstraintId,
  ObjectiveConfig,
  OptimizationPolicy,
  OptimizationModeSettings,
  OPTIMIZATION_POLICY_STORAGE_KEY,
} from "./optimization-policy.model";

@Injectable({providedIn: "root"})
export class OptimizationPolicyService {
  private policyValue = this.loadPolicy();

  get policy(): OptimizationPolicy {
    return this.clone(this.policyValue);
  }

  storePolicy(policy: OptimizationPolicy): OptimizationPolicy {
    this.policyValue = this.normalize(policy);
    try {
      localStorage.setItem(OPTIMIZATION_POLICY_STORAGE_KEY, JSON.stringify(this.policyValue));
    } catch {
      // Keep the in-memory policy when browser storage is unavailable.
    }
    return this.policy;
  }

  resetPolicy(): OptimizationPolicy {
    return this.storePolicy(createDefaultOptimizationPolicy());
  }

  isEnabled(policy: OptimizationPolicy, id: HardConstraintId): boolean {
    return policy.hardConstraints.find((constraint) => constraint.id === id)?.enabled ?? false;
  }

  private loadPolicy(): OptimizationPolicy {
    try {
      const stored = localStorage.getItem(OPTIMIZATION_POLICY_STORAGE_KEY);
      return stored === null
        ? createDefaultOptimizationPolicy()
        : this.normalize(JSON.parse(stored) as OptimizationPolicy);
    } catch {
      return createDefaultOptimizationPolicy();
    }
  }

  private normalize(policy: OptimizationPolicy): OptimizationPolicy {
    const defaults = createDefaultOptimizationPolicy();
    const mode = policy?.mode === "userDefined" ? "userDefined" : "director";
    const hasModeSettings =
      policy?.directorSettings !== undefined || policy?.userDefinedSettings !== undefined;
    const directorSource =
      mode === "director"
        ? policy
        : (policy?.directorSettings ?? {
            ...defaults.directorSettings,
            directorProfile: policy?.directorProfile ?? defaults.directorProfile,
          });
    const userDefinedSource =
      mode === "userDefined"
        ? policy
        : (policy?.userDefinedSettings ?? defaults.userDefinedSettings);
    const legacyConnectionTimes =
      !hasModeSettings && mode === "userDefined"
        ? policy?.hardConstraints?.find((constraint) => constraint.id === "preserveConnectionTimes")
        : undefined;

    const normalizeProfile = (profile: DirectorProfileId | undefined): DirectorProfileId => {
      const savedProfile =
        profile === "flexibility" || profile === "frequencyFirst"
          ? "flexibilityFrequencyFirst"
          : profile;
      const profiles: DirectorProfileId[] = [
        "stability",
        "connections",
        "trackUsage",
        "flexibilityFrequencyFirst",
        "flexibilityCategoryFirst",
      ];
      return profiles.includes(savedProfile) ? savedProfile : defaults.directorProfile;
    };
    const normalizeHardConstraints = (settings: OptimizationModeSettings): HardConstraintConfig[] =>
      defaults.hardConstraints.map((defaultItem) => {
        const saved = settings?.hardConstraints?.find((item) => item.id === defaultItem.id);
        return {
          ...defaultItem,
          ...saved,
          name: defaultItem.name,
          enabled: defaultItem.mandatory ? true : (saved?.enabled ?? defaultItem.enabled),
        };
      });
    const normalizeAdjustableParameters = (
      settings: OptimizationModeSettings,
    ): AdjustableParameterConfig[] =>
      defaults.adjustableParameters.map((defaultItem) => {
        const saved = settings?.adjustableParameters?.find((item) => item.id === defaultItem.id);
        const legacyConstraints =
          (settings?.hardConstraints as Array<{
            id: string;
            enabled: boolean;
            value?: number;
          }>) ?? [];
        const legacySaved = legacyConstraints.find((item) => item.id === defaultItem.id);
        const legacyLocks = legacyConstraints.find((item) => item.id === "timeLocks");
        const legacyTravelLocks = legacyConstraints.find((item) => item.id === "travelTimeLocks");
        const migratedLegacy =
          defaultItem.id === "ignoreDepartureLocks" || defaultItem.id === "ignoreArrivalLocks"
            ? legacyLocks === undefined
              ? undefined
              : {enabled: !legacyLocks.enabled}
            : defaultItem.id === "ignoreTravelTimeLocks"
              ? legacyTravelLocks === undefined
                ? undefined
                : {enabled: !legacyTravelLocks.enabled}
              : legacySaved;
        return {...defaultItem, ...migratedLegacy, ...saved, name: defaultItem.name};
      });
    const normalizeObjectives = (
      settings: OptimizationModeSettings,
      settingsMode: "director" | "userDefined",
      legacyConnectionEnabled?: boolean,
    ): ObjectiveConfig[] => {
      const objectives = defaults.objectives.map((defaultItem) => {
        const saved = settings?.objectives?.find((item) => item.id === defaultItem.id);
        const legacyConnectionStability =
          defaultItem.id === "connectionStability" ? legacyConnectionEnabled : undefined;
        const rating =
          typeof saved?.rating === "number" && Number.isFinite(saved.rating)
            ? Math.max(1, Math.min(10, Math.floor(saved.rating)))
            : defaultItem.rating;
        const enabled =
          settingsMode === "director"
            ? true
            : (saved?.enabled ?? legacyConnectionStability ?? defaultItem.enabled);
        return {...defaultItem, ...saved, name: defaultItem.name, enabled, rating};
      });
      const order = new Map(
        [...objectives]
          .sort((a, b) => a.priority - b.priority)
          .map((objective, priority) => [objective.id, priority]),
      );
      objectives.forEach((objective) => (objective.priority = order.get(objective.id)));
      return objectives;
    };

    const directorSettings: DirectorModeSettings = {
      directorProfile: normalizeProfile(directorSource?.directorProfile),
      hardConstraints: normalizeHardConstraints(directorSource),
      adjustableParameters: normalizeAdjustableParameters(directorSource),
      objectives: normalizeObjectives(directorSource, "director"),
    };
    const userDefinedSettings: OptimizationModeSettings = {
      hardConstraints: normalizeHardConstraints(userDefinedSource),
      adjustableParameters: normalizeAdjustableParameters(userDefinedSource),
      objectives: normalizeObjectives(
        userDefinedSource,
        "userDefined",
        legacyConnectionTimes?.enabled,
      ),
    };
    const activeSettings = mode === "director" ? directorSettings : userDefinedSettings;
    return {
      mode,
      directorProfile: directorSettings.directorProfile,
      hardConstraints: activeSettings.hardConstraints.map((constraint) => ({...constraint})),
      adjustableParameters: activeSettings.adjustableParameters.map((parameter) => ({
        ...parameter,
      })),
      objectives: activeSettings.objectives.map((objective) => ({...objective})),
      directorSettings,
      userDefinedSettings,
    };
  }

  private clone(policy: OptimizationPolicy): OptimizationPolicy {
    return {
      mode: policy.mode,
      directorProfile: policy.directorProfile,
      hardConstraints: policy.hardConstraints.map((constraint) => ({...constraint})),
      adjustableParameters: policy.adjustableParameters.map((parameter) => ({...parameter})),
      objectives: policy.objectives.map((objective) => ({...objective})),
      directorSettings:
        policy.directorSettings === undefined
          ? undefined
          : {
              directorProfile: policy.directorSettings.directorProfile,
              hardConstraints: policy.directorSettings.hardConstraints.map((constraint) => ({
                ...constraint,
              })),
              adjustableParameters: policy.directorSettings.adjustableParameters.map(
                (parameter) => ({
                  ...parameter,
                }),
              ),
              objectives: policy.directorSettings.objectives.map((objective) => ({...objective})),
            },
      userDefinedSettings:
        policy.userDefinedSettings === undefined
          ? undefined
          : {
              hardConstraints: policy.userDefinedSettings.hardConstraints.map((constraint) => ({
                ...constraint,
              })),
              adjustableParameters: policy.userDefinedSettings.adjustableParameters.map(
                (parameter) => ({...parameter}),
              ),
              objectives: policy.userDefinedSettings.objectives.map((objective) => ({
                ...objective,
              })),
            },
    };
  }
}
