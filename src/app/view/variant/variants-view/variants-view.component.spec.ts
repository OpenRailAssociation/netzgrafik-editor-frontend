import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SbbTextareaModule} from "@sbb-esta/angular/textarea";

import {VariantsViewComponent} from "./variants-view.component";
import {SbbDialogModule} from "@sbb-esta/angular/dialog";
import {
  ProjectControllerBackendService,
  ProjectDto,
  VariantControllerBackendService,
  VersionControllerBackendService,
} from "../../../api/generated";
import {Observable, of} from "rxjs";
import {ActivatedRoute} from "@angular/router";
import {NavigationService} from "../../../services/ui/navigation.service";
import {VersionControlService} from "../../../services/data/version-control.service";
import {I18nModule} from "../../../core/i18n/i18n.module";
import {CUSTOM_ELEMENTS_SCHEMA} from "@angular/core";
import {DataService} from "../../../services/data/data.service";

describe("VariantsViewComponent", () => {
  let component: VariantsViewComponent;
  let fixture: ComponentFixture<VariantsViewComponent>;

  let projectControllerBackendService: {getProject: () => Observable<ProjectDto>};
  let variantControllerBackendService: {createVariant: () => Observable<number>};
  let activatedRoute: Partial<ActivatedRoute>;
  let versionControlService: Partial<VersionControlService>;
  let versionControllerBackendService: Partial<VersionControllerBackendService>;
  let dataService: Partial<DataService>;

  beforeEach(async () => {
    projectControllerBackendService = {
      getProject: () => {
        const project: ProjectDto = {
          id: 10,
          name: "",
          description: "",
          summary: "",
          variants: [],
          createdAt: "",
          createdBy: "",
          isWritable: true,
          isArchived: false,
          isDeletable: false,
          writeUsers: [],
          readUsers: [],
        };
        return of(project);
      },
    };
    activatedRoute = {
      params: of({
        projectId: "10",
        variantId: "20",
      }),
    };
    variantControllerBackendService = {
      createVariant: () => of(10),
    };

    await TestBed.configureTestingModule({
      declarations: [VariantsViewComponent],
      imports: [I18nModule, FormsModule, ReactiveFormsModule, SbbDialogModule, SbbTextareaModule],
      providers: [
        {provide: ActivatedRoute, useValue: activatedRoute},
        {provide: NavigationService, useValue: {}},
        {
          provide: ProjectControllerBackendService,
          useValue: projectControllerBackendService,
        },
        {
          provide: VariantControllerBackendService,
          useValue: variantControllerBackendService,
        },
        {provide: VersionControlService, useValue: versionControlService},
        {provide: VersionControllerBackendService, useValue: versionControllerBackendService},
        {provide: DataService, useValue: dataService},
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VariantsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
