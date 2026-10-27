import {EventEmitter} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {AppComponent} from "./app.component";
import {AuthService} from "./services/auth/auth.service";
import {NoteService} from "./services/data/note.service";
import {UiInteractionService} from "./services/ui/ui.interaction.service";
import {FreeFloatingTextDto} from "./data-structures/business.data.structures";

describe("AppComponent", () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let noteService: jasmine.SpyObj<NoteService>;
  let uiInteractionService: jasmine.SpyObj<UiInteractionService>;

  const note: FreeFloatingTextDto = {
    id: 42,
    x: 0,
    y: 0,
    width: 192,
    height: 64,
    title: "Title",
    text: "Text",
    backgroundColor: "#ffffff",
    textColor: "#000000",
    labelIds: [],
  };

  beforeEach(async () => {
    noteService = jasmine.createSpyObj<NoteService>(
      "NoteService",
      ["syncCreatedNote", "syncUpdatedNote", "syncDeletedNote"],
      {operation: new EventEmitter()},
    );
    uiInteractionService = jasmine.createSpyObj<UiInteractionService>(
      "UiInteractionService",
      ["closeNoteDialog", "closeTrainrunDialog"],
      {operation: new EventEmitter()},
    );

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        {provide: AuthService, useValue: {initialized: Promise.resolve()}},
        {provide: NoteService, useValue: noteService},
        {provide: UiInteractionService, useValue: uiInteractionService},
      ],
    })
      .overrideTemplate(AppComponent, "")
      .compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it("note methods throw before initialization", () => {
    expect(() => component.createNote({...note})).toThrowError();
    expect(() => component.updateNote({...note})).toThrowError();
    expect(() => component.deleteNote(note.id)).toThrowError();
    expect(noteService.syncCreatedNote).not.toHaveBeenCalled();
    expect(noteService.syncUpdatedNote).not.toHaveBeenCalled();
    expect(noteService.syncDeletedNote).not.toHaveBeenCalled();
  });

  describe("once initialized", () => {
    beforeEach(() => fixture.detectChanges());

    it("createNote adds the note", () => {
      component.createNote(note);
      expect(noteService.syncCreatedNote).toHaveBeenCalledOnceWith(note);
    });

    it("updateNote updates the note", () => {
      component.updateNote(note);
      expect(noteService.syncUpdatedNote).toHaveBeenCalledOnceWith(note);
    });

    it("note methods are exposed on the host element", () => {
      fixture.nativeElement.createNote(note);
      fixture.nativeElement.updateNote(note);
      fixture.nativeElement.deleteNote(note.id);
      expect(noteService.syncCreatedNote).toHaveBeenCalledOnceWith(note);
      expect(noteService.syncUpdatedNote).toHaveBeenCalledOnceWith(note);
      expect(noteService.syncDeletedNote).toHaveBeenCalledOnceWith(note.id);
    });

    it("deleteNote removes the note and closes its dialog", () => {
      component.deleteNote(note.id);
      expect(noteService.syncDeletedNote).toHaveBeenCalledOnceWith(note.id);
      expect(uiInteractionService.closeNoteDialog).toHaveBeenCalledOnceWith(note.id);
    });
  });
});
