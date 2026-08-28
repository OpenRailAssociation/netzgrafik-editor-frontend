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

### Release branches

After a release is published and some `feat` commits have been merged to `main`, release-please will update its pull request to a new major or minor version. However, to ship bug fixes to users in a timely manner, it may be desirable to cut a new patch release with a subset of the merged commits (e.g. only `fix` commits). For instance, after v2.11.0 has been published, release-please may open a pull request for v2.12.0 with all unreleased commits sitting in `main`, while maintainers may wish to release v2.11.1 with a handful of bug fixes.

In this situation, a release branch needs to be created. The release branch needs to be based on the last release's Git tag and be named `vX.Y` (a `v` prefix, followed by major and minor numbers separated by a dot). Then bug fix commits can be cherry-picked from `main` and submitted via a pull request targeting the release branch. Once that's done, release-please will create a new pull request to publish a new patch release.

Here is an example for an hypothetical v2.11.1 patch release:

```sh
# Create the v2.11 branch based off of the v2.11.0 tag
git switch -c v2.11 netzgrafik-editor-frontend-v2.11.0
git push

# Backport some commits to the release branch: create a new branch based off of
# v2.11, copy over two bug fixes (-x records the original commit hash), then
# push and open a pull request (select "v2.11" in the "base" field)
git switch -c adrian/v2.11-backports v2.11
git cherry-pick -x 0b61263dcb8e 161e03596824
git push
```
