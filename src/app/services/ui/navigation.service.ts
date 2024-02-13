import {Injectable} from "@angular/core";
import {Router} from "@angular/router";

@Injectable({
  providedIn: "root",
})
export class NavigationService {
  constructor(private readonly router: Router) {}

  navigateToEditor(projectId: number, variantId: number): void {
    this.router.navigate(this.getRouteToEditor(projectId, variantId));
  }

  navigateToProjects(): void {
    this.router.navigate(this.getRouteToProjects());
  }

  navigateToVariants(projectId: number): void {
    this.router.navigate(this.getRouteToVariants(projectId));
  }

  getRouteToEditor(projectId: number, variantId: number): any[] {
    return ["/projects", projectId, "variants", variantId];
  }

  getRouteToVariants(projectId: number): any[] {
    return ["/projects", projectId];
  }

  getRouteToProjects(): any[] {
    return ["/"];
  }
}
