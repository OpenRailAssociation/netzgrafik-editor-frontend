import {Injectable, OnDestroy} from "@angular/core";
import {
  ProjectControllerBackendService,
  ProjectCreateUpdateDto,
  ProjectSummaryDto,
} from "../../../api/generated";
import {BehaviorSubject, combineLatest, Observable, Subject} from "rxjs";
import {map, takeUntil} from "rxjs/operators";

@Injectable()
export class ProjectsViewService implements OnDestroy {
  filteredProjects: Observable<ProjectSummaryDto[]>;

  private allProjects = new BehaviorSubject<ProjectSummaryDto[]>([]);
  private searchQuery = new BehaviorSubject("");
  private showArchive = new BehaviorSubject(false);

  private destroyed = new Subject<void>();

  constructor(private readonly projectService: ProjectControllerBackendService) {
    this.filteredProjects = this.constructFilteredProjects().pipe(
      map((projectSummaryDto) => projectSummaryDto.sort(this.sortByProjectSummaryDtoName)),
    );
    this.loadProjects();
  }

  sortByProjectSummaryDtoName(a: ProjectSummaryDto, b: ProjectSummaryDto) {
    if (a.name === b.name) return 0;
    return [a.name] > [b.name] ? 1 : -1;
  }

  private static filterProject(
    searchQuery: string,
    showArchive: boolean,
    project: ProjectSummaryDto,
  ) {
    if (!searchQuery) {
      return project.isArchived === showArchive;
    }
    return (
      project.isArchived === showArchive && project.name.toLocaleLowerCase().includes(searchQuery)
    );
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  loadProjects() {
    this.projectService
      .getAllProjects()
      .pipe(takeUntil(this.destroyed))
      .subscribe((projects) => this.allProjects.next(projects));
  }

  createProject(project: ProjectCreateUpdateDto): Observable<number> {
    return this.projectService.createProject(project);
  }

  updateSearchQuery(query: string) {
    this.searchQuery.next(query.trim().toLocaleLowerCase());
  }

  updateShowArchive(showArchive: boolean) {
    this.showArchive.next(showArchive);
  }

  private constructFilteredProjects() {
    return combineLatest([this.searchQuery, this.showArchive, this.allProjects]).pipe(
      map(([search, showArchive, projects]) =>
        projects.filter((p) => ProjectsViewService.filterProject(search, showArchive, p)),
      ),
    );
  }
}
