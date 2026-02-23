import {Component, HostListener, OnDestroy} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {BehaviorSubject, combineLatest, Observable, of, ReplaySubject, Subject} from "rxjs";
import {debounceTime, filter, map, mergeMap, startWith, takeUntil} from "rxjs/operators";
import {
  ProjectControllerBackendService,
  ProjectDto,
  ProjectSummaryDto,
  VariantControllerBackendService,
  VariantSummaryDto,
  VersionControllerBackendService,
} from "../../../api/generated";
import {SbbDialog} from "@sbb-esta/angular/dialog";
import {ProjectDialogComponent} from "../../project/project-dialog/project-dialog.component";
import {NavigationParameters} from "../../../utils/navigation-parameters";
import {NetzgrafikDefault} from "../../../sample-netzgrafik/netzgrafik.default";
import {VariantDialogComponent} from "../variant-dialog/variant-dialog.component";
import {ConfirmationDialogParameter} from "../../dialogs/confirmation-dialog/confirmation-dialog.component";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {UntypedFormControl} from "@angular/forms";
import {NavigationService} from "../../../services/ui/navigation.service";
import {VersionControlService} from "../../../services/data/version-control.service";
import {SlotAction} from "../../action-menu/action-menu/action-menu.component";
import {DataService} from "../../../services/data/data.service";
import {NetzgrafikDto} from "../../../data-structures/business.data.structures";

@Component({
  selector: "sbb-variants-view",
  templateUrl: "./variants-view.component.html",
  styleUrls: ["./variants-view.component.scss"],
})
export class VariantsViewComponent implements OnDestroy {
  readonly projectSubject = new ReplaySubject<ProjectDto>(1);
  project?: ProjectDto;
  searchControl = new UntypedFormControl("");
  showArchiveControl = new UntypedFormControl(false);
  searchQuery = new BehaviorSubject("");

  readonly variants = combineLatest([
    this.projectSubject,
    this.searchQuery,
    this.showArchiveControl.valueChanges.pipe(startWith(false)),
  ])
    .pipe(
      map(([project, searchQuery, showArchive]) =>
        project.variants.filter((v: VariantSummaryDto) => {
          if (!searchQuery) {
            return v.isArchived === showArchive;
          }
          return (
            v.isArchived === showArchive &&
            this.getTitleCurrentVersion(v).toLocaleLowerCase().includes(searchQuery)
          );
        }),
      ),
    )
    .pipe(map((variantSummaryDto) => variantSummaryDto.sort(this.sortByPVariantSummaryDtoName)));

  readonly projectDataActions: Observable<SlotAction[] | undefined> = this.projectSubject.pipe(
    map((project) => {
      if (project.isWritable) {
        return [
          {
            name: $localize`:@@app.view.variant.variants-view.edit-project:Edit project`,
            icon: "pen-small",
            action: () => this.onEditProjectClicked(),
          },
          {
            name: $localize`:@@app.view.variant.variants-view.archive-project.title:Archive project`,
            icon: "archive-box-small",
            action: () => this.onArchiveProjectClicked(),
          },
        ];
      } else if (project.isDeletable && project.isArchived) {
        return [
          {
            name: $localize`:@@app.view.variant.variants-view.undo-archiving:Undo archiving`,
            icon: "arrow-circle-eye-small",
            action: () => this.onUnarchiveProjectClicked(),
          },
          {
            name: $localize`:@@app.view.variant.variants-view.delete-project.title:Delete project`,
            icon: "trash-small",
            action: () => this.onDeleteProjectClicked(),
          },
        ];
      } else {
        return undefined;
      }
    }),
  );

  private readonly destroyed = new Subject<void>();

  private sortByPVariantSummaryDtoName(a: VariantSummaryDto, b: VariantSummaryDto) {
    // prettier-ignore
    if(a.latestSnapshotVersion && b.latestSnapshotVersion) {
      if(a.latestSnapshotVersion.name === b.latestSnapshotVersion.name) return 0;
      return [a.latestSnapshotVersion.name] > [b.latestSnapshotVersion.name] ? 1 : -1;
    }
    if (a.id === b.id) return 0;
    return [a.id] > [b.id] ? 1 : -1;
  }

