import {containsPermissions, onPermissionsAdded, onPermissionsRemoved} from "@adnbn/browser";

import {RelayMethod, RelayOptionsMap} from "@typing/relay";
import {ContentScriptDeclarative} from "@typing/content";

export default class RelayPermission {
    private static _instance?: RelayPermission;
    private static permissions = new Map<string, boolean>();

    public static getInstance(): RelayPermission {
        return this._instance ??= new RelayPermission();
    }

    public static async init(optionsMap: RelayOptionsMap) {
        for (const [name, {declarative}] of optionsMap) {
            RelayPermission.permissions.set(name, declarative === true || declarative === ContentScriptDeclarative.Required);
        }

        const checkPermissions = async () => {
            for await (const [name, {matches, method}] of optionsMap) {
                RelayPermission.permissions.set(name, await containsPermissions({
                    origins: matches,
                    permissions: method === RelayMethod.Scripting ? ["scripting"] : []
                }));
            }
        };

        onPermissionsAdded(async () => await checkPermissions());
        onPermissionsRemoved(async () => await checkPermissions());

        await checkPermissions();
    }

    public set(name: string, value: boolean): void {
        RelayPermission.permissions.set(name, value);
    }

    public get(name: string): boolean | undefined {
        return RelayPermission.permissions.get(name);
    }

    public has(name: string): boolean {
        return RelayPermission.permissions.has(name);
    }
}

