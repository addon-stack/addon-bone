import RegisterTransport from "./RegisterTransport";
import TransportManager from "./TransportManager";

import {MessageSenderProperty, type MessageSender, type MessageSenderAware} from "@typing/message";
import type {TransportMessage, TransportMessageData} from "@typing/transport";

class TestManager extends TransportManager {}

class TestMessage implements TransportMessage {
    private handler?: (data: TransportMessageData, sender: MessageSender) => any;

    public send(): void {}

    public watch(handler: (data: TransportMessageData, sender: MessageSender) => any): void {
        this.handler = handler;
    }

    public dispatch(data: TransportMessageData, sender: MessageSender): Promise<any> {
        if (!this.handler) {
            throw new Error("Handler is not registered");
        }

        return Promise.resolve(this.handler(data, sender));
    }
}

class TestRegister<T extends object> extends RegisterTransport<"test", T> {
    constructor(
        init: () => T,
        private readonly transportMessage: TestMessage,
        private readonly transportManager: TestManager
    ) {
        super("test", init);
    }

    protected message(): TransportMessage {
        return this.transportMessage;
    }

    protected manager(): TestManager {
        return this.transportManager;
    }
}

const createSender = (url: string, tabId = 1): MessageSender => ({
    url,
    tab: {id: tabId} as chrome.tabs.Tab,
});

const wait = () => new Promise(resolve => setTimeout(resolve));

describe("RegisterTransport", () => {
    let manager: TestManager;
    let message: TestMessage;

    beforeEach(() => {
        manager = new TestManager();
        message = new TestMessage();
    });

    test("exposes sender on the call-scoped execution context", async () => {
        const instance = new TestRegister(
            () => ({
                getSenderTabId(this: MessageSenderAware): number | undefined {
                    return this.$sender?.tab?.id;
                },
            }),
            message,
            manager
        ).register();

        await expect(
            message.dispatch({path: "getSenderTabId", args: []}, createSender("https://example.com", 42))
        ).resolves.toBe(42);

        expect(Object.hasOwn(instance, MessageSenderProperty)).toBe(false);
    });

    test("exposes sender to nested transport methods", async () => {
        new TestRegister(
            () => ({
                nested: {
                    getSenderUrl(this: MessageSenderAware): string | undefined {
                        return this.$sender?.url;
                    },
                },
            }),
            message,
            manager
        ).register();

        await expect(
            message.dispatch({path: "nested.getSenderUrl", args: []}, createSender("https://nested.test"))
        ).resolves.toBe("https://nested.test");
    });

    test("keeps sender isolated between parallel calls", async () => {
        const releases: Array<() => void> = [];

        const instance = new TestRegister(
            () => ({
                async getSenderAfterWait(this: MessageSenderAware): Promise<string | undefined> {
                    await new Promise<void>(resolve => {
                        releases.push(resolve);
                    });

                    return this.$sender?.url;
                },
            }),
            message,
            manager
        ).register();

        const first = message.dispatch({path: "getSenderAfterWait", args: []}, createSender("https://first.test"));
        const second = message.dispatch({path: "getSenderAfterWait", args: []}, createSender("https://second.test"));

        await wait();

        expect(releases).toHaveLength(2);

        releases.forEach(resolve => resolve());

        await expect(Promise.all([first, second])).resolves.toEqual(["https://first.test", "https://second.test"]);
        expect(Object.hasOwn(instance, MessageSenderProperty)).toBe(false);
    });
});
