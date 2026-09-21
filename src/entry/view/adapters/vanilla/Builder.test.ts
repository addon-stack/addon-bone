import Builder from "./Builder";

import type {ViewConfig} from "@typing/view";

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
        ["an HTML string as markup", "<b>bold</b>", "<b>bold</b>"],
        ["zero as text", 0, "0"],
    ])("renders %s", async (_, value, html) => {
        await new Builder<ViewConfig>({render: value}).build();

        expect(document.body.firstElementChild?.innerHTML).toBe(html);
    });

    test("creates the container from the container option", async () => {
        await new Builder<ViewConfig>({container: {tagName: "section", id: "root"}, render: "content"}).build();

        expect(document.body.firstElementChild?.outerHTML).toBe('<section id="root">content</section>');
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
