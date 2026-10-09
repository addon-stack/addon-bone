import {getBrowserTest} from "@tests/browser-harness/session";
import {OffscreenGlobalAccess} from "@typing/offscreen";
import {getOffscreen, RegisterOffscreen} from "./index";

// Runtime registration does not generate a registry; consumer type tests cover the generated names and results.
const name = "parser" as never;

beforeEach(() => {
    const session = getBrowserTest();

    session.useContext(session.harness.contexts.create({kind: "offscreen"}));
    globalThis[OffscreenGlobalAccess] = true;
});

describe("getOffscreen", () => {
    test("returns the registered offscreen instance", () => {
        const instance = {parse: (text: string) => text.length};
        const registration = new RegisterOffscreen(name, () => instance);

        registration.register();
        getBrowserTest().addCleanup(() => registration.destroy());

        expect(getOffscreen(name)).toBe(instance);
    });

    test("throws when the instance is not registered in offscreen", () => {
        expect(() => getOffscreen(name)).toThrow(
            'Transport instance "parser" is not registered in the current context.'
        );
    });

    test("reports the context error before a missing registration", () => {
        globalThis[OffscreenGlobalAccess] = false;

        expect(() => getOffscreen(name)).toThrow(
            'Offscreen service "parser" can be getting only from offscreen context.'
        );
    });
});
