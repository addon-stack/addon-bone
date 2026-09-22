import {waitFor} from "@testing-library/react";

import sandbox, {Builder, resolveDefinition} from "./index";
import VanillaBuilder from "../view/adapters/vanilla/Builder";
import SandboxManager from "@sandbox/SandboxManager";

import {SandboxGlobalAccess} from "@typing/sandbox";

describe("Sandbox startup", () => {
    const manager = SandboxManager.getInstance();

    afterEach(() => {
        manager.clear();
        document.body.replaceChildren();
        document.title = "";
        delete globalThis[SandboxGlobalAccess];
    });

    test("starts a normalized module with the selected view builder", async () => {
        const instance = {ready: true};
        const init = jest.fn(() => instance);
        const main = jest.fn();

        const definition = resolveDefinition(
            {default: init, name: "source-name", title: "Frame", render: () => "Sandbox text", main},
            "build-name"
        );

        expect(sandbox(definition, VanillaBuilder)).toBeUndefined();

        await waitFor(() => expect(document.body.textContent).toBe("Sandbox text"));

        expect(document.title).toBe("Frame");
        expect(manager.get("build-name")).toBe(instance);
        expect(manager.has("source-name")).toBe(false);
        expect(main).toHaveBeenCalledWith(instance, expect.objectContaining({name: "build-name", title: "Frame"}));
    });

    test("keeps view options out of the transport and destroys both layers", async () => {
        const init = jest.fn(() => ({}));
        const builder = new Builder(
            resolveDefinition({default: {init, render: "Sandbox text", readyTimeout: 500}}, "frame"),
            VanillaBuilder
        );

        await builder.build();

        expect(init).toHaveBeenCalledWith({name: "frame", readyTimeout: 500});
        expect(document.body.textContent).toBe("Sandbox text");

        await builder.destroy();

        expect(manager.has("frame")).toBe(false);
        expect(document.body.children).toHaveLength(0);
    });
});
