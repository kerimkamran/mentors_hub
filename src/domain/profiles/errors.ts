/** An allowed action on the actor's own data failed validation: the actor already knows the object exists, so this is a normal form error. */
export class ValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (x: unknown): x is string => typeof x === "string" && UUID.test(x);
