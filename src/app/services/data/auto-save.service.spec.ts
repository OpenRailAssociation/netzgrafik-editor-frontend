import {Subject} from "rxjs";
import {AutoSaveService} from "./auto-save.service";
import {DataService} from "./data.service";

describe("AutoSaveService", () => {
  let changes: Subject<void>;
  let model: {value: number};
  let service: AutoSaveService;

  beforeEach(() => {
    changes = new Subject<void>();
    model = {value: 1};
    const dataService = {
      getNetzgrafikDto: () => ({...model}),
      getNetzgrafikChangesObservable: () => changes.asObservable(),
    } as unknown as DataService;
    service = new AutoSaveService(dataService);
    service.reset();
  });

  const change = (value: number) => {
    model.value = value;
    changes.next();
  };

  it("is modified compared to the persisted state", () => {
    change(2);
    expect(service.isModified()).toBeTrue();

    change(1);
    expect(service.isModified()).toBeFalse();
  });

  it("stays modified if the model changed while saving", () => {
    change(2);
    const sentJson = service.getCurrentNetzgrafikJson();
    change(3);

    service.markSaved(sentJson);

    expect(service.isModified()).toBeTrue();
  });

  it("is not modified after saving the current state", () => {
    change(2);

    service.markSaved(service.getCurrentNetzgrafikJson());

    expect(service.isModified()).toBeFalse();
  });

  it("does not report modifications while disabled", () => {
    change(2);
    const sentJson = service.getCurrentNetzgrafikJson();
    service.disable();
    change(3);

    service.markSaved(sentJson);

    expect(service.isModified()).toBeFalse();
  });
});
