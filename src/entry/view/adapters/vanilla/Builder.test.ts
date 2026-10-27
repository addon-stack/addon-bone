import Builder from "./Builder";

import type {ViewConfig, ViewRenderHandler} from "@typing/view";

describe("Vanilla view Builder", () => {
    afterEach(() => {
        document.body.replaceChildren();
        document.title = "";
    });

    test("prepends a container with the rendered element and sets the title", async () => {
        const existing = document.createElement("main");
        const element = document.createElement("p");
        const builder = new Builder<ViewConfig>({title: "Vanilla", render: () => element});

        document.body.append(existing);

        await builder.build();

        expect(document.title).toBe("Vanilla");
        expect(document.body.firstElementChild?.tagName).toBe("DIV");
        expect(document.body.firstElementChild?.firstElementChild).toBe(element);
        expect(document.body.lastElementChild).toBe(existing);
    });

    test("passes the definition options as render props", async () => {
        const render = jest.fn(() => "rendered");

        await new Builder<ViewConfig>({title: "Props", template: "page.html", render}).build();

        expect(render).toHaveBeenCalledWith({title: "Props", template: "page.html"});
    });

    test.each([
        ["an HTML string", "<b>bold</b>"],
        ["zero", 0],
    ])("renders %s as text", async (_, value) => {
        await new Builder<ViewConfig>({render: value}).build();

        expect(document.body.firstElementChild?.textContent).toBe(String(value));
        expect(document.body.firstElementChild?.children).toHaveLength(0);
    });

    test("creates the container from the container option", async () => {
        await new Builder<ViewConfig>({container: {tagName: "section", id: "root"}, render: "content"}).build();

        expect(document.body.firstElementChild?.outerHTML).toBe('<section id="root">content</section>');
    });

    test("awaits an asynchronous container before mounting the synchronous render value", async () => {
        const started = Promise.withResolvers<void>();
        const ready = Promise.withResolvers<Element>();
        const container = document.createElement("section");

        const builder = new Builder<ViewConfig>({
            title: "Async container",
            render: "content",
            container: async ({title}) => {
                container.title = title ?? "";
                started.resolve();

                return await ready.promise;
            },
        });

        const building = builder.build();
        await started.promise;

        expect(document.body.children).toHaveLength(0);

        ready.resolve(container);
        await building;

        expect(document.body.firstElementChild).toBe(container);
        expect(container.title).toBe("Async container");
        expect(container.textContent).toBe("content");

        await builder.destroy();
    });

    test.each([
        ["a Promise", Promise.withResolvers<string>().promise],
        ["a thenable", {then: jest.fn()}],
    ])("warns and skips the container without awaiting %s from an untyped render", async (_, value) => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const container = jest.fn(() => document.createElement("section"));
        const render = (() => value) as unknown as ViewRenderHandler<ViewConfig>;
        const builder = new Builder<ViewConfig>({render, container});

        try {
            await builder.build();

            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("Vanilla view render must be synchronous"));
            expect(container).not.toHaveBeenCalled();
            expect(document.body.children).toHaveLength(0);
        } finally {
            warn.mockRestore();
            await builder.destroy();
        }
    });

    test.each([
        ["without render", undefined],
        ["for an unsupported value", () => ({}) as unknown as string],
    ])("creates no container %s", async (_, render) => {
        await new Builder<ViewConfig>({title: "Empty", render}).build();

        expect(document.title).toBe("Empty");
        expect(document.body.children).toHaveLength(0);
    });

    test("rebuilding replaces the container and destroy removes it", async () => {
        const builder = new Builder<ViewConfig>({render: () => "content"});

        await builder.build();
        await builder.build();

        expect(document.body.children).toHaveLength(1);

        await builder.destroy();

        expect(document.body.children).toHaveLength(0);
    });
});
