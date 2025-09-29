import {ComponentFixture, TestBed} from "@angular/core/testing";

import {NavigationBarComponent} from "./navigation-bar.component";
import {
  ProjectControllerBackendService,
  VariantControllerBackendService,
} from "../../api/generated";
import {NavigationEnd, Router} from "@angular/router";
import {NavigationService} from "../../services/ui/navigation.service";
import {NEVER} from "rxjs";
import {map} from "rxjs/operators";
import {I18nModule} from "../../core/i18n/i18n.module";
import {CUSTOM_ELEMENTS_SCHEMA} from "@angular/core";

describe("NavigationBarComponent", () => {
  let component: NavigationBarComponent;
  let fixture: ComponentFixture<NavigationBarComponent>;

  let projectControllerBackendService: Partial<ProjectControllerBackendService>;
  let variantControllerBackendService: Partial<VariantControllerBackendService>;
  let router: Partial<Router>;

  beforeEach(async () => {
    router = {
      events: NEVER.pipe(map(() => new NavigationEnd(0, "", ""))),
    };

    await TestBed.configureTestingModule({
      declarations: [NavigationBarComponent],
      imports: [I18nModule],
      providers: [
        {provide: Router, useValue: router},
        {provide: NavigationService, useValue: {}},
        {
          provide: ProjectControllerBackendService,
          useValue: projectControllerBackendService,
        },
        {
          provide: VariantControllerBackendService,
          useValue: variantControllerBackendService,
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NavigationBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
