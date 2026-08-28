import {isRemoteMessageError, markRemoteMessageError, restoreError, serializeError} from "./error";

describe("message error", () => {
    test("serializes a real Error with name, message and stack", () => {
        const serialized = serializeError(new TypeError("boom"));

        expect(serialized.name).toBe("TypeError");
        expect(serialized.message).toBe("boom");
        expect(typeof serialized.stack).toBe("string");
    });

    test("serializes error-like objects and primitives", () => {
        expect(serializeError({name: "Custom", message: "x"})).toEqual({name: "Custom", message: "x"});
        expect(serializeError({code: 1})).toEqual({name: "Error", message: JSON.stringify({code: 1})});
        expect(serializeError("oops")).toEqual({name: "Error", message: "oops"});
    });

    test("restores the native constructor from the serialized name", () => {
        const restored = restoreError({name: "TypeError", message: "boom"});

        expect(restored).toBeInstanceOf(TypeError);
        expect(restored.name).toBe("TypeError");
        expect(restored.message).toBe("boom");
    });

    test("round-trips an error through serialize and restore", () => {
        const restored = restoreError(serializeError(new RangeError("nope")));

        expect(restored).toBeInstanceOf(RangeError);
        expect(restored.message).toBe("nope");
    });

    test("falls back when the envelope is missing", () => {
        const restored = restoreError(undefined);

        expect(restored).toBeInstanceOf(Error);
        expect(restored.message).toBe("Request failed.");
    });

    test("brands restored remote errors without changing their native class", () => {
        const restored = markRemoteMessageError(restoreError({name: "TypeError", message: "boom"}));

        expect(restored).toBeInstanceOf(TypeError);
        expect(isRemoteMessageError(restored)).toBe(true);
        expect(isRemoteMessageError(new TypeError("local"))).toBe(false);
    });
});
