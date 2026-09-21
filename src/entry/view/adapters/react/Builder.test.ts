import {act} from "@testing-library/react";
import {createElement, useEffect} from "react";

import Builder from "./Builder";

import type {ViewConfig} from "@typing/view";

describe("React view Builder", () => {
    afterEach(() => {
        document.body.replaceChildren();
        document.title = "";
    });

    test("renders a component with the definition options as props", async () => {
        const builder = new Builder<ViewConfig>({
            title: "React",
            render: ({title}: ViewConfig) => createElement("p", null, `Title: ${title}`),
        });

        await act(() => builder.build());

        expect(document.title).toBe("React");
        expect(document.body.firstElementChild?.innerHTML).toBe("<p>Title: React</p>");

        await act(() => builder.destroy());
    });

    test("renders a React element value", async () => {
        const builder = new Builder<ViewConfig>({render: createElement("strong", null, "element")});

        await act(() => builder.build());

        expect(document.body.firstElementChild?.innerHTML).toBe("<strong>element</strong>");

        await act(() => builder.destroy());
    });

    test("destroy unmounts the React tree before removing the container", async () => {
        const events: string[] = [];

        const Component = () => {
            useEffect(() => {
                events.push("mounted");

                return () => {
                    events.push(`cleanup, connected: ${document.body.children.length === 1}`);
                };
            }, []);

            return createElement("p", null, "effects");
        };

        const builder = new Builder<ViewConfig>({render: Component});

        await act(() => builder.build());
        await act(() => builder.destroy());

        expect(events).toEqual(["mounted", "cleanup, connected: true"]);
        expect(document.body.children).toHaveLength(0);
    });

    test.each([
        ["an HTML string", "<b>bold</b>"],
        ["zero", 0],
    ])("renders %s as text", async (_, value) => {
        await act(() => new Builder<ViewConfig>({render: value}).build());

        expect(document.body.firstElementChild?.textContent).toBe(String(value));
        expect(document.body.firstElementChild?.children).toHaveLength(0);
    });

    test("appends a DOM element render value", async () => {
        const element = document.createElement("p");

        await act(() => new Builder<ViewConfig>({render: element}).build());

        expect(document.body.firstElementChild?.firstElementChild).toBe(element);
    });

    test("creates no container for an unsupported value", async () => {
        await act(() => new Builder<ViewConfig>({title: "Empty", render: true}).build());

        expect(document.title).toBe("Empty");
        expect(document.body.children).toHaveLength(0);
    });
});
