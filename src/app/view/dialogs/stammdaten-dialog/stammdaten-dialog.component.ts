import {Component, OnDestroy, TemplateRef, ViewChild} from "@angular/core";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {SbbDialog, SbbDialogConfig} from "@sbb-esta/angular/dialog";
import {SbbTableDataSource} from "@sbb-esta/angular/table";
import {Stammdaten} from "../../../models/stammdaten.model";
import {HaltezeitFachCategories} from "../../../data-structures/business.data.structures";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";

@Component({
  selector: "sbb-stammdaten-dialog",
  templateUrl: "./stammdaten-dialog.component.html",
  styleUrls: ["./stammdaten-dialog.component.scss"],
})
export class StammdatenDialogComponent implements OnDestroy {
  @ViewChild("stammdatenTemplate", {static: true})
  stammdatenTemplate: TemplateRef<any>;
  public stammdaten = [];
  displayedColumns: string[] = [
    "betriebspunkt",
    "haltezeit_I_P_V",
    "haltezeit_A",
    "haltezeit_B",
    "haltezeit_C",
    "haltezeit_D",
    "zaz",
    "connection_time",
    "region",
    "kategorie",
    "filterableLabels",
    "pos",
  ];
  dataSource: SbbTableDataSource<any>;
  private destroyed = new Subject<void>();

  constructor(
    public dialog: SbbDialog,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
  ) {
    this.uiInteractionService.stammdatenEditDialog
      .pipe(takeUntil(this.destroyed))
      .subscribe((stammdaten) => {
        this.openDialog(stammdaten);
      });
  }

  static getDialogConfig() {
    const dialogConfig = new SbbDialogConfig();
    const width = 1200;
    const height = 512;
    dialogConfig.width = width + "px";
    dialogConfig.minWidth = dialogConfig.width;
    dialogConfig.maxWidth = dialogConfig.width;
    dialogConfig.height = height + "px";
    dialogConfig.minHeight = dialogConfig.height;
    dialogConfig.maxHeight = dialogConfig.height;
    dialogConfig.panelClass = "";
    return dialogConfig;
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  openDialog(stammdaten: Stammdaten[]) {
    this.stammdaten = stammdaten;

    const stammdatenConverted = [];
    this.stammdaten.forEach((std) => {
      stammdatenConverted.push({
        betriebspunkt: std.getBP(),
        [HaltezeitFachCategories.IPV]: std.getHaltezeiten()[HaltezeitFachCategories.IPV],
        [HaltezeitFachCategories.A]: std.getHaltezeiten()[HaltezeitFachCategories.A],
        [HaltezeitFachCategories.B]: std.getHaltezeiten()[HaltezeitFachCategories.B],
        [HaltezeitFachCategories.C]: std.getHaltezeiten()[HaltezeitFachCategories.C],
        [HaltezeitFachCategories.D]: std.getHaltezeiten()[HaltezeitFachCategories.D],
        connection_time: std.getConnectionTime(),
        zaz: std.getZAZ(),
        region: std.getRegions(),
        filterableLabels: std.getFilterableLabels(),
        kategorie: std.getKategorien(),
        pos: std.getPosition(),
      });
    });

    this.dataSource = new SbbTableDataSource(stammdatenConverted);
    const dialogConfig = StammdatenDialogComponent.getDialogConfig();
    const dialogRef = this.dialog.open(this.stammdatenTemplate, dialogConfig);
  }
}
