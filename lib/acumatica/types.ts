/**
 * Acumatica Contract-Based REST API — primitive types.
 *
 * Every field on every entity is wrapped: `{ "OrderNbr": { "value": "SO001234" } }`.
 * We define a Field<T> wrapper and an Unwrap helper so entity modules can declare
 * a clean shape and let the client convert at the boundary.
 *
 * Spec references:
 *   - help.acumatica.com — "Representation of a Record in JSON Format"
 *   - Integration Development Guide PDF (Acumatica.com)
 */

export type Field<T> = { value: T | null };

/** Maps `{ Foo: Field<string>, Bar: Field<number> }` -> `{ Foo: string | null, Bar: number | null }`. */
export type Unwrap<T> = {
  [K in keyof T]: T[K] extends Field<infer U>
    ? U | null
    : T[K] extends Array<infer A>
      ? Array<Unwrap<A>>
      : T[K] extends object
        ? Unwrap<T[K]>
        : T[K];
};

/** A custom (extended) field on an entity. Contract v3 form. */
export type CustomField = {
  type: "CustomStringField" | "CustomDecimalField" | "CustomDateField" | "CustomBooleanField" | string;
  value: unknown;
};

/** File reference returned in `_links.files` / `files[]` on top-level entities. */
export type FileRef = {
  id: string;       // GUID
  filename: string;
  href: string;     // relative to instance base
};

/** Common envelope fields present on most Acumatica entities. */
export type EntityEnvelope = {
  id?: string;          // session-scoped GUID — DO NOT persist
  rowNumber?: number;
  note?: Field<string>;
  files?: FileRef[];
  custom?: Record<string, Record<string, CustomField>>;
  _links?: Record<string, string>;
};

export type ErrorCode =
  | "auth"
  | "permission"
  | "not_found"
  | "validation"
  | "rate_limit"
  | "size"
  | "server"
  | "network";

export class AcumaticaApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly exceptionType?: string;

  constructor(args: { status: number; code: ErrorCode; message: string; exceptionType?: string }) {
    super(args.message);
    this.name = "AcumaticaApiError";
    this.status = args.status;
    this.code = args.code;
    this.exceptionType = args.exceptionType;
  }
}
