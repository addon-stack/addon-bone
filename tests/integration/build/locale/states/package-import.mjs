import assert from "node:assert/strict";
import {
    getIcons,
    getEntrypointAssets,
    getEntrypointAssetsMap,
    getOffscreen,
    getOffscreens,
    getPages,
    getPopups,
    getRelay,
    getSandbox,
    getSandboxes,
    getSidebars,
} from "adnbn";
import {AbstractLocale, DynamicLocale, NativeLocale} from "adnbn/locale";

assert.equal(typeof globalThis.chrome, "undefined");
assert.equal(Object.getPrototypeOf(DynamicLocale.prototype), AbstractLocale.prototype);
assert.equal(typeof NativeLocale, "function");
assert.equal(getPages().size, 0);
assert.throws(() => getEntrypointAssets(), {message: "Current entrypoint assets are unavailable in this runtime"});
assert.throws(() => getEntrypointAssetsMap(), {
    message: "getEntrypointAssetsMap() is available only in the background entrypoint",
});
assert.throws(() => getRelay("missing", 1), {message: 'Failed to get relay "missing"'});

const errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args);
try {
    for (const getMap of [getPopups, getSidebars, getOffscreens, getSandboxes, getIcons]) {
        assert.equal(getMap().size, 0);
    }
    assert.throws(() => getOffscreen("missing"), {message: "Unable to get offscreen: missing"});
    assert.throws(() => getSandbox("missing"), {message: "Unable to get sandbox: missing"});
} finally {
    console.error = originalError;
}
assert.deepEqual(errors, []);
