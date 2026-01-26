import type {UserConfig} from "@commitlint/types";
import {RuleConfigSeverity} from "@commitlint/types";

const Configuration: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      RuleConfigSeverity.Error,
      "always",
      [
        "feat", // A new feature
        "fix", // A bug fix
        "docs", // Documentation only changes
        "style", // Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
        "refactor", // A code change that neither fixes a bug nor adds a feature
        "perf", // A code change that improves performance
        "test", // Adding missing tests or correcting existing tests
        "build", // Changes that affect the build system or external dependencies
        "ci", // Changes to the CI configuration files and scripts
        "chore", // Other changes that don't modify src or test files
      ],
    ],
    "subject-case": [RuleConfigSeverity.Disabled],
    "subject-empty": [RuleConfigSeverity.Error, "never"],
    "subject-full-stop": [RuleConfigSeverity.Error, "never", "."],
    "type-empty": [RuleConfigSeverity.Error, "never"],
    "type-case": [RuleConfigSeverity.Error, "always", "lower-case"],
  },
};

export default Configuration;
