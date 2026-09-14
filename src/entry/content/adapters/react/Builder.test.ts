import {act} from "@testing-library/react";
import {createElement, useEffect, useState} from "react";

import Builder from "./Builder";
import {resolveDefinition} from "./resolvers/definition";
import {ContentScriptEvent, type ContentScriptContext, type ContentScriptProps} from "@typing/content";

// Extend the shared random-ID mock for the builders' generated marker attribute.
jest.mock("nanoid", () => ({
    nanoid: jest.fn(() => "mocked-id"),
    customAlphabet: () => () => "contentmarker",
}));

describe("React Builder", () => {
    afterEach(() => document.body.replaceChildren());

    test("React renders a default component with hooks and cleans up its effects", async () => {
        const anchor = document.createElement("article");
        document.body.appendChild(anchor);
        const events: (ContentScriptEvent | "effect-cleanup")[] = [];
        const cleanup = jest.fn(() => {
            events.push("effect-cleanup");
        });
        const render = jest.fn(({anchor: target}: ContentScriptProps) => {
            const [label] = useState(target.tagName);
            useEffect(() => cleanup, []);
            return createElement("span", null, label);
        });
        const definition = resolveDefinition({
            anchor,
            default: render,
            main: (context: ContentScriptContext) => {
                context.watch(event => events.push(event));
            },
        });
        expect(definition.render).toBe(render);
        expect(render).not.toHaveBeenCalled();
        const builder = new Builder(definition);

        try {
            await act(() => builder.build());
            expect(anchor.querySelector("span")?.textContent).toBe("ARTICLE");
            expect(render).toHaveBeenCalled();
        } finally {
            await act(() => builder.destroy());
        }
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(anchor.childElementCount).toBe(0);
        expect(events).toEqual([
            ContentScriptEvent.Add,
            ContentScriptEvent.Mount,
            "effect-cleanup",
            ContentScriptEvent.Unmount,
            ContentScriptEvent.Remove,
        ]);
    });

    test("React recognizes and renders an element through its native API", async () => {
        const element = createElement("strong", null, "React element");
        const definition = resolveDefinition({default: element});
        expect(definition).toEqual({render: element});
        const builder = new Builder(definition);
        try {
            await act(() => builder.build());
            expect(document.querySelector("strong")?.textContent).toBe("React element");
        } finally {
            await act(() => builder.destroy());
        }
    });
});
