import {UntypedFormControl, UntypedFormGroup, ValidatorFn} from "@angular/forms";

export class FormModel<T> {
  private readonly keys: string[];
  private readonly form: UntypedFormGroup;
  private readonly controls: {[key: string]: UntypedFormControl} = {};

  private readonly validatorsByKey: Map<string, ValidatorFn[]> = new Map<string, ValidatorFn[]>();

  constructor(orig: T) {
    this.keys = Object.getOwnPropertyNames(orig);
    this.keys.forEach(
      (propertyName) => (this.controls[propertyName] = new UntypedFormControl(orig[propertyName])),
    );
    this.form = new UntypedFormGroup(this.controls);
  }

  getControl<K extends keyof T>(key: K): UntypedFormControl {
    const control = this.controls[key as string];

    if (!control) {
      const dummyControl = new UntypedFormControl("N/A", {});
      dummyControl.disable();
      return dummyControl;
    }

    return control;
  }

  registerValidator<K extends keyof T>(key: K, validator: ValidatorFn): this {
    if (!this.validatorsByKey.has(key as string)) {
      this.validatorsByKey.set(key as string, []);
    }

    const validators = this.validatorsByKey.get(key as string);
    validators.push(validator);

    this.controls[key as string].setValidators(validators);

    return this;
  }

  tryGetValid(): T | undefined {
    this.form.markAllAsTouched();

    if (this.form.valid) {
      const object: {[key: string]: any} = {};
      this.keys.forEach((key) => (object[key] = this.controls[key].value));

      return object as T;
    }

    return undefined;
  }
}
