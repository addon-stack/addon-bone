import {containsPermissions, onPermissionsAdded, onPermissionsRemoved, requestPermissions} from "@addon-core/browser";

import {RelayMethod, RelayOptionsMap} from "@typing/relay";
import {ContentScriptDeclarative} from "@typing/content";

type Permissions = chrome.permissions.Permissions;

export interface RelayPermissionValue {
    allow: boolean;
    permissions?: Permissions;
}

export const RelayPermissionGlobalKey = "adnbnRelayPermission";

export default class RelayPermission {
    private permissions = new Map<string, RelayPermissionValue>();
    private started = false;

    private constructor(relays: RelayOptionsMap) {
        this.configure(relays);
    }

    private configure(relays: RelayOptionsMap): void {
        for (const [name, {declarative, method, matches}] of relays) {
            if (declarative === false && method === RelayMethod.Scripting) {
                console.warn(
                    `Relay "${name}" has invalid configuration: "scripting" method cannot work with declarative = false.`
                );
            }

            const allow: boolean =
                declarative === true ||
                declarative === ContentScriptDeclarative.Required ||
                method === RelayMethod.Messaging;

            const permissions: Permissions | undefined =
                method === RelayMethod.Messaging
                    ? undefined
                    : {
                          origins: !declarative || declarative === ContentScriptDeclarative.Optional ? matches : [],
                          permissions: ["scripting"],
                      };

            this.set(name, {allow, permissions});
        }
    }

    public static getInstance(relays: RelayOptionsMap): RelayPermission {
        const current = globalThis[RelayPermissionGlobalKey] as RelayPermission | undefined;

        if (current) {
            return current;
        }

        const instance = new RelayPermission(relays);

        globalThis[RelayPermissionGlobalKey] = instance;

        return instance.start();
    }

    public start(): this {
        if (this.started) {
            return this;
        }

        this.started = true;

        const checkPermissions = (): void => {
            void this.check().catch(error => console.error(error));
        };

        onPermissionsAdded(checkPermissions);
        onPermissionsRemoved(checkPermissions);
        checkPermissions();

        return this;
    }

    public set(name: string, value: Partial<RelayPermissionValue>): this {
        const relayPermissions = this.get(name) || {allow: false, permissions: {}};

        this.permissions.set(name, {...relayPermissions, ...value});

        return this;
    }

    public get(name: string): RelayPermissionValue | undefined {
        return this.permissions.get(name);
    }

    public has(name: string): boolean {
        return this.permissions.has(name);
    }

    public allow(name: string): boolean {
        return this.get(name)?.allow ?? false;
    }

    public async contains(name: string): Promise<boolean> {
        const relayPermissions = this.get(name);

        if (!relayPermissions) {
            throw new Error(`RelayPermission, relay "${name}" not found`);
        }

        if (!relayPermissions.permissions) {
            return true;
        }

        const allow = await containsPermissions(relayPermissions.permissions);

        this.set(name, {allow});

        return allow;
    }

    public async request(name: string): Promise<boolean> {
        const relayPermissions = this.get(name);

        if (!relayPermissions) {
            throw new Error(`RelayPermission, relay "${name}" not found`);
        }

        if (!relayPermissions.permissions) {
            return true;
        }

        const allow = await requestPermissions(relayPermissions.permissions);

        this.set(name, {allow});

        return allow;
    }

    private async check(): Promise<void> {
        await Promise.allSettled([...this.permissions.keys()].map(name => this.contains(name)));
    }
}
