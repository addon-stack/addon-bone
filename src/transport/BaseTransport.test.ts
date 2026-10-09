import BaseTransport from "./BaseTransport";
import TransportManager from "./TransportManager";

class TestManager extends TransportManager {}

class TestTransport<T extends object> extends BaseTransport<"parser", T> {
    constructor(private readonly transportManager: TestManager) {
        super("parser");
    }

    protected manager(): TestManager {
        return this.transportManager;
    }
}

describe("BaseTransport", () => {
    let manager: TestManager;

    beforeEach(() => {
        manager = new TestManager();
    });

    test.each([
        ["an object with methods", {parse: (text: string) => text.length}],
        ["an empty object", {}],
    ])("returns %s without copying it", (_description, instance) => {
        manager.add("parser", instance);

        expect(new TestTransport(manager).get()).toBe(instance);
    });

    test("throws synchronously with the requested name when the instance is missing", () => {
        const transport = new TestTransport(manager);

        expect(() => transport.get()).toThrow('Transport instance "parser" is not registered in the current context.');
    });

    test("throws after destroy removes the instance", () => {
        manager.add("parser", {});

        const transport = new TestTransport(manager);

        transport.destroy();

        expect(() => transport.get()).toThrow('Transport instance "parser" is not registered in the current context.');
    });

    test("preserves optional lookup through the manager", () => {
        expect(manager.get("parser")).toBeUndefined();
    });
});
