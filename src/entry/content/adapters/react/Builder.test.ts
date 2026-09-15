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

test("React receives prepared data and fresh DOM props while retaining state on the same target", async () => {
    const anchor = document.createElement("article");
    document.body.append(anchor);
    const calls: ContentScriptProps<{title: string}>[] = [];
    const events: ContentScriptEvent[] = [];

    const builder = new Builder({
        anchor,
        prepare: async () => ({title: "Product"}),

        main: context => {
            context.watch(event => events.push(event));
        },

        render: props => {
            const [count, setCount] = useState(0);
            calls.push(props);

            return createElement(
                "button",
                {onClick: () => setCount(value => value + 1)},
                `${props.data.title}:${count}`
            );
        },
    });

    try {
        await act(() => builder.build());
        const first = calls[0];
        expect(first.container).toBe(anchor.firstElementChild);
        expect(first.target).toBe(first.container);

        await act(() => {
            (anchor.querySelector("button") as HTMLButtonElement).click();
        });

        await act(() => {
            expect(builder.getContext().mount()).toBeUndefined();
        });

        expect(anchor.textContent).toBe("Product:1");
        events.length = 0;

        await act(() => {
            expect(builder.getContext().unmount()).toBeUndefined();
            expect(anchor.childElementCount).toBe(0);
            expect(events).toEqual([ContentScriptEvent.Unmount]);
            expect(builder.getContext().mount()).toBeUndefined();
            expect(events).toEqual([ContentScriptEvent.Unmount, ContentScriptEvent.Mount]);
        });

        expect(anchor.textContent).toBe("Product:0");
        expect(calls.at(-1)!.target).not.toBe(first.target);
        expect(calls.at(-1)!.data).toBe(first.data);
    } finally {
        await act(() => builder.destroy());
        anchor.remove();
    }
});

test.each([true, false])(
    "React handles headless mode and preparation rejection before invoking a component: %p",
    async headless => {
        const render = jest.fn(() => createElement("span"));
        const container = jest.fn(() => document.createElement("section"));

        const builder = new Builder({
            anchor: document.body,
            isolation: "shadow",
            container,
            ...(headless ? {render: true} : {prepare: async () => false, render}),
        });

        try {
            await act(() => builder.build());
            expect(builder.getContext().nodes.size).toBe(1);
            expect(render).not.toHaveBeenCalled();
            expect(container).not.toHaveBeenCalled();
        } finally {
            await act(() => builder.destroy());
        }
    }
);
