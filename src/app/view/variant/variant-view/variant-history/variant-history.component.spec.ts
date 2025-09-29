import {ComponentFixture, TestBed} from "@angular/core/testing";

import {VariantHistoryComponent} from "./variant-history.component";
import {VersionControlService} from "../../../../services/data/version-control.service";
import {of} from "rxjs";
import {PreviewService} from "../../../../services/data/preview.service";
import {SbbDialogModule} from "@sbb-esta/angular/dialog";
import {NavigationService} from "../../../../services/ui/navigation.service";
import {VariantControllerBackendService, VariantCreateDto} from "../../../../api/generated";
import {VersionControllerBackendService} from "../../../../api/generated";

describe("VariantHistoryComponent", () => {
  let component: VariantHistoryComponent;
  let fixture: ComponentFixture<VariantHistoryComponent>;

  let versionControlService: Partial<VersionControlService>;

  beforeEach(async () => {
    versionControlService = {
      versionCreated$: of(10),
    };

    await TestBed.configureTestingModule({
      declarations: [VariantHistoryComponent],
      imports: [SbbDialogModule],
      providers: [
        {provide: VersionControlService, useValue: versionControlService},
        {provide: PreviewService, useValue: {}},
        {provide: NavigationService, useValue: {}},
        {provide: VariantControllerBackendService, useValue: {}},
        {provide: VersionControllerBackendService, useValue: {}},
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VariantHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
