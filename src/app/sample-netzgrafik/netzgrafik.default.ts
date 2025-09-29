import {NetzgrafikDto} from "../data-structures/business.data.structures";
import {environment} from "../../environments/environment";
import netzgrafikDemoStandaloneGithub from "./netzgrafik_demo_standalone_github.json";
import netzgrafikDefaultJson from "./netzgrafik_default.json";

export class NetzgrafikDefault {
  static getDefaultNetzgrafik(): NetzgrafikDto {
    if (environment.standalonedemo) {
      return this.getNetzgrafikDemoStandaloneGithub();
    }
    return JSON.parse(JSON.stringify(netzgrafikDefaultJson)) as NetzgrafikDto;
  }

  static getNetzgrafikDemoStandaloneGithub(): NetzgrafikDto {
    return JSON.parse(JSON.stringify(netzgrafikDemoStandaloneGithub)) as NetzgrafikDto;
  }
}
