import {containsPermissions, onPermissionsAdded, onPermissionsRemoved, requestPermissions} from "@adnbn/browser";

import {RelayMethod, RelayOptionsMap} from "@typing/relay";
import {ContentScriptDeclarative} from "@typing/content";

type Permissions = chrome.permissions.Permissions

export interface RelayPermissionValue {
    allow: boolean;
    permissions: Permissions;
}

export default class RelayPermission {
    private static _instance?: RelayPermission;
    private permissions = new Map<string, RelayPermissionValue>();

    public static getInstance(): RelayPermission {
        return this._instance ??= new RelayPermission();
    }

    public static init(relays: RelayOptionsMap) {
        if (this._instance || relays.size === 0) return;

        const instance = RelayPermission.getInstance();

        for (const [name, {declarative, method, matches}] of relays) {
            if (method === RelayMethod.Messaging) continue;

            const allow = declarative === true || declarative === ContentScriptDeclarative.Required;

            const permissions: Permissions = {
                origins: (!declarative || declarative === ContentScriptDeclarative.Optional) ? matches : [],
                permissions: method === RelayMethod.Scripting ? ["scripting"] : []
            };

            instance.set(name, {allow, permissions});
        }

        const checkPermissions = async () => await instance.check();

        onPermissionsAdded(checkPermissions);
        onPermissionsRemoved(checkPermissions);

        checkPermissions().catch((e) => console.error(e));
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
        const relayPermissions = this.get(name);
        return relayPermissions ? relayPermissions.allow : true;
    }

    public async contains(name: string): Promise<boolean> {
        const relayPermissions = this.get(name);

        if (!relayPermissions) {
            throw new Error(`RelayPermission, relay "${name}" not found`);
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
        const allow = await requestPermissions(relayPermissions.permissions);

        this.set(name, {allow});

        return allow;
    }

    private async check() {
        await Promise.allSettled(Object.keys(this.permissions).map(name => this.contains(name)));
    }

}

