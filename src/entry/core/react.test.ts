import {createElement, Fragment} from "react";
import {createPortal} from "react-dom";

import {isReactRenderValue} from "./react";

describe("React render values", () => {
    test.each([
        ["an element", createElement("p")],
        ["a fragment", createElement(Fragment, null, "text")],
        ["an array of nodes", [createElement("p", {key: "p"}), "text"]],
        ["an empty array", []],
        ["an iterable of nodes", new Set([createElement("p", {key: "p"})])],
        ["a portal", createPortal(createElement("p"), document.createElement("div"))],
        ["a bigint", 42n],
    ])("accepts %s", (_, value) => {
        expect(isReactRenderValue(value)).toBe(true);
    });

    test.each([
        ["a string, which is framework-independent text", "text"],
        ["a number, which is framework-independent text", 42],
        ["a DOM element, which is framework-independent", document.createElement("p")],
        ["an options object", {title: "Options"}],
        ["an object with a string $$typeof", {$$typeof: "application metadata"}],
        ["an object with an undefined iterator", {title: "Options", [Symbol.iterator]: undefined}],
        ["an object with a null iterator", {title: "Options", [Symbol.iterator]: null}],
        ["an object with a non-function iterator", {title: "Options", [Symbol.iterator]: 1}],
        ["a promise", Promise.resolve(createElement("p"))],
        ["a boolean", true],
        ["null", null],
        ["undefined", undefined],
    ])("rejects %s", (_, value) => {
        expect(isReactRenderValue(value)).toBe(false);
    });
});
