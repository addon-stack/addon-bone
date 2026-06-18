import {createHash} from "node:crypto";
import stringify from "json-stringify-deterministic";

/**
 * Stable hash of any JSON-serializable value, order-independent for objects (keys are sorted by
 * `json-stringify-deterministic`). Used to compare dev-topology slices without storing — or
 * being sensitive to the key order of — potentially large option/value objects.
 */
export const hash = (value: unknown): string => createHash("sha1").update(stringify(value)).digest("hex");
