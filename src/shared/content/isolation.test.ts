/** @jest-environment node */
import {isContentScriptFrameNavigation, resolveContentScriptIsolation} from "./isolation";
import {ContentScriptIsolation, ContentScriptShadowMode} from "@typing/content";

test.each([
    [undefined, {type: "none"}],
    ["none", {type: "none"}],
    [{type: "none"}, {type: "none"}],
    [ContentScriptIsolation.Shadow, {type: "shadow", mode: "open"}],
    [{type: "shadow"}, {type: "shadow", mode: "open"}],
    [
        {type: "shadow", mode: ContentScriptShadowMode.Closed},
        {type: "shadow", mode: "closed"},
    ],
    ["iframe", {type: "iframe", width: "100%", height: 150}],
    [
        {type: "iframe", height: 320},
        {type: "iframe", width: "100%", height: 320},
    ],
    [
        {type: "iframe", page: "panel"},
        {type: "iframe", page: "panel", width: "100%", height: 150},
    ],
])("normalizes isolation %j without changing the supplied object", (input, expected) => {
    if (input && typeof input === "object") Object.freeze(input);
    expect(resolveContentScriptIsolation(input)).toEqual(expected);
});

test.each([
    [undefined, false],
    ["iframe", false],
    [{type: "iframe", height: 320}, false],
    [{type: "iframe", page: "panel"}, true],
    [{type: "iframe", src: "https://example.com/panel"}, true],
    [{type: "shadow", page: "panel"}, false],
])("recognizes navigation independently from shorthand normalization: %j", (isolation, expected) => {
    expect(isContentScriptFrameNavigation(isolation)).toBe(expected);
    if (expected)
        expect(() => resolveContentScriptIsolation(isolation, true)).toThrow(/cannot be combined with render/);
});

test.each([
    [true, /isolation must be/],
    [null, /isolation must be/],
    [[], /isolation must be/],
    [{}, /isolation.type must be/],
    ["unknown", /isolation.type must be/],
    [{type: "none", mode: "open"}, /isolation.mode is not supported/],
    [{type: "iframe", mode: "closed"}, /isolation.mode is not supported/],
    [{type: "shadow", height: 100}, /isolation.height is not supported/],
    [{type: "shadow", mode: "close"}, /isolation.mode must be "open" or "closed"/],
    [{type: "shadow", mode: false}, /isolation.mode must be/],
    [{type: "shadow", delegatesFocus: true}, /isolation.delegatesFocus is not supported/],
    [{type: "iframe", page: "panel", src: "https://example.com"}, /mutually exclusive/],
    [{type: "iframe", page: ""}, /page alias/],
    [{type: "iframe", src: "/relative"}, /absolute HTTP/],
    [{type: "iframe", src: "javascript:alert(1)"}, /absolute HTTP/],
    [{type: "iframe", src: "https://"}, /valid absolute URL/],
    [{type: "iframe", width: -1}, /pixels or a CSS size/],
    [{type: "iframe", height: Infinity}, /pixels or a CSS size/],
    [{type: "iframe", height: " auto "}, /not supported yet/],
])("rejects invalid isolation %j", (isolation, error) => {
    expect(() => resolveContentScriptIsolation(isolation)).toThrow(error as RegExp);
});
