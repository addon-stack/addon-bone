import assert from "node:assert/strict";
import {AbstractLocale, DynamicLocale, NativeLocale} from "adnbn/locale";

assert.equal(typeof globalThis.chrome, "undefined");
assert.equal(Object.getPrototypeOf(DynamicLocale.prototype), AbstractLocale.prototype);
assert.equal(typeof NativeLocale, "function");
