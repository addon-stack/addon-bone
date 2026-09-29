import {createTabFixture} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";
import {MessageResultEnvelopeProperty, type MessageSendOptions} from "@typing/message";
import {isRemoteMessageError} from "./error";
import {Message} from "./providers";

type ResponseHandler = () => unknown;
type ResponseMessages = {probe: ResponseHandler};

describe.each(["runtime", "tab"] as const)("Message response over %s messaging", target => {
    let message: Message<ResponseMessages>;
    let options: MessageSendOptions | undefined;
    let restoreContext: () => void;

    beforeEach(() => {
        const session = getBrowserTest();

        session.harness.tabs.set([createTabFixture({id: 7})]);

        const receiver = session.harness.contexts.create(
            target === "runtime"
                ? {kind: "background"}
                : {kind: "contentScript", tabId: 7, frameId: 0, url: "https://example.test/"}
        );

        restoreContext = session.useContext(receiver);
        message = new Message<ResponseMessages>();
        options = target === "runtime" ? undefined : {tabId: 7, frameId: 0};
    });

    test("preserves the channel error when a general handler sends no response", async () => {
        message.watch(() => {});
        restoreContext();

        const result = message.send("probe", undefined, options);

        await expect(result).rejects.toThrow("The message port closed before a response was received.");
        expect(isRemoteMessageError(await result.catch(error => error))).toBe(false);
    });

    describe.each(["single", "map"] as const)("with %s registration", registration => {
        const send = (handler: ResponseHandler): Promise<unknown> => {
            if (registration === "single") {
                message.watch("probe", handler);
            } else {
                message.watch({probe: handler});
            }

            restoreContext();

            return message.send("probe", undefined, options);
        };

        test("returns undefined when an async handler has no return value", async () => {
            await expect(send(async () => {})).resolves.toBeUndefined();
        });

        test("preserves the null response of a sync handler with no return value", async () => {
            await expect(send(() => {})).resolves.toBeNull();
        });

        test.each([null, false, 0, ""])("preserves the sync result %p", async value => {
            await expect(send(() => value)).resolves.toBe(value);
        });

        test.each([null, false, 0, ""])("preserves the async result %p", async value => {
            await expect(send(async () => value)).resolves.toBe(value);
        });

        test("unwraps only the outer envelope when the payload resembles a response", async () => {
            const payload = {[MessageResultEnvelopeProperty]: true, ok: true};

            await expect(send(async () => payload)).resolves.toEqual(payload);
        });

        test.each([false, true])("preserves remote errors from an async=%s handler", async asynchronous => {
            const fail = () => {
                throw new TypeError("Response failed");
            };
            const result = send(asynchronous ? async () => fail() : fail);

            await expect(result).rejects.toBeInstanceOf(TypeError);
            await expect(result).rejects.toThrow("Response failed");
            expect(isRemoteMessageError(await result.catch(error => error))).toBe(true);
        });
    });
});
