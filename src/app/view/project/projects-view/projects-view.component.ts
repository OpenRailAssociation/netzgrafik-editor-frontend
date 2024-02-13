import {Component, OnDestroy} from "@angular/core";
import {Observable, of, ReplaySubject, Subject} from "rxjs";
import {UntypedFormControl} from "@angular/forms";
import {ProjectsViewService} from "./projects-view.service";
import {debounceTime, filter, mergeMap, takeUntil} from "rxjs/operators";
import {SbbDialog} from "@sbb-esta/angular/dialog";
import {ProjectDialogComponent} from "../project-dialog/project-dialog.component";
import {
  ProjectControllerBackendService,
  ProjectDto,
  ProjectSummaryDto,
} from "../../../api/generated";
import {ConfirmationDialogParameter} from "../../dialogs/confirmation-dialog/confirmation-dialog.component";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {NavigationService} from "../../../services/ui/navigation.service";
import {SlotAction} from "../../action-menu/action-menu/action-menu.component";

@Component({
  selector: "sbb-projects-view",
  templateUrl: "./projects-view.component.html",
  styleUrls: ["./projects-view.component.scss"],
  providers: [ProjectsViewService],
})
export class ProjectsViewComponent implements OnDestroy {
  readonly projectSubject = new ReplaySubject<ProjectDto>(1);
  searchControl = new UntypedFormControl("");

  showArchiveControl = new UntypedFormControl(false);

  private destroyed = new Subject<void>();

  constructor(
    public projectService: ProjectsViewService,
    private readonly projectControllerBackendService: ProjectControllerBackendService,
    private readonly dialog: SbbDialog,
    private readonly uiInteractionService: UiInteractionService,
    private readonly navigationService: NavigationService,
  ) {
    this.searchControl.valueChanges
      .pipe(takeUntil(this.destroyed), debounceTime(300))
      .subscribe((query) => this.projectService.updateSearchQuery(query));

    this.showArchiveControl.valueChanges
      .pipe(takeUntil(this.destroyed))
      .subscribe((showArchive) =>
        this.projectService.updateShowArchive(showArchive),
      );
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  onAddProjectClicked(): void {
    ProjectDialogComponent.open(this.dialog)
      .pipe(
        takeUntil(this.destroyed),
        mergeMap((project) => this.projectService.createProject(project)),
      )
      .subscribe((projectId) =>
        this.navigationService.navigateToVariants(projectId),
      );
  }

  onEditProjectClicked(projectToEdit: ProjectSummaryDto): void {
    this.projectControllerBackendService
      .getProject(projectToEdit.id)
      .subscribe((projectDTO) => {
        ProjectDialogComponent.open(this.dialog, projectDTO)
          .pipe(
            mergeMap((project) =>
              this.projectControllerBackendService.updateProject(
                projectToEdit.id,
                project,
              ),
            ),
            mergeMap(() =>
              this.projectControllerBackendService.getProject(projectToEdit.id),
            ),
            takeUntil(this.destroyed),
          )
          .subscribe((project) => this.updateProject(project));
      });
  }

  onArchiveProjectClicked(projectToEdit: ProjectSummaryDto): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          "Projekt archivieren",
          "Möchten Sie das Projekt jetzt archivieren?",
        ),
      )
      .pipe(
        filter((confirmed) => confirmed),
        mergeMap(() =>
          this.projectControllerBackendService.archiveProject(projectToEdit.id),
        ),
        mergeMap(() =>
          this.projectControllerBackendService.getProject(projectToEdit.id),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((project) => this.updateProject(project));
  }

  onUnarchiveProjectClicked(projectToEdit: ProjectSummaryDto): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          "Archivierung rückgängig machen",
          "Möchten Sie die Archivierung des Projekts rückgängig machen?",
        ),
      )
      .pipe(
        filter((confirmed) => confirmed),
        mergeMap(() =>
          this.projectControllerBackendService.unarchiveProject(
            projectToEdit.id,
          ),
        ),
        mergeMap(() =>
          this.projectControllerBackendService.getProject(projectToEdit.id),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe((project) => this.updateProject(project));
  }

  getProjectDataActions(project: ProjectSummaryDto): Observable<SlotAction[]> {
    if (project.isArchived) {
      return of([
        {
          name: "Archivierung rückgängig machen",
          icon: "arrow-circle-eye-small",
          action: () => this.onUnarchiveProjectClicked(project),
        },
      ]);
    }
    return of([
      {
        name: "Bearbeiten",
        icon: "pen-small",
        action: () => this.onEditProjectClicked(project),
      },
      {
        name: "Archivieren",
        icon: "archive-box-small",
        action: () => this.onArchiveProjectClicked(project),
      },
    ]);
  }

  private updateProject(project: ProjectDto): void {
    this.projectSubject.next(project);
    this.projectService.loadProjects();
  }
}
