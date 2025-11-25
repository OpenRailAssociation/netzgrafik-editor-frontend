import {NgModule, Injector, DoBootstrap} from "@angular/core";
import {NgxEditorModule} from "ngx-editor";
import {BrowserModule} from "@angular/platform-browser";
import {createCustomElement} from "@angular/elements";
import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import {OAuthModule} from "angular-oauth2-oidc";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {SbbAccordionModule} from "@sbb-esta/angular/accordion";
import {SbbAutocompleteModule} from "@sbb-esta/angular/autocomplete";
import {SbbBreadcrumbModule} from "@sbb-esta/angular/breadcrumb";
import {SbbButtonModule} from "@sbb-esta/angular/button";
import {SbbCheckboxModule} from "@sbb-esta/angular/checkbox";
import {SbbChipsModule} from "@sbb-esta/angular/chips";
import {SbbDialogModule} from "@sbb-esta/angular/dialog";
import {SbbFileSelectorModule} from "@sbb-esta/angular/file-selector";
import {SbbHeaderLeanModule} from "@sbb-esta/angular/header-lean";
import {SbbIconModule} from "@sbb-esta/angular/icon";
import {SbbInputModule} from "@sbb-esta/angular/input";
import {SbbLoadingIndicatorModule} from "@sbb-esta/angular/loading-indicator";
import {SbbMenuModule} from "@sbb-esta/angular/menu";
import {SbbNotificationToastModule} from "@sbb-esta/angular/notification-toast";
import {SbbRadioButtonModule} from "@sbb-esta/angular/radio-button";
import {SbbSelectModule} from "@sbb-esta/angular/select";
import {SbbSidebarModule} from "@sbb-esta/angular/sidebar";
import {SbbTableModule} from "@sbb-esta/angular/table";
import {SbbTabsModule} from "@sbb-esta/angular/tabs";
import {SbbTextareaModule} from "@sbb-esta/angular/textarea";
import {SbbTooltipModule} from "@sbb-esta/angular/tooltip";
import {SbbUsermenuModule} from "@sbb-esta/angular/usermenu";
import {AppRoutingModule} from "./app-routing.module";
import {AppComponent} from "./app.component";
import {EditorMainViewComponent} from "./view/editor-main-view/editor-main-view.component";
import {ColumnLayoutComponent} from "./view/column-layout/column-layout.component";
import {NetzgrafikApplicationComponent} from "./netzgrafik-application/netzgrafik-application.component";
import {TrainrunTabComponent} from "./view/dialogs/trainrun-and-section-dialog/trainrun-tab/trainrun-tab.component";
import {TrainrunSectionTabComponent} from "./view/dialogs/trainrun-and-section-dialog/trainrunsection-tab/trainrun-section-tab.component";
import {TrainrunSectionCardComponent} from "./view/dialogs/trainrun-and-section-dialog/trainrunsection-card/trainrun-section-card.component";
import {EditorNodeDetailViewComponent} from "./view/editor-side-view/editor-node-detail-view/editor-node-detail-view.component";
import {EditorFilterViewComponent} from "./view/editor-filter-view/editor-filter-view.component";
import {EditorMenuComponent} from "./view/editor-menu/editor-menu.component";
import {EditorSideViewComponent} from "./view/editor-side-view/editor-side-view.component";
import {StammdatenDialogComponent} from "./view/dialogs/stammdaten-dialog/stammdaten-dialog.component";
import {TrainrunAndSectionDialogComponent} from "./view/dialogs/trainrun-and-section-dialog/trainrun-and-section-dialog.component";
import {ConfirmationDialogComponent} from "./view/dialogs/confirmation-dialog/confirmation-dialog.component";
import {SymmetrySelectionDialogComponent} from "./view/dialogs/symmetry-selection-dialog/symmetry-selection-dialog.component";
import {FilterMainSideViewComponent} from "./view/filter-main-side-view/filter-main-side-view.component";
import {KnotenAuslastungViewComponent} from "./view/knoten-auslastung-view/knoten-auslastung-view.component";
import {environment} from "../environments/environment";
import {BASE_PATH} from "./api/generated";
import {ProjectsViewComponent} from "./view/project/projects-view/projects-view.component";
import {CardGridComponent} from "./view/card-grid/card-grid.component";
import {CardComponent} from "./view/card-grid/card/card.component";
import {PageLayoutComponent} from "./view/page-layout/page-layout.component";
import {ProjectFormComponent} from "./view/project/project-dialog/project-form/project-form.component";
import {ProjectDialogComponent} from "./view/project/project-dialog/project-dialog.component";
import {VariantsViewComponent} from "./view/variant/variants-view/variants-view.component";
import {SlotsViewComponent} from "./view/slots-view/slots-view.component";
import {SlotComponent} from "./view/slots-view/slot/slot.component";
import {VariantViewComponent} from "./view/variant/variant-view/variant-view.component";
import {VariantHistoryComponent} from "./view/variant/variant-view/variant-history/variant-history.component";
import {HistoryEntryComponent} from "./view/variant/variant-view/variant-history/history-entry/history-entry.component";
import {ReleasedEntryComponent} from "./view/variant/variant-view/variant-history/released-entry/released-entry.component";
import {SnapshotEntryComponent} from "./view/variant/variant-view/variant-history/snapshot-entry/snapshot-entry.component";
import {PublishEntryComponent} from "./view/variant/variant-view/variant-history/publish-entry/publish-entry.component";
import {VersionEntriesComponent} from "./view/variant/variant-view/variant-history/version-entries/version-entries.component";
import {VersionEntryLayoutComponent} from "./view/variant/variant-view/variant-history/version-entry-layout/version-entry-layout.component";
import {VariantDialogComponent} from "./view/variant/variant-dialog/variant-dialog.component";
import {VariantFormComponent} from "./view/variant/variant-dialog/variant-form/variant-form.component";
import {ErrorViewComponent} from "./view/error-view/error-view.component";
import {HttpErrorInterceptor} from "./utils/http-error-interceptor";
import {PreviewButtonComponent} from "./view/variant/variant-view/variant-history/preview-button/preview-button.component";
import {NavigationBarComponent} from "./view/navigation-bar/navigation-bar.component";
import {EditorPropertiesViewComponent} from "./view/editor-properties-view-component/editor-properties-view.component";
import {TrainrunFilterTabComponent} from "./view/dialogs/trainrun-and-section-dialog/trainrun-filter-tab/trainrun-filter-tab.component";
import {TrainrunRoundtripTabComponent} from "./view/dialogs/trainrun-and-section-dialog/trainrun-roundtrip-tab/trainrun-roundtrip-tab.component";
import {EditorEditToolsViewComponent} from "./view/editor-edit-tools-view-component/editor-edit-tools-view.component";
import {FilterableLabelFormComponent} from "./view/dialogs/filterable-labels-dialog/filterable-labels-form/filterable-label-form.component";
import {FilterableLabelDialogComponent} from "./view/dialogs/filterable-labels-dialog/filterable-label-dialog.component";
import {EditorToolsViewComponent} from "./view/editor-tools-view-component/editor-tools-view.component";
import {NoteDialogComponent} from "./view/dialogs/note-dialog/note-dialog.component";
import {NoteFormComponent} from "./view/dialogs/note-dialog/note-form/note-form.component";
import {HtmlEditorComponent} from "./view/dialogs/note-dialog/htmlEditor/html-editor.component";
import {DragDropModule} from "@angular/cdk/drag-drop";
import {LabelDropListComponent} from "./view/editor-edit-tools-view-component/label-drop-list/label-drop-list.component";
import {FilterableLabelFilterComponent} from "./view/editor-filter-view/filterable-label-filter/filterable-label-filter.component";
import {NoteFilterTabComponent} from "./view/dialogs/note-dialog/note-filter-tab/note-filter-tab.component";
import {NoteEditElementComponent} from "./view/dialogs/note-dialog/note-edit-element.component";
import {LogNotificationToastComponent} from "./logger/log-notification-toast.component";
import {StreckengrafikComponent} from "./streckengrafik/components/streckengrafik.component";
import {TimeSliderComponent} from "./streckengrafik/components/slider/time-slider/time-slider.component";
import {DrawingBackgroundMouseListenerComponent} from "./streckengrafik/components/util/drawing-background-mouse-listener/drawing-background-mouse-listener.component";
import {TimelineComponent} from "./streckengrafik/components/slider/timeline/timeline.component";
import {PerlenketteComponent} from "./perlenkette/perlenkette.component";
import {TimeGridComponent} from "./streckengrafik/components/grid/time-grid/time-grid.component";
import {PerlenketteNodeComponent} from "./perlenkette/perlenkette-node/perlenkette-node.component";
import {PerlenketteSectionComponent} from "./perlenkette/perlenkette-section/perlenkette-section.component";
import {TrainRunComponent} from "./streckengrafik/components/train-run/train-run.component";
import {TrainRunItemComponent} from "./streckengrafik/components/train-run-item/train-run-item.component";
import {TrainRunSectionComponent} from "./streckengrafik/components/train-run-section/train-run-section.component";
import {PathSliderComponent} from "./streckengrafik/components/slider/path-slider/path-slider.component";
import {PathSliderTrackSegmentsComponent} from "./streckengrafik/components/slider/path-slider-track-segments/path-slider-track-segments.component";
import {TrainRunSectionStopsComponentComponent} from "./streckengrafik/components/train-run-section-stops-component/train-run-section-stops-component.component";
import {PathGridComponent} from "./streckengrafik/components/grid/path-grid/path-grid.component";
import {TrainRunNodeComponent} from "./streckengrafik/components/train-run-node/trainrun-node.component";
import {ActionMenuComponent} from "./view/action-menu/action-menu/action-menu.component";
import {I18nModule} from "./core/i18n/i18n.module";
import {OriginDestinationComponent} from "./services/analytics/origin-destination/components/origin-destination.component";
import {SbbToggleModule} from "@sbb-esta/angular/toggle";
import {ToggleSwitchButtonComponent} from "./view/toggle-switch-button/toggle-switch-button.component";

