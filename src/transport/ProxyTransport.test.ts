import ProxyTransport from "./ProxyTransport";
import TransportManager from "./TransportManager";

class TestManager extends TransportManager {}

class TestProxy extends ProxyTransport<"parser"> {
    constructor(private readonly transportManager: TestManager) {
        super("parser");
    }

    protected manager(): TestManager {
        return this.transportManager;
    }

    protected apply(): void {}
}

test("creates a proxy without a locally registered instance", () => {
    const manager = new TestManager();
    const proxy = new TestProxy(manager).get();

    expect(manager.has("parser")).toBe(false);
    expect(Reflect.get(proxy, "__proxy")).toBe(true);
});
