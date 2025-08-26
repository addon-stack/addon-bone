import BackgroundEntry from "./BackgroundEntry";

import {BackgroundEntrypointOptions} from "@typing/background";
import {ManifestHostPermissions, ManifestOptionalPermissions, ManifestPermissions} from "@typing/manifest";

export default class {
    protected entries = new Set<BackgroundEntry<BackgroundEntrypointOptions>>();

    public add(entry: BackgroundEntry<BackgroundEntrypointOptions>): this {
        this.entries.add(entry);

        return this;
    }

    public async hasBackground(): Promise<boolean> {
        for await (const entry of this.entries) {
            if (await entry.finder.exists()) {
                return true;
            }
        }

        return false;
    }

    public async isPersistent(): Promise<boolean> {
        for await (const entry of this.entries) {
            if (await entry.isPersistent()) {
                return true;
            }
        }

        return false;
    }

    public async getPermissions(): Promise<ManifestPermissions> {
        const permissions: ManifestPermissions = new Set();

        for await (const entry of this.entries) {
            (await entry.getPermissions())
                .forEach(permission => permissions.add(permission));
        }

        return permissions;
    }

    public async getOptionalPermissions(): Promise<ManifestOptionalPermissions> {
        const optionalPermissions: ManifestOptionalPermissions = new Set();

        for await (const entry of this.entries) {
            (await entry.getOptionalPermissions())
                .forEach(permission => optionalPermissions.add(permission));
        }

        return optionalPermissions;
    }

    public async getHostPermissions(): Promise<ManifestHostPermissions> {
        const hostPermissions: ManifestHostPermissions = new Set();

        for await (const entry of this.entries) {
            (await entry.getHostPermissions())
                .forEach(permission => hostPermissions.add(permission));
        }

        return hostPermissions;
    }

    public async getOptionalHostPermissions(): Promise<ManifestHostPermissions> {
        const optionalHostPermissions: ManifestHostPermissions = new Set();

        for await (const entry of this.entries) {
            (await entry.getOptionalHostPermissions())
                .forEach(permission => optionalHostPermissions.add(permission));
        }

        return optionalHostPermissions;
    }
}
