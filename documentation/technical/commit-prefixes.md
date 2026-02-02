# Commit Message Prefixes – Short Documentation

## Purpose

This document defines standardized commit prefixes for all projects. They make the Git history easier to read, improve traceability, and support automated tools such as release‑note generators.

## Commit Prefixes

| Prefix   | Meaning                                    | Example                                   |
| -------- | ------------------------------------------ | ----------------------------------------- |
| feat     | Introduces a new feature                   | `feat: add user profile page`             |
| fix      | Fixes a bug                                | `fix: handle null value in parser`        |
| docs     | Documentation changes only                 | `docs: update API usage section`          |
| style    | Formatting, whitespace, no logic changes   | `style: format code with prettier`        |
| refactor | Code restructuring without behavior change | `refactor: simplify validation logic`     |
| perf     | Performance improvements                   | `perf: reduce query time by adding index` |
| test     | Adding or updating tests                   | `test: add tests for login flow`          |
| build    | Build system or dependency changes         | `build: update webpack config`            |
| ci       | CI/CD configuration changes                | `ci: add commitlint to PR workflow`       |
| chore    | Maintenance tasks, cleanup, meta changes   | `chore: remove unused files`              |

## Scoped commits allowed - example

fix(api): correct response format
docs(video): add link to tutorial
feat(auth): add token refresh
test(parser): add edge case tests
