import {waitFor} from "@testing-library/react";

import offscreen, {Builder, resolveDefinition} from "./index";
import VanillaBuilder from "../view/adapters/vanilla/Builder";
import OffscreenManager from "@offscreen/OffscreenManager";

import {OffscreenGlobalAccess} from "@typing/offscreen";

describe("Offscreen startup", () => {
    const manager = OffscreenManager.getInstance();

    afterEach(() => {
        manager.clear();
        document.body.replaceChildren();
        document.title = "";
        delete globalThis[OffscreenGlobalAccess];
    });

    test("starts a normalized module with the selected view builder", async () => {
        const instance = {ready: true};
        const init = jest.fn(() => instance);
        const main = jest.fn();

        const definition = resolveDefinition(
            {default: init, name: "source-name", title: "Worker", render: () => "Offscreen text", main},
            "build-name"
        );

        expect(offscreen(definition, VanillaBuilder)).toBeUndefined();

        await waitFor(() => expect(document.body.textContent).toBe("Offscreen text"));

        expect(document.title).toBe("Worker");
        expect(manager.get("build-name")).toBe(instance);
        expect(manager.has("source-name")).toBe(false);
        expect(main).toHaveBeenCalledWith(instance, expect.objectContaining({name: "build-name", title: "Worker"}));
    });

    test("keeps view options out of the transport and destroys both layers", async () => {
        const init = jest.fn(() => ({}));
        const builder = new Builder(
            resolveDefinition({default: {init, render: "Offscreen text", reasons: ["DOM_PARSER"]}}, "worker"),
            VanillaBuilder
        );

        await builder.build();

        expect(init).toHaveBeenCalledWith({name: "worker", reasons: ["DOM_PARSER"]});
        expect(document.body.textContent).toBe("Offscreen text");

        await builder.destroy();

        expect(manager.has("worker")).toBe(false);
        expect(document.body.children).toHaveLength(0);
    });
});
