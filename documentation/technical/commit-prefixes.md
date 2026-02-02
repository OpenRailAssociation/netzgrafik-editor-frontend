# Commit Message Prefixes – Short Documentation

## Purpose

This document defines standardized commit prefixes for all projects. They make the Git history easier to read, improve traceability, and support automated tools such as release‑note generators.

# Commit Message Prefixes {#commit-prefixes}

| Prefix   | Meaning                                                                                                       | Example                                   |
| -------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| feat     | A new user-visible feature                                                                                    | `feat: add user profile page`             |
| fix      | A bug fix, or preventing a future bug                                                                         | `fix: handle null value in parser`        |
| docs     | Documentation changes only                                                                                    | `docs: update API usage section`          |
| style    | Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)        | `style: format code with prettier`        |
| refactor | A code change that neither fixes a bug nor adds a feature (but could prepare the work for a following commit) | `refactor: simplify validation logic`     |
| perf     | A code change that improves performance                                                                       | `perf: reduce query time by adding index` |
| test     | Adding missing or update tests or correcting existing tests                                                   | `test: add tests for login flow`          |
| build    | Changes that affect the build system or external dependencies                                                 | `build: update webpack config`            |
| ci       | Changes to the CI configuration files and scripts                                                             | `ci: add commitlint to PR workflow`       |
| chore    | Maintenance tasks, cleanup, meta changes or dependencies update (mostly from dependabot and release-please)   | `chore: remove unused files`              |

Note: `feat!:`, or `fix!:`, `refactor!:`, etc., which represent a breaking change (indicated by the `!`).

## Scoped commits allowed - example

fix(api): correct response format
docs(video): add link to tutorial
feat(auth): add token refresh
test(parser): add edge case tests

## Fixing commit messages (step-by-step)

If a commit message does not follow the required prefix format, you can fix it using an interactive rebase.

1. Start an interactive rebase

```bash
git rebase -i HEAD~<n>
```

Replace <n> with the number of recent commits you want to edit (e.g., HEAD~3).

2. Mark commits to be edited
   In the editor, change pick to reword for each commit whose message you want to fix:

```bash
pick 1234567 docs: Commit Message Prefixes
reword 8901223 old commit message
```

4. Adjust the commit message
   Git will open an editor for each reword commit. Update the message to follow the prefix rules, for example:

```bash
feat: add user profile page
fix: handle null value in parser
refactor: simplify validation logic
```

5. Force-push the updated history
   After the rebase completes successfully, push the rewritten commits:
   Use `--force-with-lease` to avoid accidentally overwriting work from others:

```bash
git push --force-with-lease
```

Use force-push with care, especially on shared branches.