  constructor(
    private readonly projectService: ProjectControllerBackendService,
    private readonly variantBackendService: VariantControllerBackendService,
    private readonly activatedRoute: ActivatedRoute,
    readonly navigationService: NavigationService,
    private readonly dialog: SbbDialog,
    private readonly uiInteractionService: UiInteractionService,
    private versionControlService: VersionControlService,
    private readonly versionsBackendService: VersionControllerBackendService,
    private readonly dataService: DataService,
  ) {
    activatedRoute.params
      .pipe(
        takeUntil(this.destroyed),
        map((params) => new NavigationParameters(params)),
        mergeMap((params) => projectService.getProject(params.getProjectId())),
      )
      .subscribe((project) => this.updateProject(project));

    this.searchControl.valueChanges
      .pipe(takeUntil(this.destroyed), debounceTime(300))
      .subscribe((query) => this.searchQuery.next(query.trim().toLocaleLowerCase()));
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  @HostListener("mousemove", ["$event"])
  public onMouseMove(event$: MouseEvent) {
    if (event$.buttons === 1) {
      const ele = document.documentElement;
      ele.scrollTop = ele.scrollTop - event$.movementY;
      if (event$.movementY > 2) {
        event$.stopPropagation();
        event$.preventDefault();
        window.getSelection().removeAllRanges();
      }
    }
  }

  getVariantDataActions(variant: VariantSummaryDto): Observable<SlotAction[]> {
    if (this.project.isArchived) {
      return undefined;
    }

    if (variant.isArchived) {
      return of([
        {
          name: $localize`:@@app.view.variant.variants-view.undo-archiving:Undo archiving`,
          icon: "arrow-circle-eye-small",
          action: () => this.onUnarchiveVariantClicked(variant),
        },
      ]);
    }
    return of([
      {
        name: $localize`:@@app.view.variant.variant-view.edit-variant:Edit`,
        icon: "pen-small",
        action: () => this.onOpenVariantDialog(variant),
      },
      {
        name: $localize`:@@app.view.variant.variants-view.archive:Archive`,
        icon: "archive-box-small",
        action: () => this.onArchiveVariantClicked(variant),
      },
    ]);
  }

  onOpenVariantDialog(variantToEdit: VariantSummaryDto) {
    const oldName = variantToEdit.latestSnapshotVersion
      ? variantToEdit.latestSnapshotVersion.name
      : variantToEdit.latestReleaseVersion.name;
    const baseVersionId = variantToEdit.latestSnapshotVersion
      ? variantToEdit.latestSnapshotVersion.id
      : variantToEdit.latestReleaseVersion.id;

    this.versionsBackendService
      .getVersionModel(baseVersionId)
      .pipe(
        takeUntil(this.destroyed),
        map((model) => model as NetzgrafikDto),
      )
      .subscribe((netzgrafik) => {
        VariantDialogComponent.open(this.dialog, {name: oldName})
          .pipe(takeUntil(this.destroyed))
          .subscribe((fromVariantModel) => {
            this.versionsBackendService
              .createSnapshotVersion(baseVersionId, {
                name: fromVariantModel.name,
                comment: "",
                model: JSON.stringify(netzgrafik),
              })
              .pipe(takeUntil(this.destroyed))
              .subscribe((versionId) => {
                this.projectService.getProject(variantToEdit.projectId).subscribe((projectDto) => {
                  this.updateProject(projectDto);
                });
              });
          });
      });
  }

  onArchiveVariantClicked(variantToEdit: VariantSummaryDto) {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variants-view.archive-variant.title:Archive variant`,
          $localize`:@@app.view.variant.variants-view.archive-variant.content:Would you like to archive the variant now?`,
        ),
      )
      .pipe(
        filter((confirmed) => confirmed),
        takeUntil(this.destroyed),
      )
      .subscribe((project) => {
        this.versionControlService.archiveVariantWithId(variantToEdit.id).subscribe(() => {
          this.projectService
            .getProject(variantToEdit.projectId)
            .subscribe((projectTdo) => this.updateProject(projectTdo));
        });
      });
  }

  onUnarchiveVariantClicked(variantToEdit: VariantSummaryDto) {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variants-view.undo-archiving-variant.title:Undo archiving`,
          $localize`:@@app.view.variant.variants-view.undo-archiving-variant.content:Would you like to undo the archiving of the variant?`,
        ),
      )
      .pipe(
        filter((confirmed) => confirmed),
        takeUntil(this.destroyed),
      )
      .subscribe((project) => {
        this.versionControlService.unarchiveVariantWithId(variantToEdit.id).subscribe(() => {
          this.projectService
            .getProject(variantToEdit.projectId)
            .subscribe((projectTdo) => this.updateProject(projectTdo));
        });
      });
  }

  onAddVariantClicked(): void {
    VariantDialogComponent.open(this.dialog, {name: ""})
      .pipe(
        takeUntil(this.destroyed),
        mergeMap((model) => this.createVariant(this.project.id, model.name)),
      )
      .subscribe((variantId) =>
        this.navigationService.navigateToEditor(this.project.id, variantId),
      );
  }

  onEditProjectClicked(): void {
    ProjectDialogComponent.open(this.dialog, this.project)
      .pipe(
        mergeMap((project) => this.projectService.updateProject(this.project.id, project)),
        mergeMap(() => this.projectService.getProject(this.project.id)),
        takeUntil(this.destroyed),
      )
      .subscribe((project) => this.updateProject(project));
  }

  onArchiveProjectClicked(): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variants-view.archive-project.title:Archive project`,
          $localize`:@@app.view.variant.variants-view.archive-project.content:Would you like to archive the project now?`,
        ),
      )
      .pipe(
        filter((confirmed) => confirmed),
        mergeMap(() => this.projectService.archiveProject(this.project.id)),
        mergeMap(() => this.projectService.getProject(this.project.id)),
        takeUntil(this.destroyed),
      )
      .subscribe((project) => this.updateProject(project));
  }

  onUnarchiveProjectClicked(): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variants-view.undo-archiving-project.title:Archive variant`,
          $localize`:@@app.view.variant.variants-view.undo-archiving-project.content:Would you like to undo the archiving of the project?`,
        ),
      )
      .pipe(
        filter((confirmed) => confirmed),
        mergeMap(() => this.projectService.unarchiveProject(this.project.id)),
        mergeMap(() => this.projectService.getProject(this.project.id)),
        takeUntil(this.destroyed),
      )
      .subscribe((project) => this.updateProject(project));
  }

  onDeleteProjectClicked(): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variants-view.delete-project.title:Delete projekt`,
          $localize`:@@app.view.variant.variants-view.delete-project.content:Do you want to permanently delete the project and all the variants it contains? This action cannot be undone.`,
        ),
      )
      .pipe(
        filter((confirmed) => confirmed),
        mergeMap(() => this.projectService.deleteProject(this.project.id)),
        takeUntil(this.destroyed),
      )
      .subscribe(() => this.navigationService.navigateToProjects());
  }

  getTitleCurrentVersion(variant: VariantSummaryDto): string {
    const archivedSuffix = variant.isArchived
      ? " " + $localize`:@@app.view.variant.variants-view.archived:(archived)`
      : "";

    if (variant.latestSnapshotVersion) {
      return variant.latestSnapshotVersion.name + "*" + archivedSuffix;
    }

    if (variant.latestReleaseVersion) {
      return variant.latestReleaseVersion.name + archivedSuffix;
    }

    throw new Error(
      $localize`:@@app.view.variant.variants-view.error-unexpected-data:Unexpected data: No snapshot and no released version.`,
    );
  }

  getChangedAtCurrentVersion(variant: VariantSummaryDto): Date {
    if (variant.latestSnapshotVersion) {
      return new Date(variant.latestSnapshotVersion.createdAt);
    }

    if (variant.latestReleaseVersion) {
      return new Date(variant.latestReleaseVersion.createdAt);
    }

    throw new Error(
      $localize`:@@app.view.variant.variants-view.error-unexpected-data:Unexpected data: No snapshot and no released version.`,
    );
  }

  private updateProject(project: ProjectDto): void {
    this.project = project;
    this.projectSubject.next(project);
  }

  private createVariant(projectId: number, name: string): Observable<number> {
    return this.variantBackendService.createVariant(projectId, {
      initialModel: JSON.stringify(NetzgrafikDefault.getDefaultNetzgrafik()),
      initialName: name,
    });
  }
}
