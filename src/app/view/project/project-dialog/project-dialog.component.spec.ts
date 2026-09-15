import {ComponentFixture, TestBed} from "@angular/core/testing";

import {ProjectDialogComponent} from "./project-dialog.component";
import {SBB_DIALOG_DATA, SbbDialogRef} from "@sbb-esta/angular/dialog";

describe("ProjectDialogComponent", () => {
  let component: ProjectDialogComponent;
  let fixture: ComponentFixture<ProjectDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        {provide: SbbDialogRef, useValue: {}},
        {provide: SBB_DIALOG_DATA, useValue: undefined},
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
