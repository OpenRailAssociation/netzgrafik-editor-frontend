import {FreeFloatingTextDto} from "../data-structures/business.data.structures";
import {DataMigration} from "../utils/data-migration";

export class Note {
  public static DEFAULT_NOTE_WIDTH = 192;
  public static DEFAULT_NOTE_HEIGHT = 64;
  public static DEFAULT_NOTE_POSITION_X = 0;
  public static DEFAULT_NOTE_POSITION_Y = 0;
  public static DEFAULT_NOTE_TITLE = $localize`:@@app.models.note.title-default:Note title`;
  public static DEFAULT_NOTE_TEXT = $localize`:@@app.models.note.text-default:Note text`;
  public static DEFAULT_NOTE_BACKGROUND_COLOR = "#ffffff";
  public static DEFAULT_NOTE_TEXT_COLOR = "#000000";
  public static DEFAULT_NOTE_ROTATION = 0;

  private static currentId = 0;
  private id: number;
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private title: string;
  private text: string;
  private backgroundColor: string;
  private textColor: string;
  private rotation: number;
  private isSelected: boolean;
  private labelIds: number[];

  constructor(
    {
      id,
      x,
      y,
      width,
      height,
      title,
      text,
      backgroundColor,
      textColor,
      rotation,
      labelIds,
    }: FreeFloatingTextDto = {
      id: Note.incrementId(),
      x: Note.DEFAULT_NOTE_POSITION_X,
      y: Note.DEFAULT_NOTE_POSITION_Y,
      width: Note.DEFAULT_NOTE_WIDTH,
      height: Note.DEFAULT_NOTE_HEIGHT,
      title: Note.DEFAULT_NOTE_TITLE,
      text: Note.DEFAULT_NOTE_TEXT,
      backgroundColor: Note.DEFAULT_NOTE_BACKGROUND_COLOR,
      textColor: Note.DEFAULT_NOTE_TEXT_COLOR,
      rotation: Note.DEFAULT_NOTE_ROTATION,
      labelIds: [],
    },
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.title = title;
    this.text = text;
    this.backgroundColor = backgroundColor;
    this.textColor = textColor;
    this.rotation = rotation;
    this.isSelected = false;
    this.labelIds = labelIds;

    if (Note.currentId < this.id) {
      Note.currentId = this.id;
    }

    DataMigration.migrateNoteLabelIds(this);
  }

  private static incrementId(): number {
    return ++Note.currentId;
  }

  select() {
    this.isSelected = true;
  }

  unselect() {
    this.isSelected = false;
  }

  selected(): boolean {
    return this.isSelected;
  }

  setWidth(width: number) {
    this.width = width;
  }

  setHeight(height: number) {
    this.height = height;
  }

  setPosition(positionX: number, positionY: number) {
    this.x = positionX;
    this.y = positionY;
  }

  setTitle(title: string) {
    this.title = title;
  }

  setText(text: string) {
    this.text = text;
  }

  getId(): number {
    return this.id;
  }

  getText(): string {
    return this.text;
  }

  getTitle(): string {
    return this.title;
  }

  getHeight(): number {
    return this.height;
  }

  getWidth(): number {
    return this.width;
  }

  getPositionX(): number {
    return this.x;
  }

  getPositionY(): number {
    return this.y;
  }

  getLabelIds(): number[] {
    return this.labelIds;
  }

  setLabelIds(labelIds: number[]) {
    this.labelIds = labelIds;
  }

  setBackgroundColor(backgroundColor: string) {
    this.backgroundColor = backgroundColor;
  }

  setTextColor(textColor: string) {
    this.textColor = textColor;
  }
   getRotation(): number {
    return this.rotation;
  }

   setRotation(rotation: number) {
    this.rotation = rotation;
  }
  getDto(): FreeFloatingTextDto {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      title: this.title,
      text: this.text,
      backgroundColor: this.backgroundColor,
      textColor: this.textColor,
      rotation: this.rotation,
      labelIds: this.labelIds,
    };
  }
}
