import {Injectable} from "@angular/core";
import {
  createDefaultOptimizationPolicy,
  HardConstraintConfig,
  HardConstraintId,
  ObjectiveConfig,
  OptimizationPolicy,
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
    const hardConstraints: HardConstraintConfig[] = defaults.hardConstraints.map((defaultItem) => {
      const saved = policy?.hardConstraints?.find((item) => item.id === defaultItem.id);
      return {
        ...defaultItem,
        ...saved,
        enabled: defaultItem.mandatory ? true : (saved?.enabled ?? defaultItem.enabled),
      };
    });
    const objectives: ObjectiveConfig[] = defaults.objectives.map((defaultItem) => {
      const saved = policy?.objectives?.find((item) => item.id === defaultItem.id);
      return {...defaultItem, ...saved};
    });
    const order = new Map(
      [...objectives]
        .sort((a, b) => a.priority - b.priority)
        .map((objective, priority) => [objective.id, priority]),
    );
    objectives.forEach((objective) => (objective.priority = order.get(objective.id)));
    return {hardConstraints, objectives};
  }

  private clone(policy: OptimizationPolicy): OptimizationPolicy {
    return {
      hardConstraints: policy.hardConstraints.map((constraint) => ({...constraint})),
      objectives: policy.objectives.map((objective) => ({...objective})),
    };
  }
}
