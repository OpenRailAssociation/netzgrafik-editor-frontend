import {Component, Input, OnDestroy, OnInit} from "@angular/core";
import {Editor, Toolbar} from "ngx-editor";
import {FormModel} from "../../../../utils/form-model";
import {NoteFormComponentModel} from "../note-form/note-form.component";
import {HtmlEditorColor} from "./html-editor-color";
import {Subscription} from "rxjs";
import {getSelectionMarks, isMarkActive} from "ngx-editor/helpers";
import {StaticDomTags} from "../../../editor-main-view/data-views/static.dom.tags";

@Component({
  selector: "sbb-html-editor",
  templateUrl: "./html-editor.component.html",
  styleUrls: ["./html-editor.component.scss"],
})
export class HtmlEditorComponent implements OnInit, OnDestroy {
  @Input() model!: FormModel<NoteFormComponentModel>;

  editor: Editor;
  toolbar: Toolbar = [["bold", "italic"], ["bullet_list"], ["link"]];
  colorPresets: HtmlEditorColor[] = [
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.ec.title:Use color of the color scheme for EC`,
      "EC",
      "var(--" +
        StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC_" +
        StaticDomTags.TAG_FOCUS.toUpperCase() +
        ")",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.ic.title:Use color of the color scheme for IC`,
      "IC",
      "var(--" +
        StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC_" +
        StaticDomTags.TAG_FOCUS.toUpperCase() +
        ")",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.ir.title:Use color of the color scheme for IR`,
      "IR",
      "var(--" +
        StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR_" +
        StaticDomTags.TAG_FOCUS.toUpperCase() +
        ")",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.re.title:Use color of the color scheme for RE`,
      "RE",
      "var(--" +
        StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE_" +
        StaticDomTags.TAG_FOCUS.toUpperCase() +
        ")",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.s.title:Use color of the color scheme for S`,
      "S",
      "var(--" +
        StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S_" +
        StaticDomTags.TAG_FOCUS.toUpperCase() +
        ")",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.gex.title:Use color of the color scheme for GEX`,
      "GEX",
      "var(--" +
        StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX_" +
        StaticDomTags.TAG_FOCUS.toUpperCase() +
        ")",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.g.title:Use color of the color scheme for G`,
      "G",
      "var(--" +
        StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G_" +
        StaticDomTags.TAG_FOCUS.toUpperCase() +
        ")",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.green.title:green`,
      "",
      "green",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.blue.title:blue`,
      "",
      "blue",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.magenta.title:magenta`,
      "",
      "magenta",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.red.title:red`,
      "",
      "red",
    ),
    new HtmlEditorColor(
      $localize`:@@app.view.dialogs.note-dialog.html-editor.color-presets.warning.title:warning color`,
      "!",
      "var(--COLOR_Warning)",
    ),
  ];

  updateSubscription: Subscription;
  textBasedActiveColor: string[] = [];

  ngOnInit(): void {
    this.editor = new Editor();

    this.updateSubscription = this.editor.update.subscribe((view) => {
      this.update(view);
    });
  }

  ngOnDestroy(): void {
    this.updateSubscription.unsubscribe();
    this.editor.destroy();
  }

  onKeydown(event) {
    if (event.key === "Enter") {
      this.onUpdate();
    }
  }

  onUpdate() {
    this.updateNote();
  }

  onColor(color: HtmlEditorColor) {
    if (this.textBasedActiveColor.find((col: string) => col === color.colorCode) !== undefined) {
      this.editor.commands.removeTextColor().exec();
      this.onUpdate();
      return;
    }
    this.editor.commands.textColor(color.colorCode).exec();
    this.onUpdate();
  }

  setActiveColor(colorStr): boolean {
    return true;
  }

  getColorStyle(color: HtmlEditorColor): string {
    if (color === undefined) {
      if (this.textBasedActiveColor.length > 0) {
        return "opactiy: 1.0";
      }
      return "opacity: 0.25";
    }
    return "background: " + color.colorCode + "; color: var(--sbb-color-white);";
  }

  setClassedTag(color: HtmlEditorColor): string {
    if (color === undefined) {
      if (this.textBasedActiveColor.length > 0) {
        return "active";
      }
      return "inactive";
    }
    if (this.textBasedActiveColor.find((col: string) => col === color.colorCode) !== undefined) {
      return "active";
    }
    return "inactive";
  }

  onRemoveColor() {
    this.editor.commands.removeTextColor().exec();
    this.onUpdate();
  }

  getColorTitle(color: HtmlEditorColor): string {
    return color.title;
  }

  getColorButtonText(color: HtmlEditorColor): string {
    return color.buttonText;
  }

  private updateNote() {
    this.model.tryGetValid();
    const newNoteTitle: string = this.model.getControl("noteTitle").value;
    const newNoteText: string = this.model.getControl("noteText").value;
    const newNoteHeight: string = this.model.getControl("noteHeight").value;
    const newNoteWidth: string = this.model.getControl("noteWidth").value;
    const saveNoteCallback = this.model.getControl("saveNoteCallback").value;
    saveNoteCallback(
      this.model.getControl("id").value,
      newNoteTitle,
      newNoteText,
      newNoteHeight,
      newNoteWidth,
    );
  }

  private update = (view: any) => {
    const {state} = view;
    this.textBasedActiveColor = this.getColorActive(state);
  };

  private getColorActive(state: any): string[] {
    const {schema} = state;
    const type = schema.marks.text_color;
    if (!type) {
      return [];
    }
    if (!isMarkActive(state, type)) {
      return [];
    }
    return getSelectionMarks(state)
      .filter((mark) => mark.type === type)
      .map((mark) => mark.attrs.color)
      .filter(Boolean);
  }
}
