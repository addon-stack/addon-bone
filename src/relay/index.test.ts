import {getBrowserTest} from "@tests/browser-harness/session";
import {RelayGlobalKey, RelayMethod} from "@typing/relay";
import RelayManager from "./RelayManager";
import RegisterRelay from "./providers/RegisterRelay";
import {getRelay} from "./index";

// Runtime registration does not generate a registry; consumer type tests cover the generated names and results.
const name = "parser" as never;

beforeEach(() => {
    // The existing Relay context predicate uses the manager's presence, independently of its registrations.
    RelayManager.getInstance();
});

describe("getRelay", () => {
    test("returns the registered relay", () => {
        const instance = {parse: (text: string) => text.length};
        const registration = new RegisterRelay(name, RelayMethod.Scripting, () => instance);

        registration.register();
        getBrowserTest().addCleanup(() => registration.destroy());

        expect(getRelay(name)).toBe(instance);
    });

    test("throws when the relay is not registered in the Relay context", () => {
        expect(() => getRelay(name)).toThrow('Transport instance "parser" is not registered in the current context.');
    });

    test("reports the context error before a missing registration", () => {
        Reflect.deleteProperty(globalThis, RelayGlobalKey);

        expect(() => getRelay(name)).toThrow('Relay "parser" can be getting only from content script');
    });
});
