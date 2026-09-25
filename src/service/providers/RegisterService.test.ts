import {createManifestFixture, installGlobals, type BrowserContext} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";
import {RegisterService} from "./index";
import {mathService, serviceName, type MathService} from "./tests/fixtures/math-service";

let background: BrowserContext;
let registration: RegisterService<typeof serviceName, MathService>;

beforeEach(() => {
    const session = getBrowserTest();

    background = session.harness.contexts.create({kind: "background"});
    session.harness.runtime.setManifest(
        createManifestFixture({manifest_version: 3, background: {service_worker: "background.js"}})
    );
    session.useContext(background);
    session.addCleanup(installGlobals({window: undefined}));
    registration = new RegisterService(serviceName, () => mathService);
    registration.register();
    session.addCleanup(() => registration.destroy());
});

describe("RegisterService", () => {
    test("rejects direct access outside background", () => {
        const session = getBrowserTest();

        session.useContext(session.context);
        session.addCleanup(installGlobals({window: {}, location: {pathname: "/popup.html"}}));

        expect(() => registration.get()).toThrow(
            `Service "${serviceName}" can be getting only from background context.`
        );
    });

    test("returns the original service in background", () => {
        expect(registration.get()).toBe(mathService);
    });

    test("returns the original service in an MV2 generated background page", () => {
        const session = getBrowserTest();

        session.harness.runtime.setManifest(
            createManifestFixture({manifest_version: 2, background: {scripts: ["background.js"]}})
        );
        session.addCleanup(installGlobals({window: {}, location: {pathname: "/_generated_background_page.html"}}));

        expect(registration.get()).toBe(mathService);
    });

    test("invokes methods directly without runtime messaging", () => {
        expect(registration.get().sum(1, 2)).toBe(3);
        expect(getBrowserTest().harness.messaging.calls).toHaveLength(0);
    });

    test("rejects a duplicate service name", () => {
        const duplicate = new RegisterService(serviceName, () => mathService);

        expect(() => duplicate.register()).toThrow(
            `A instance with name "${serviceName}" already exists. The name must be unique.`
        );
        expect(background.onMessage.listenerCount()).toBe(1);
    });

    test("removes its listener on destroy and allows registration again", () => {
        expect(background.onMessage.listenerCount()).toBe(1);
        expect(getBrowserTest().context.onMessage.listenerCount()).toBe(0);
        registration.destroy();
        expect(background.onMessage.listenerCount()).toBe(0);
        expect(registration.register()).toBe(mathService);
        expect(background.onMessage.listenerCount()).toBe(1);
    });
});
