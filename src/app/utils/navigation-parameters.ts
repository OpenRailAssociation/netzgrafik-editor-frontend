import {Params} from "@angular/router";

export class NavigationParameters {
  constructor(private readonly params: Params) {}

  tryGetProjectId(): number | null {
    const id = +this.params.projectId;
    return isNaN(id) ? null : id;
  }

  getProjectId(): number {
    const id = this.tryGetProjectId();
    if (!id) {
      throw new Error(
        $localize`:@@app.utils.navigation-parameters.no-project-id:No project ID available`,
      );
    }
    return id;
  }

  tryGetVariantId(): number | null {
    const id = +this.params.variantId;
    return isNaN(id) ? null : id;
  }

  getVariantId(): number {
    const id = this.tryGetVariantId();
    if (!id) {
      throw new Error(
        $localize`:@@app.utils.navigation-parameters.no-variant-id:No variant ID available`,
      );
    }
    return id;
  }

  tryGetVersionId(): number | null {
    const id = +this.params.versionId;
    return isNaN(id) ? null : id;
  }

  getVersionId(): number {
    const id = this.tryGetVersionId();
    if (!id) {
      throw new Error(
        $localize`:@@app.utils.navigation-parameters.no-version-id:No version ID available`,
      );
    }
    return id;
  }
}
