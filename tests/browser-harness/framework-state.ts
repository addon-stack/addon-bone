import {MessageGlobalKey} from "@typing/message";
import {OffscreenGlobalAccess, OffscreenGlobalKey} from "@typing/offscreen";
import {RelayGlobalKey} from "@typing/relay";
import {SandboxGlobalAccess, SandboxGlobalKey} from "@typing/sandbox";
import {ServiceGlobalKey} from "@typing/service";
import {RelayPermissionGlobalKey} from "@relay/RelayPermission";

interface TestManager {
    clear(): unknown;
}

function clearManager(key: string): void {
    try {
        (globalThis[key] as TestManager | undefined)?.clear();
    } finally {
        Reflect.deleteProperty(globalThis, key);
    }
}

// Explicit owners are audited by test:inventory. Resolve modules after each test's
// virtual-module fixtures, never while the shared setup is loading.
export const frameworkStateResetters = {
    MessageManager: () => clearManager(MessageGlobalKey),
    RelayManager: () => clearManager(RelayGlobalKey),
    OffscreenManager: () => clearManager(OffscreenGlobalKey),
    ServiceManager: () => clearManager(ServiceGlobalKey),
    SandboxManager: () => clearManager(SandboxGlobalKey),
    RelayPermission: () => {
        // Browser event subscriptions are removed by harness.reset().
        Reflect.deleteProperty(globalThis, RelayPermissionGlobalKey);
    },
    NativeLocale: () => {
        const {default: NativeLocale} = jest.requireActual<typeof import("@locale/providers/NativeLocale")>(
            "@locale/providers/NativeLocale"
        );

        Reflect.deleteProperty(NativeLocale, "instance");
    },
    Message: () => {
        const {default: Message} =
            jest.requireActual<typeof import("@message/providers/Message")>("@message/providers/Message");

        Reflect.deleteProperty(Message, "instance");
    },
    ObservableLocale: () => {
        const {default: ObservableLocale} = jest.requireActual<typeof import("@locale/providers/ObservableLocale")>(
            "@locale/providers/ObservableLocale"
        );

        Reflect.deleteProperty(ObservableLocale, "defaultInstance");
        Reflect.deleteProperty(ObservableLocale, "memoryInstance");
        Reflect.set(ObservableLocale, "drivers", new WeakMap());
    },
    OffscreenBridge: () => {
        const {default: OffscreenBridge} =
            jest.requireActual<typeof import("@offscreen/OffscreenBridge")>("@offscreen/OffscreenBridge");

        Reflect.deleteProperty(OffscreenBridge, "instance");
    },
    SandboxMessage: () => {
        const {default: SandboxMessage} =
            jest.requireActual<typeof import("@sandbox/SandboxMessage")>("@sandbox/SandboxMessage");
        const hosts = Reflect.get(SandboxMessage, "hosts") as Map<string, InstanceType<typeof SandboxMessage>>;
        const errors: unknown[] = [];

        for (const host of hosts.values()) {
            try {
                host.dispose();
            } catch (error) {
                errors.push(error);
            }
        }

        hosts.clear();

        if (errors.length) {
            throw new AggregateError(errors, "Sandbox host cleanup failed.");
        }
    },
};

export function resetFrameworkState(): void {
    const errors: unknown[] = [];

    for (const reset of Object.values(frameworkStateResetters)) {
        try {
            reset();
        } catch (error) {
            errors.push(error);
        }
    }

    Reflect.deleteProperty(globalThis, OffscreenGlobalAccess);
    Reflect.deleteProperty(globalThis, SandboxGlobalAccess);

    const remaining = Object.getOwnPropertyNames(globalThis).filter(key => key.startsWith("adnbn"));

    if (remaining.length) {
        errors.push(new Error(`Unregistered framework globals after teardown: ${remaining.join(", ")}`));
    }

    if (errors.length) {
        throw new AggregateError(errors, "Framework state cleanup failed.");
    }
}
