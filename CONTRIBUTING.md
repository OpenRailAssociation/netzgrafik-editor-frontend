# Contributing

We appreciate all kinds of contributions. The following is a set of guidelines for contributing to this repository on GitHub.
These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

By submitting a contribution to this repository you agree that you do this under the [license](LICENSE) of the repository and certify that you have all the rights to do so.

#### Table Of Contents

[Code of Conduct](#code-of-conduct)

[I just have a question!](#i-just-have-a-question)

[What should I know before I get started?](#what-should-i-know-before-i-get-started)

- [Tools and Packages](#tools-and-packages)
- [Design Decisions](#design-decisions)

[How Can I Contribute?](#how-can-i-contribute)

- [Issues and Bugs](#issue)
- [Feature Requests](#feature)
- [Pull Requests Guidelines](#submit-pr)
- [Your First Code Contribution](#your-first-code-contribution)
- [Coding Rules](#rules)
- [Commit Message Guidelines](#commit)

<a id="code-of-conduct"></a>

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code.

<a id="i-just-have-a-question"></a>

## I just have a question!

Please ask the questions in the discussions page.

- [Github Discussions, the official message board](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/discussions)

## <a id="what-should-i-know-before-i-get-started"></a> What should I know before I get started?

### <a id="tools-and-packages"></a> Tools and Packages

This project is based on Angular and uses the [SBB Angular Library](https://github.com/sbb-design-systems/sbb-angular).

For getting a development environment up and running you either need to have Node installed locally or you can use the provided `docker-compose.yml` file.
The Angular frontend depends on the backed in the [netzgrafik-editor-backend](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-backend), so you also need to start the backend components.

### <a id="design-decisions"></a> Design Decisions

Have a look at [DATA_MODEL.md](documentation/DATA_MODEL.md)

## <a id="issue"></a> Found an Issue?

If you find a bug in the source code or a mistake in the documentation, you can help us by
[submitting an issue](#submit-issue) to our [GitHub Repository](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/new). Including an issue
reproduction (via StackBlitz, JsBin, Plunkr, etc.) is the absolute best way to help the team quickly
diagnose the problem. Screenshots are also helpful.

You can help the team even more and [submit a Pull Request](#submit-pr) with a fix.

## <a id="feature"></a> Want a Feature?

You can _request_ a new feature by [submitting an issue](#submit-issue)
to our [GitHub Repository](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/new).
If you would like to _implement_ a new feature, please submit an issue with
a proposal for your work first, to be sure that we can use it.
Please consider what kind of change it is:

- For a **Major Feature**, first open an issue and outline your proposal so that it can be
  discussed. This will also allow us to better coordinate our efforts, prevent duplication of work,
  and help you to craft the change so that it is successfully accepted into the project.
- **Small Features** can be crafted and directly [submitted as a Pull Request](#submit-pr).

### <a id="submit-issue"></a> Submitting an Issue

If your issue appears to be a bug, and hasn't been reported, open a new issue.
Providing the following information will increase the
chances of your issue being dealt with quickly:

- **Overview of the Issue** - if an error is being thrown a non-minified stack trace helps
- **Toolchain and Environment Details** - which versions of libraries, toolchain, platform etc
- **Motivation for or Use Case** - explain what are you trying to do and why the current behavior
  is a bug for you
- **Browsers and Operating System** - is this a problem with all browsers?
- **Reproduce the Error** - provide a live example (using StackBlitz or similar) or a unambiguous set of steps
- **Screenshots** - myybe screenshots can help the team
  triage issues far more quickly than a text description.
- **Related Issues** - has a similar issue been reported before?
- **Suggest a Fix** - if you can't fix the bug yourself, perhaps you can point to what might be
  causing the problem (line of code or commit)

You can file new issues by providing the above information [here](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/new).

To be able to quickly address issues, we strive to organize issues with types and labels.

#### Types

Types (coming from OpenRailAssociation organization):

| Type      | Corresponding issues                                                                                                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Bug`     | Bugs (⚠️ need to also set the `bug:{severity}` label) (Issue template is "Bug")                                                                                                                                                                                       |
| `Enabler` | Enablers:<br>- technical<br>- data model evolution                                                                                                                                                                                                                    |
| `Feature` | - Feature proposal (= design document): problem with the solution to implement (Issue template is "Design Document")<br>- Feature request: problem to solve, mostly from external users (Issue template is "Feature Request")<br>- Enhancement of an existing feature |
| `Refacto` | - Technical chores (dependency issues, ...)<br>- Code quality<br>- Technical enhancements                                                                                                                                                                             |
| `Task`    | Subdivision of a larger Feature                                                                                                                                                                                                                                       |

#### Labels

Labels (coming from [OpenRailAssociation/netzgrafik-editor-frontend](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend) (see already existing [NGE's labels](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/labels) and [OSRD's labels](https://github.com/OpenRailAssociation/osrd/labels?page=1)):

| Label              | Description                                                                                                                                                                                                        | Examples                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `area:view`        | Actual components ("visual" stuff)                                                                                                                                                                                 | - `src/app/view/*`<br>- `src/app/perlenkette/perlenkette-section`                                                                       |
| `area:services`    | Services, helpers, utils and i18n ("logical" stuff)                                                                                                                                                                | - `src/app/services/*`<br>- `src/app/utils/*`<br>- `src/app/perlenkette/service`                                                        |
| `area:data-model`  | Data models and structures                                                                                                                                                                                         | - `src/app/data-structures/*`<br>- `src/app/models/*`<br>- `src/app/perlenkette/model`                                                  |
| `area:ci`          | GitHub actions                                                                                                                                                                                                     | - `.github/*`                                                                                                                           |
| `bug:minor`        | The feature is not compromised (e.g. slight `css` bug)                                                                                                                                                             | [# trainrun-and-section-tab component closing issue #739](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/739) |
| `bug:major`        | The feature is not fully compromised and requires the user to "hack" to get the full feature (e.g. having to close manually something or reload the window)                                                        | [# One-way card selection order #658](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/658)                     |
| `bug:critical`     | The feature is fully compromised (e.g. white screen or a view that does not open at all)                                                                                                                           | [# O/D Matrix - overlays nodes with the same name. #489](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/489)  |
| `design-document`  | This is the main document that a developer uses to implement a feature, everything needed should be part of it ("Description", "Mock-ups", "Acceptance Criteria", "Implementation Plan" and "Definition of Ready") | [# Manually re-order trainruns in nodes #636](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/636)             |
| `feature-request`  | A request of a new feature of the enhancement of an existing one.                                                                                                                                                  | [Asymmetric Times in Timetable Concepts #242](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/242)             |
| `dependencies`     | Dependencies (from Dependabot mostly)                                                                                                                                                                              |                                                                                                                                         |
| `documentation`    | About documentation                                                                                                                                                                                                |                                                                                                                                         |
| `experimental`     | For mad scientists                                                                                                                                                                                                 |                                                                                                                                         |
| `help-wanted`      | Ask for help on a matter                                                                                                                                                                                           |                                                                                                                                         |
| `postponed`        | Postponed                                                                                                                                                                                                          |                                                                                                                                         |
| `ux/ui`            | User experience, user interface (design)                                                                                                                                                                           |                                                                                                                                         |
| `good-first-issue` | Issue that does not need large business or technical context                                                                                                                                                       |                                                                                                                                         |
| `from-user`        | Issue from user                                                                                                                                                                                                    |                                                                                                                                         |

#### Milestones

Because each release is linked on a milestone, issues need to be tagged as a milestone, if relevant, to be able to quickly see what's prior in the issues list.

Issue that need to be tagged as a milestone:

- Features that directly impact the users
  - As well as Design Documents
- Evolutions of the data model
- Large refactoring issues
- Critical bug fixes
- Major bug fixes

Issues that do not need to be tagged as a milestone:

- Technical issues
- Refactoring issues
- Minor bug fixes
- Pull Requests (since a Pull Request should always reference an opened issue (using "Ref \#issue" or "Close \#issue"))

### <a id="submit-pr"></a> Submitting a Pull Request (PR)

Before you submit your Pull Request (PR) consider the following guidelines:

- Make your changes in a new git branch:

  ```shell
  git checkout -b my-fix-branch main
  ```

- Create your patch, **including appropriate test cases**.
- Follow our [Coding Rules](#rules).
- Test your changes with our supported browsers and screen readers.
- Run tests and ensure that all tests pass.
- Commit your changes using a descriptive commit message that follows our
  [commit message conventions](#commit). Adherence to these conventions
  is necessary because release notes are automatically generated from these messages.

  ```shell
  git commit -a
  ```

  Note: the optional commit `-a` command line option will automatically "add" and "rm" edited files.

- Push your branch to GitHub:

  ```shell
  git push my-fork my-fix-branch
  ```

- In GitHub, send a pull request to `sbb-your-project:main`.
  The PR title and message should as well conform to the [commit message conventions](#commit).

## <a id="rules"></a> Coding Rules

To ensure consistency throughout the source code, keep these rules in mind as you are working:

- All features or bug fixes **must be tested** by one or more specs (unit-tests).
- All public API methods **must be documented**.
- Also see [CODING_STANDARDS](./CODING_STANDARDS.md)

## <a id="commit"></a> Commit Message Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to generate the changelog.
As an example, please refer to: https://github.com/sbb-design-systems/sbb-angular

<a id="your-first-code-contribution"></a>

### How should I write my commits?

The project is using [Release please](https://github.com/googleapis/release-please?tab=readme-ov-file#how-should-i-write-my-commits)

A [configuration file](commitlint.config.ts) ensures the commits are following the format, in particular that the commit message prefix is one of the following:

- `feat:`: a new user-visible feature
- `fix:`: a bug fix, or preventing a future bug
- `docs:`: documentation only changes
- `style:`: changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor:`: a code change that neither fixes a bug nor adds a feature (but could prepare the work for a following commit)
- `perf:`: a code change that improves performance
- `test:`: adding missing tests or correcting existing tests
- `build:`: changes that affect the build system or external dependencies
- `ci:`: changes to the CI configuration files and scripts
- `chore:`: dependencies update (mostly from dependabot and release-please)

Note: `feat!:`, or `fix!:`, `refactor!:`, etc., which represent a breaking change (indicated by the `!`).

## Your First Code Contribution

Unsure where to begin contributing to Atom? You can start by looking through these `beginner` and `help-wanted` issues:

- [Beginner issues][beginner] - issues which should only require a few lines of code, and a test or two.
- [Help wanted issues][help-wanted] - issues which should be a bit more involved than `beginner` issues.

## Attribution

This CONTRIBUTING guideline is adapted from the [sbb-design-systems/sbb-angular](https://github.com/sbb-design-systems/sbb-angular)
