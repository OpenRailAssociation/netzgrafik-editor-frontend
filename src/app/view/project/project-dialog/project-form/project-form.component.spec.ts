import {ComponentFixture, TestBed} from "@angular/core/testing";

import {
  ProjectFormComponent,
  ProjectFormComponentModel,
  userIdsAsEmailValidator,
} from "./project-form.component";
import {FormModel} from "../../../../utils/form-model";
import {I18nModule} from "../../../../core/i18n/i18n.module";
import {UntypedFormControl} from "@angular/forms";
import {CUSTOM_ELEMENTS_SCHEMA} from "@angular/core";

describe("ProjectFormComponent", () => {
  let component: ProjectFormComponent;
  let fixture: ComponentFixture<ProjectFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectFormComponent],
      imports: [I18nModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectFormComponent);
    component = fixture.componentInstance;
    component.model = new FormModel<ProjectFormComponentModel>({
      name: "",
      summary: "",
      description: "",
      writeUsers: [],
      readUsers: [],
    });
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("validEMailExamples test", () => {
    const validEMailExamples = [
      "franz@nix.com",
      "adrian@example.com",
      "muster.hans@example.test.zurich",
      "name.vorname.vorname2@mail.domain.ch",
      "fun@data.cloud",
      "adrian@ai.org",
      "1234@x.org",
      "x@1234.org",
      "1234@1234.org",
      "123a4@1234.org",
      "123a4@1234abc123zsd.a123sb.org",
      "u123456",
      "ue123456",
      "e123456",
      "u000000",
    ];

    validEMailExamples.forEach((e) => {
      const test = new UntypedFormControl();
      test.setValue([e]);
      expect(userIdsAsEmailValidator(test)).toBeNull();
    });
  });

  it("invalidEMailExamples test", () => {
    const invalidEMailExamples = [
      "u12345z",
      "U123456",
      "name.vorname.vorname2#mail.domain.ch",
      "a",
      "u",
      "ue",
      "e",
    ];
    invalidEMailExamples.forEach((e) => {
      const test = new UntypedFormControl();
      test.setValue([e]);
      expect(userIdsAsEmailValidator(test).invalidUserIdAsEmails).toBe(e);
    });
  });

  it("validEMailExamples batch - test", () => {
    const validEMailExamples = [
      "adrian@example.com",
      "name.vorname.vorname2@mail.domain.ch",
      "fun@data.cloud",
      "adrian@ai.org",
      "1234@x.org",
      "x@1234.org",
      "1234@1234.org",
      "123a4@1234.org",
      "Franz@nix.com",
      "Adrian@ai.org",
      "aDrian@ai.org",
      "ADRIAN@AI.ORG",
      "adrian@AI.ORG",
      "adrian@ai.ORG",
      "adrian@AI.org",
      "adrian@AI.orG",
    ];

    const test = new UntypedFormControl();
    test.setValue(validEMailExamples);
    expect(userIdsAsEmailValidator(test)).toBeNull();
  });

  it("invalidEMailExamples batch - test", () => {
    const invalidEMailExamples = ["u123456", "name.vorname.vorname2#mail.domain.ch", ""];
    const test = new UntypedFormControl();
    test.setValue(invalidEMailExamples);
    expect(userIdsAsEmailValidator(test).invalidUserIdAsEmails.length).toBe(38);
  });

  it("mixedValInvalidExamples - batch - test", () => {
    const mixedValInvalidExamples = [
      "adrian@example.com",
      "name.vorname.vorname2@mail.domain.ch",
      "fun@data.cloud",
      "adrian@ai.org",
      "u123456",
      "1234@x.org",
      "x@1234.org",
      "a2#b.ch",
      "1234@1234.org",
      "123a4@1234.org",
      "",
    ];
    const test = new UntypedFormControl();
    test.setValue(mixedValInvalidExamples);
    expect(userIdsAsEmailValidator(test).invalidUserIdAsEmails.length).toBe(9);
  });
});
