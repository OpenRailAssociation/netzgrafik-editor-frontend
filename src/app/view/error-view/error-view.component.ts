import {Component} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";

@Component({
  selector: "sbb-error-view",
  templateUrl: "./error-view.component.html",
  styleUrls: ["./error-view.component.scss"],
  standalone: false,
})
export class ErrorViewComponent {
  constructor(private activatedRoute: ActivatedRoute) {}

  get error(): Observable<string> {
    return this.activatedRoute.data.pipe(map((d) => d.error));
  }
}
