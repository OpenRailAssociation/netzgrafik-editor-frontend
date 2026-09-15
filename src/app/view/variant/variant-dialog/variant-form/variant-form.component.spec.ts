import {ComponentFixture, TestBed} from "@angular/core/testing";
import {VariantFormComponent, VariantFormComponentModel} from "./variant-form.component";
import {FormModel} from "../../../../utils/form-model";

describe("VariantFormComponent", () => {
  let component: VariantFormComponent;
  let fixture: ComponentFixture<VariantFormComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VariantFormComponent);
    component = fixture.componentInstance;
    component.model = new FormModel<VariantFormComponentModel>({name: ""});
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
