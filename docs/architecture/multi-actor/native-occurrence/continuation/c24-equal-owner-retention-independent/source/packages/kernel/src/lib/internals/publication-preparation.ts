/** One operation's source preparation, never an ambient scheduler. */
export class PublicationPreparation {
  private readonly seals: Array<() => void> = [];
  private readonly validations: Array<() => void> = [];
  private sealed = false;
  add(seal: () => void, validate: () => void): void {
    if (this.sealed) throw new Error('Publication preparation is sealed');
    this.seals.push(seal);
    this.validations.push(validate);
  }
  seal(): void {
    if (this.sealed) throw new Error('Publication preparation already sealed');
    this.sealed = true;
    for (const seal of this.seals) seal();
  }
  /** Captured source checks only: no proof resampling or readiness delivery. */
  validate(): void {
    if (!this.sealed) throw new Error('Publication preparation is not sealed');
    for (const validate of this.validations) validate();
  }
}
