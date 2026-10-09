import {createManifestFixture, installGlobals} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";
import {getService, RegisterService} from "./index";

// Runtime registration does not generate a registry; consumer type tests cover the generated names and results.
const name = "parser" as never;

beforeEach(() => {
    const session = getBrowserTest();

    session.harness.runtime.setManifest(
        createManifestFixture({manifest_version: 3, background: {service_worker: "background.js"}})
    );
    session.useContext(session.harness.contexts.create({kind: "background"}));
    session.addCleanup(installGlobals({window: undefined}));
});

describe("getService", () => {
    test("returns the registered service", () => {
        const instance = {parse: (text: string) => text.length};
        const registration = new RegisterService(name, () => instance);

        registration.register();
        getBrowserTest().addCleanup(() => registration.destroy());

        expect(getService(name)).toBe(instance);
    });

    test("throws when the service is not registered in background", () => {
        expect(() => getService(name)).toThrow('Transport instance "parser" is not registered in the current context.');
    });

    test("reports the context error before a missing registration", () => {
        const session = getBrowserTest();

        session.useContext(session.context);
        session.addCleanup(installGlobals({window: {}, location: {pathname: "/popup.html"}}));

        expect(() => getService(name)).toThrow('Service "parser" can be getting only from background context.');
    });
});
