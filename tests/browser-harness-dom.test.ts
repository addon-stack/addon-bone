import {getManifest} from "@addon-core/browser";

import {getBrowserTest} from "./browser-harness/session";

const originalWindow = window;
const originalDocument = document;
const originalLocation = location;
const originalNavigator = navigator;

test("preserves jsdom identities through context changes and teardown", async () => {
    const session = getBrowserTest();
    const assertDom = () => {
        expect(window).toBe(originalWindow);
        expect(document).toBe(originalDocument);
        expect(location).toBe(originalLocation);
        expect(navigator).toBe(originalNavigator);
    };

    assertDom();
    expect(jest.isMockFunction(getManifest)).toBe(false);
    expect(getManifest()).toEqual(session.harness.runtime.manifest);
    session.useContext(session.harness.contexts.create({kind: "background"}));
    assertDom();
    await session.dispose();
    assertDom();
});
