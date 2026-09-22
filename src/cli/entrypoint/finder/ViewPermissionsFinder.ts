import ViewCspFinder, {type CspEntrypointOptions} from "./ViewCspFinder";

import type {CspConfig} from "@typing/csp";
import type {ManifestHostPermissions, ManifestOptionalPermissions, ManifestPermissions} from "@typing/manifest";
import type {EntrypointPermissions, PermissionsOptions} from "@typing/permissions";

type PermissionsEntrypointOptions = CspEntrypointOptions & PermissionsOptions;

/**
 * Views that opt into the permissions contract.
 *
 * Only views that reach the build contribute: every built view when several are allowed,
 * because any of them can be switched to at runtime, and the single winner otherwise.
 */
export default abstract class ViewPermissionsFinder<
    O extends PermissionsEntrypointOptions,
    Csp = CspConfig,
> extends ViewCspFinder<O, Csp> {
    protected _permissions?: Promise<EntrypointPermissions>;

    public async permissions(): Promise<ManifestPermissions> {
        return (await this.getPermissions()).permissions;
    }

    public async optionalPermissions(): Promise<ManifestOptionalPermissions> {
        return (await this.getPermissions()).optionalPermissions;
    }

    public async hostPermissions(): Promise<ManifestHostPermissions> {
        return (await this.getPermissions()).hostPermissions;
    }

    public async optionalHostPermissions(): Promise<ManifestHostPermissions> {
        return (await this.getPermissions()).optionalHostPermissions;
    }

    protected getPermissions(): Promise<EntrypointPermissions> {
        return (this._permissions ??= this.collectPermissions());
    }

    protected async collectPermissions(): Promise<EntrypointPermissions> {
        const collected: EntrypointPermissions = {
            permissions: new Set(),
            optionalPermissions: new Set(),
            hostPermissions: new Set(),
            optionalHostPermissions: new Set(),
        };

        for (const options of await this.selectedOptions()) {
            options.permissions?.forEach(permission => collected.permissions.add(permission));
            options.optionalPermissions?.forEach(permission => collected.optionalPermissions.add(permission));
            options.hostPermissions?.forEach(permission => collected.hostPermissions.add(permission));
            options.optionalHostPermissions?.forEach(permission => collected.optionalHostPermissions.add(permission));
        }

        return collected;
    }

    public clear(): this {
        this._permissions = undefined;

        return super.clear();
    }
}
