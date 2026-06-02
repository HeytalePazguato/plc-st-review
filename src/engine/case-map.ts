/**
 * A `Map` whose string keys are matched case-insensitively unless it is
 * constructed with `caseSensitive = true`. Lookups (`get` / `has` / `delete`)
 * normalize the key, so a value can never be stored under one casing and then
 * missed under another — insertion and lookup always agree, which is the
 * failure mode this type exists to prevent.
 *
 * Whether identifiers are case-sensitive is dialect-dependent: generic
 * IEC 61131-3, Beckhoff/TwinCAT and CODESYS treat them as case-insensitive,
 * while B&R Automation Studio is case-sensitive. The symbol table picks the
 * mode from the resolved config (`case_sensitive`), defaulting to insensitive.
 *
 * The *original-cased* key is what gets stored, so iteration (`keys`,
 * `entries`, `values`, `forEach`, `for…of`, `size`) yields the real spelling
 * the author wrote — checks that surface an identifier (e.g. the unknown
 * argument name in CALL_SITE_OUTDATED) keep the user's casing. A separate
 * normalized index maps the folded key back to its stored original.
 */
export class CaseMap<V> extends Map<string, V> {
  readonly #caseSensitive: boolean;
  // normalized key -> the original-cased key currently stored in the base Map.
  readonly #index = new Map<string, string>();

  constructor(caseSensitive: boolean) {
    // No iterable argument: the Map constructor would invoke the overridden
    // `set` before the fields are initialized. Callers populate via `set`.
    super();
    this.#caseSensitive = caseSensitive;
  }

  #norm(key: string): string {
    return this.#caseSensitive ? key : key.toLowerCase();
  }

  override get(key: string): V | undefined {
    const orig = this.#index.get(this.#norm(key));
    return orig === undefined ? undefined : super.get(orig);
  }

  override has(key: string): boolean {
    return this.#index.has(this.#norm(key));
  }

  override set(key: string, value: V): this {
    const norm = this.#norm(key);
    // If the same logical key already exists under a different spelling,
    // replace it (last write wins) so there is exactly one entry per key.
    const prior = this.#index.get(norm);
    if (prior !== undefined && prior !== key) super.delete(prior);
    super.set(key, value);
    this.#index.set(norm, key);
    return this;
  }

  override delete(key: string): boolean {
    const norm = this.#norm(key);
    const orig = this.#index.get(norm);
    if (orig === undefined) return false;
    this.#index.delete(norm);
    return super.delete(orig);
  }

  override clear(): void {
    this.#index.clear();
    super.clear();
  }
}
