# Continuous Integration

This repository uses [release-please](https://github.com/googleapis/release-please) for CHANGELOG generation, the creation of GitHub releases, and version bumps
for your projects.

It maintains [Release PRs](https://github.com/googleapis/release-please?tab=readme-ov-file#whats-a-release-pr).

We use [Manifest Driven release-please](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md).
It uses source-controlled files containing

- releaser specific configuration ([release-please-config.json](release-please-config.json))
- package version tracking ([.release-please-manifest.json](.release-please-manifest.json)).

See [release-please CLI documentation](https://github.com/googleapis/release-please/blob/main/docs/cli.md) for more details.

### FAQ

- [How do I change the version number?](https://github.com/googleapis/release-please?tab=readme-ov-file#how-do-i-change-the-version-number)
