import {ComponentFixture, TestBed} from "@angular/core/testing";
import {VariantDialogComponent} from "./variant-dialog.component";
import {SBB_DIALOG_DATA, SbbDialogRef} from "@sbb-esta/angular/dialog";
import {I18nModule} from "../../../core/i18n/i18n.module";
import {CUSTOM_ELEMENTS_SCHEMA} from "@angular/core";

describe("VariantDialogComponent", () => {
  let component: VariantDialogComponent;
  let fixture: ComponentFixture<VariantDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VariantDialogComponent],
      imports: [I18nModule],
      providers: [
        {provide: SbbDialogRef, useValue: {}},
        {provide: SBB_DIALOG_DATA, useValue: {}},
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VariantDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
