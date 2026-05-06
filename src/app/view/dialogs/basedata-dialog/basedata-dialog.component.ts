import {Component, OnDestroy, TemplateRef, ViewChild} from "@angular/core";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {SbbDialog, SbbDialogConfig} from "@sbb-esta/angular/dialog";
import {SbbTableDataSource} from "@sbb-esta/angular/table";
import {BaseData} from "../../../models/basedata.model";
import {HaltezeitFachCategories} from "../../../data-structures/business.data.structures";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";

@Component({
  selector: "sbb-base-data-dialog",
  templateUrl: "./basedata-dialog.component.html",
  styleUrls: ["./basedata-dialog.component.scss"],
  standalone: false,
})
export class BaseDataDialogComponent implements OnDestroy {
  @ViewChild("baseDataTemplate", {static: true})
  baseDataTemplate: TemplateRef<any>;
  public baseData = [];
  displayedColumns: string[] = [
    "betriebspunkt",
    "haltezeit_I_P_V",
    "stopFlag_I_P_V",
    "haltezeit_A",
    "stopFlag_A",
    "haltezeit_B",
    "stopFlag_B",
    "haltezeit_C",
    "stopFlag_C",
    "haltezeit_D",
    "stopFlag_D",
    "zaz",
    "connection_time",
    "region",
    "kategorie",
    "filterableLabels",
    "pos",
    "create",
  ];
  dataSource: SbbTableDataSource<any>;
  private destroyed = new Subject<void>();

  constructor(
    public dialog: SbbDialog,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
  ) {
    this.uiInteractionService.baseDataEditDialog
      .pipe(takeUntil(this.destroyed))
      .subscribe((baseData) => {
        this.openDialog(baseData);
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

  openDialog(baseData: BaseData[]) {
    this.baseData = baseData;

    const baseDataConverted = [];
    this.baseData.forEach((std) => {
      baseDataConverted.push({
        betriebspunkt: std.getStationCode(),
        [HaltezeitFachCategories.IPV]: std.getHaltezeiten()[HaltezeitFachCategories.IPV],
        stopFlagIPV: std.getHaltezeiten()[HaltezeitFachCategories.IPV].no_halt ? 0 : 1,
        [HaltezeitFachCategories.A]: std.getHaltezeiten()[HaltezeitFachCategories.A],
        stopFlagA: std.getHaltezeiten()[HaltezeitFachCategories.A].no_halt ? 0 : 1,
        [HaltezeitFachCategories.B]: std.getHaltezeiten()[HaltezeitFachCategories.B],
        stopFlagB: std.getHaltezeiten()[HaltezeitFachCategories.B].no_halt ? 0 : 1,
        [HaltezeitFachCategories.C]: std.getHaltezeiten()[HaltezeitFachCategories.C],
        stopFlagC: std.getHaltezeiten()[HaltezeitFachCategories.C].no_halt ? 0 : 1,
        [HaltezeitFachCategories.D]: std.getHaltezeiten()[HaltezeitFachCategories.D],
        stopFlagD: std.getHaltezeiten()[HaltezeitFachCategories.D].no_halt ? 0 : 1,
        connection_time: std.getConnectionTime(),
        zaz: std.getBufferTime(),
        region: std.getRegions(),
        filterableLabels: std.getLabels(),
        kategorie: std.getCategories(),
        pos: std.getPosition(),
        create: std.getCreate(),
      });
    });

    this.dataSource = new SbbTableDataSource(baseDataConverted);
    const dialogConfig = BaseDataDialogComponent.getDialogConfig();
    const dialogRef = this.dialog.open(this.baseDataTemplate, dialogConfig);
  }
}
