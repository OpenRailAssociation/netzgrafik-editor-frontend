import type {UserConfig} from "@commitlint/types";
import {RuleConfigSeverity} from "@commitlint/types";

const Configuration: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      RuleConfigSeverity.Error,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore"],
    ],
    "subject-case": [RuleConfigSeverity.Disabled],
    "subject-empty": [RuleConfigSeverity.Error, "never"],
    "subject-full-stop": [RuleConfigSeverity.Error, "never", "."],
    "type-empty": [RuleConfigSeverity.Error, "never"],
    "type-case": [RuleConfigSeverity.Error, "always", "lower-case"],
  },
};

export default Configuration;
