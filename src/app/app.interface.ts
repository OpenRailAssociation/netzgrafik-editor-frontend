import {NetzgrafikDto, FreeFloatingTextDto} from "./data-structures/business.data.structures";

/**
 * Public-facing custom element properties and methods.
 *
 * This API can be used to control NGE in standalone mode.
 */
export interface AppElementInterface {
  language: string;
  netzgrafikDto: NetzgrafikDto;
  activeFilterSettingId: number;

  createNote(note: Omit<FreeFloatingTextDto, "id">): FreeFloatingTextDto;
  updateNote(note: FreeFloatingTextDto): void;
  deleteNote(noteId: number): void;
}
