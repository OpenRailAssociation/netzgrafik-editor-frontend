import {ComponentFixture, TestBed} from "@angular/core/testing";

import {ProjectsViewComponent} from "./projects-view.component";
import {of} from "rxjs";
import {ProjectsViewService} from "./projects-view.service";
import {SbbDialogModule} from "@sbb-esta/angular/dialog";
import {ProjectControllerBackendService} from "../../../api/generated";
import {NavigationService} from "../../../services/ui/navigation.service";

describe("ProjectsViewComponent", () => {
  let component: ProjectsViewComponent;
  let fixture: ComponentFixture<ProjectsViewComponent>;
  let projectViewService: Partial<ProjectsViewService>;
  let projectControllerBackendService: Partial<ProjectControllerBackendService>;

  beforeEach(async () => {
    projectViewService = {
      filteredProjects: of([]),
    };

    await TestBed.configureTestingModule({
      declarations: [ProjectsViewComponent],
      imports: [SbbDialogModule],
      providers: [
        {provide: ProjectsViewService, useValue: projectViewService},
        {
          provide: ProjectControllerBackendService,
          useValue: projectControllerBackendService,
        },
        {provide: NavigationService, useValue: {}},
      ],
    })
      .overrideComponent(ProjectsViewComponent, {
        set: {
          providers: [
            {provide: ProjectsViewService, useValue: projectViewService},
          ],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
