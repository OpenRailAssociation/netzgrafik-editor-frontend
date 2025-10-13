import {NgModule} from "@angular/core";
import {RouterModule, Routes} from "@angular/router";
import {NetzgrafikApplicationComponent} from "./netzgrafik-application/netzgrafik-application.component";
import {ProjectsViewComponent} from "./view/project/projects-view/projects-view.component";
import {VariantsViewComponent} from "./view/variant/variants-view/variants-view.component";
import {ErrorViewComponent} from "./view/error-view/error-view.component";

// Use the AuthGuard in routes that should require a logged in user.
// Do NOT use it for the root route. If the user should always be logged in,
// see comment in the AppComponent constructor.
const routes: Routes = [
  {path: "", component: ProjectsViewComponent},
  {
    path: "projects",
    children: [
      {path: "", component: ProjectsViewComponent},
      {path: ":projectId", component: VariantsViewComponent},
      {
        path: ":projectId/variants/:variantId",
        component: NetzgrafikApplicationComponent,
      },
    ],
  },
  {
    path: "404",
    component: ErrorViewComponent,
    data: {
      error: $localize`:@@app-routing.module.path.404:The page you were looking for was not found.`,
    },
  },
  {
    path: "401",
    component: ErrorViewComponent,
    data: {
      error: $localize`:@@app-routing.module.path.401:You are not authorized, please reload the page.`,
    },
  },
  {
    path: "403",
    component: ErrorViewComponent,
    data: {
      error: $localize`:@@app-routing.module.path.403:You are not authorized to perform this action.`,
    },
  },
  {
    path: "409",
    component: ErrorViewComponent,
    data: {
      error: $localize`:@@app-routing.module.path.409:There was a conflict while executing your action, please try again.`,
    },
  },
  {
    path: "error",
    component: ErrorViewComponent,
    data: {error: $localize`:@@app-routing.module.path.error:An error has occurred.`},
  },
  {path: "**", redirectTo: "/404"},
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {})],
  exports: [RouterModule],
})
export class AppRoutingModule {}
