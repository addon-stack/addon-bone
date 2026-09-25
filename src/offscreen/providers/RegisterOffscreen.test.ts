import {getBrowserTest} from "@tests/browser-harness/session";
import {RegisterOffscreen} from "./index";
import {OffscreenGlobalAccess} from "@typing/offscreen";

const offscreenName = "math";
const mathService = {sum: (a: number, b: number): number => a + b};
type OffscreenType = typeof mathService;

beforeEach(() => {
    const session = getBrowserTest();
    const context = session.harness.contexts.create({kind: "offscreen"});

    session.useContext(context);
    new RegisterOffscreen(offscreenName, () => mathService).register();
});

describe("RegisterOffscreen", () => {
    beforeEach(async () => {
        globalThis[OffscreenGlobalAccess] = true;
    });

    test("throws an error when get() is called outside offscreen context", async () => {
        globalThis[OffscreenGlobalAccess] = false;

        const proxy = new RegisterOffscreen(offscreenName, () => mathService);

        expect(() => proxy.get()).toThrow(
            `Offscreen service "${offscreenName}" can be getting only from offscreen context.`
        );
    });

    test("returns real offscreen service when called in offscreen context", () => {
        const offscreen = new RegisterOffscreen<typeof offscreenName, OffscreenType>(
            offscreenName,
            () => mathService
        ).get();

        expect(offscreen).toBe(mathService);
    });

    test("invokes methods directly without using Message.send in offscreen", async () => {
        const offscreen = new RegisterOffscreen<typeof offscreenName, OffscreenType>(
            offscreenName,
            () => mathService
        ).get();

        expect(offscreen.sum(1, 2)).toBe(3);
        expect(getBrowserTest().harness.messaging.calls).toHaveLength(0);
    });

    test("throws an error when attempting to register the same offscreen service twice", async () => {
        const offscreen = new RegisterOffscreen<typeof offscreenName, OffscreenType>(offscreenName, () => mathService);

        expect(() => offscreen.register()).toThrow(
            `A instance with name "${offscreenName}" already exists. The name must be unique.`
        );
    });
});