@NgModule({
  declarations: [
    AppComponent,
    EditorMainViewComponent,
    ColumnLayoutComponent,
    NetzgrafikApplicationComponent,
    TrainrunTabComponent,
    TrainrunFilterTabComponent,
    TrainrunRoundtripTabComponent,
    TrainrunSectionTabComponent,
    TrainrunSectionCardComponent,
    EditorNodeDetailViewComponent,
    EditorFilterViewComponent,
    StammdatenDialogComponent,
    EditorMenuComponent,
    EditorSideViewComponent,
    TrainrunAndSectionDialogComponent,
    ConfirmationDialogComponent,
    SymmetrySelectionDialogComponent,
    FilterMainSideViewComponent,
    KnotenAuslastungViewComponent,
    ProjectsViewComponent,
    CardGridComponent,
    CardComponent,
    PageLayoutComponent,
    ProjectFormComponent,
    ProjectDialogComponent,
    VariantsViewComponent,
    SlotsViewComponent,
    SlotComponent,
    VariantViewComponent,
    VariantHistoryComponent,
    HistoryEntryComponent,
    ReleasedEntryComponent,
    SnapshotEntryComponent,
    PublishEntryComponent,
    VersionEntriesComponent,
    VersionEntryLayoutComponent,
    ErrorViewComponent,
    VariantDialogComponent,
    VariantFormComponent,
    PreviewButtonComponent,
    NavigationBarComponent,
    EditorPropertiesViewComponent,
    EditorEditToolsViewComponent,
    FilterableLabelDialogComponent,
    FilterableLabelFormComponent,
    NoteDialogComponent,
    NoteEditElementComponent,
    NoteFormComponent,
    EditorToolsViewComponent,
    HtmlEditorComponent,
    NoteFilterTabComponent,
    LabelDropListComponent,
    FilterableLabelFilterComponent,
    ActionMenuComponent,
    LogNotificationToastComponent,
    StreckengrafikComponent,
    OriginDestinationComponent,
    TimelineComponent,
    TimeSliderComponent,
    DrawingBackgroundMouseListenerComponent,
    PerlenketteComponent,
    TimeGridComponent,
    PathGridComponent,
    PerlenketteNodeComponent,
    PerlenketteSectionComponent,
    TrainRunComponent,
    TrainRunItemComponent,
    TrainRunSectionComponent,
    TrainRunNodeComponent,
    PathSliderComponent,
    PathSliderTrackSegmentsComponent,
    TrainRunSectionStopsComponentComponent,
    PathGridComponent,
    ToggleSwitchButtonComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    DragDropModule,
    AppRoutingModule,
    HttpClientModule,
    NgxEditorModule,
    NgxEditorModule.forRoot({
      locals: {
        // menu
        bold: "Fett",
        italic: "Kursiv",
        bullet_list: "Aufzählungszeichen",
        text_color: "Textfarbe",
        url: "URL",
        text: "Text",
        title: "Titel",
        insertLink: "Link einfügen",
        removeLink: "Link entfernen",
        remove: "entfernen",
      },
    }),
    OAuthModule.forRoot({
      resourceServer: {
        // Add your api addresses here. When sendAccessToken is set to true,
        // and you send a request to these, the access token is appended.
        // Documentation:
        // https://manfredsteyer.github.io/angular-oauth2-oidc/docs/additional-documentation/working-with-httpinterceptors.html
        allowedUrls: environment.backendUrl ? [environment.backendUrl] : [],
        sendAccessToken: true,
      },
    }),
    SbbHeaderLeanModule,
    SbbDialogModule,
    SbbSelectModule,
    SbbCheckboxModule,
    SbbRadioButtonModule,
    SbbToggleModule,
    SbbTableModule,
    SbbIconModule,
    SbbAccordionModule,
    SbbTabsModule,
    SbbLoadingIndicatorModule,
    SbbUsermenuModule,
    SbbButtonModule,
    SbbInputModule,
    SbbFileSelectorModule,
    SbbMenuModule,
    SbbSidebarModule,
    SbbTextareaModule,
    SbbNotificationToastModule,
    SbbChipsModule,
    SbbTooltipModule,
    SbbBreadcrumbModule,
    SbbAutocompleteModule,
    I18nModule,
  ],
  bootstrap: environment.customElement ? [] : [AppComponent],
  providers: [
    ...(environment.backendUrl ? [{provide: BASE_PATH, useValue: environment.backendUrl}] : []),
    {provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true},
  ],
})
export class AppModule implements DoBootstrap {
  constructor(private injector: Injector) {}

  ngDoBootstrap() {
    if (environment.customElement) {
      const element = createCustomElement(AppComponent, {
        injector: this.injector,
      });
      customElements.define("sbb-root", element);
    }
  }
}
