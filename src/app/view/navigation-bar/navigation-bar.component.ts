import {Component, OnInit} from "@angular/core";
import {NavigationEnd, Router} from "@angular/router";
import {filter, map} from "rxjs/operators";
import {Observable} from "rxjs";
import {NavigationService} from "../../services/ui/navigation.service";
import {
  ProjectControllerBackendService,
  VariantControllerBackendService,
} from "../../api/generated";

@Component({
  selector: "sbb-navigation-bar",
  templateUrl: "./navigation-bar.component.html",
  styleUrls: ["./navigation-bar.component.scss"],
})
export class NavigationBarComponent implements OnInit {
  currentDefinitions: BreadcrumbDefinition[] = [];

  private readonly definitions: BreadcrumbsDefinition[] = [
    {
      when: "/projects/{}",
      then: (params) => [
        {
          name: this.projectsBackendService
            .getProject(params[0].asNumber())
            .pipe(
              map(
                (project) =>
                  $localize`:@@app.view.navigation-bar.project-name:Project «${project.name}:name:»`,
              ),
            ),
          route: this.navigationService.getRouteToVariants(params[0].asNumber()),
        },
      ],
    },
    {
      when: "/projects/{}/variants/{}",
      then: (params) => [
        {
          name: this.projectsBackendService
            .getProject(params[0].asNumber())
            .pipe(
              map((project) =>
                project.isArchived === false
                  ? $localize`:@@app.view.navigation-bar.project-name:Project «${project.name}:name:»`
                  : $localize`:@@app.view.navigation-bar.project-name-archived:Project «${project.name}:name:» (archived)`,
              ),
            ),
          route: this.navigationService.getRouteToVariants(params[0].asNumber()),
        },
        {
          name: this.variantsBackendService
            .getVariant(params[1].asNumber())
            .pipe(
              map((variant) =>
                variant.isArchived === false
                  ? $localize`:@@app.view.navigation-bar.variant-name:Variant «${variant.latestVersion.name}:name:»`
                  : $localize`:@@app.view.navigation-bar.variant-name-archived:Variant «${variant.latestVersion.name}:name:» (archived)`,
              ),
            ),
          route: this.navigationService.getRouteToEditor(
            params[0].asNumber(),
            params[1].asNumber(),
          ),
        },
      ],
    },
  ];

  private readonly definitionHandlers: BreadcrumbsDefinitionsHandler[];

  constructor(
    private readonly router: Router,
    private readonly navigationService: NavigationService,
    private readonly projectsBackendService: ProjectControllerBackendService,
    private readonly variantsBackendService: VariantControllerBackendService,
  ) {
    this.definitionHandlers = this.definitions.map(
      (definition) => new BreadcrumbsDefinitionsHandler(definition),
    );
  }

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map((event) => event as NavigationEnd),
      )
      .subscribe((event) => {
        const urlHandler = new UrlHandler(event.url);
        const definitionHandler = this.definitionHandlers.find((manager) =>
          manager.doesMatch(urlHandler),
        );
        const params = definitionHandler?.getParams(urlHandler);

        this.currentDefinitions =
          definitionHandler && params ? definitionHandler.definition.then(params) : [];
      });
  }
}

class UrlHandler {
  readonly splittedUrl: string[];

  constructor(readonly url: string) {
    this.splittedUrl = url.split("/");
  }
}

class BreadcrumbsDefinitionsHandler {
  private readonly splittedWhenPattern: string[];
  private readonly parameterPointers: number[] = [];

  constructor(readonly definition: BreadcrumbsDefinition) {
    this.splittedWhenPattern = definition.when.split("/");

    this.splittedWhenPattern.forEach((value, index) => {
      if (value === "{}") {
        this.parameterPointers.push(index);
      }
    });
  }

  doesMatch(urlHandler: UrlHandler): boolean {
    if (urlHandler.splittedUrl.length !== this.splittedWhenPattern.length) {
      return false;
    }

    return urlHandler.splittedUrl.every((value, index) => {
      if (!this.parameterPointers.find((pointer) => pointer === index)) {
        // not a parameter
        return value === this.splittedWhenPattern[index];
      }
      return true;
    });
  }

  getParams(urlHandler: UrlHandler): Param[] {
    return urlHandler.splittedUrl
      .filter((value, index) => this.parameterPointers.find((pointer) => pointer === index))
      .map((value) => new Param(value));
  }
}

interface BreadcrumbsDefinition {
  when: string;
  then: (params: Param[]) => BreadcrumbDefinition[];
}

interface BreadcrumbDefinition {
  name: Observable<string>;
  route: any[];
}

class Param {
  constructor(private readonly value: string) {}

  asNumber(): number {
    return +this.value;
  }
}
