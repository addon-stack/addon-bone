import relay, {resolveDefinition} from "./index";
import VanillaBuilder from "../content/adapters/vanilla/Builder";
import RelayManager from "@relay/RelayManager";
import {RelayMethod} from "@typing/relay";
import type {ContentScriptDefinition} from "@typing/content";

jest.mock("nanoid", () => ({nanoid: jest.fn(() => "mocked-id"), customAlphabet: () => () => "relaymarker"}));

describe("Relay startup", () => {
    let manager: ReturnType<typeof RelayManager.getInstance>;
    let content: VanillaBuilder | undefined;

    class ContentBuilder extends VanillaBuilder {
        constructor(definition: ContentScriptDefinition) {
            super(definition);
            content = this;
        }
    }

    beforeEach(() => {
        manager = RelayManager.getInstance();
        content = undefined;
    });

    afterEach(async () => {
        await content?.destroy();
        manager.clear();
        document.body.replaceChildren();
        jest.restoreAllMocks();
    });

    test("starts a normalized module with the selected content builder", async () => {
        const instance = {ready: true};
        const init = jest.fn(() => instance);
        let started!: () => void;
        const running = new Promise<void>(resolve => {
            started = resolve;
        });
        const main = jest.fn(() => {
            started();
        });
        const definition = resolveDefinition(
            {
                default: init,
                name: "source-name",
                method: RelayMethod.Scripting,
                render: "started",
                watch: () => () => {},
                main,
            },
            "build-name"
        );

        expect(relay(definition, ContentBuilder)).toBeUndefined();
        await running;
        expect(init).toHaveBeenCalledTimes(1);
        expect(manager.get("build-name")).toBe(instance);
        expect(manager.has("source-name")).toBe(false);
        expect(document.body.textContent).toBe("started");
        expect(main).toHaveBeenCalledWith(
            instance,
            content!.getContext(),
            expect.objectContaining({name: "build-name"})
        );
    });

    test.each(["init", "main"])("reports asynchronous build failures from %s", async phase => {
        const error = new Error(`${phase} failed`);
        const reported = new Promise<unknown[]>(resolve => {
            jest.spyOn(console, "error").mockImplementation((...args) => {
                resolve(args);
            });
        });
        const definition = resolveDefinition(
            {
                method: RelayMethod.Scripting,
                init: () => {
                    if (phase === "init") {
                        throw error;
                    }

                    return {ready: true};
                },
                main: async () => {
                    throw error;
                },
            },
            "failed"
        );

        expect(() => relay(definition, ContentBuilder)).not.toThrow();
        expect(await reported).toEqual(["Failed to build relay: ", error]);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    test.each([
        [{name: "missing-init"}, "The transport entrypoint must export a init function"],
        [{name: "", init: () => ({})}, "The transport entrypoint must export a name string"],
    ] as const)("leaves synchronous construction errors to the caller: %s", (definition, message) => {
        const report = jest.spyOn(console, "error").mockImplementation(() => {});

        expect(() => relay(definition, ContentBuilder)).toThrow(message);
        expect(content).toBeUndefined();
        expect(report).not.toHaveBeenCalled();
    });
});
