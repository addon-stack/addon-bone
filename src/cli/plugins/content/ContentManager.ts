import ContentName from "./ContentName";

import {ContentGroupItems, ContentProvider} from "./types";
import {getContentScriptConfigFromOptions} from "./utils";

import {ReadonlyConfig} from "@typing/config";
import {ContentScriptDeclarative, ContentScriptEntrypointOptions} from "@typing/content";
import {EntrypointEntries, EntrypointFile, EntrypointType} from "@typing/entrypoint";
import {
    ManifestContentScripts,
    ManifestHostPermissions,
    ManifestOptionalPermissions,
    ManifestPermissions,
} from "@typing/manifest";

export default class {
    protected readonly providers = new Set<ContentProvider<ContentScriptEntrypointOptions>>();

    protected readonly names: ContentName;

    protected _group?: ContentGroupItems<ContentScriptEntrypointOptions>;

    protected _hostPermissions?: [ManifestHostPermissions, ManifestHostPermissions];

    protected _permissions?: Promise<[ManifestPermissions, ManifestOptionalPermissions]>;

    constructor(config: ReadonlyConfig) {
        this.names = new ContentName(config);
    }

    public provider(provider: ContentProvider<ContentScriptEntrypointOptions>): this {
        this.providers.add(provider);

        return this;
    }

    protected async getGroup(): Promise<ContentGroupItems<ContentScriptEntrypointOptions>> {
        const content = await Promise.all(Array.from(this.providers, provider => provider.driver().items()));

        const group: ContentGroupItems<ContentScriptEntrypointOptions> = new Map();

        for (const items of content) {
            for (const [name, item] of items) {
                const entry = this.names.create(name, item.options);

                group.set(entry, new Set([...(group.get(entry) || []), item]));
            }
        }

        return group;
    }

    public async group(): Promise<ContentGroupItems<ContentScriptEntrypointOptions>> {
        return (this._group ??= await this.getGroup());
    }

    public async entries(): Promise<EntrypointEntries> {
        const entries: EntrypointEntries = new Map();

        for (const [entry, items] of await this.group()) {
            entries.set(entry, new Set(Array.from(items, ({file}) => file)));
        }

        return entries;
    }

    public async manifest(): Promise<ManifestContentScripts> {
        const manifest: ManifestContentScripts = new Set();

        for (const [entry, items] of await this.group()) {
            const options = Array.from(items, ({options}) => options).reduce((acc, opt) => {
                return {...acc, ...opt};
            }, {} as ContentScriptEntrypointOptions);

            manifest.add({entry, ...getContentScriptConfigFromOptions(options)});
        }

        return manifest;
    }

    public async hostPermissions(): Promise<ManifestHostPermissions> {
        return (await this.calculateHostPermissions())[0];
    }

    public async optionalHostPermissions(): Promise<ManifestHostPermissions> {
        return (await this.calculateHostPermissions())[1];
    }

    protected async calculateHostPermissions(): Promise<[ManifestHostPermissions, ManifestHostPermissions]> {
        if (this._hostPermissions) {
            return this._hostPermissions;
        }

        const hostPermissions = new Set<string>();
        const optionalHostPermissions = new Set<string>();

        const group = await this.group();

        for (const items of group.values()) {
            for (const {options} of items) {
                const {matches, declarative} = options;

                if (!declarative || !matches) {
                    continue;
                }

                for (const match of matches) {
                    switch (declarative) {
                        case ContentScriptDeclarative.Optional:
                            optionalHostPermissions.add(match);

                            break;
                        case ContentScriptDeclarative.Required:
                        case true:
                            hostPermissions.add(match);

                            break;
                    }
                }
            }
        }

        return (this._hostPermissions = [hostPermissions, optionalHostPermissions]);
    }

    public async permissions(): Promise<ManifestPermissions> {
        return (await this.getPermissions())[0];
    }

    public async optionalPermissions(): Promise<ManifestOptionalPermissions> {
        return (await this.getPermissions())[1];
    }

    protected getPermissions(): Promise<[ManifestPermissions, ManifestOptionalPermissions]> {
        return (this._permissions ??= this.calculatePermissions());
    }

    protected async calculatePermissions(): Promise<[ManifestPermissions, ManifestOptionalPermissions]> {
        const permissions: ManifestPermissions = new Set();
        const optionalPermissions: ManifestOptionalPermissions = new Set();

        const contributions = await Promise.all(
            Array.from(this.providers, async provider => {
                const driver = provider.driver();

                return Promise.all([driver.permissions(), driver.optionalPermissions()]);
            })
        );

        for (const [required, optional] of contributions) {
            for (const permission of required) {
                permissions.add(permission);
            }

            for (const permission of optional) {
                optionalPermissions.add(permission);
            }
        }

        for (const permission of optionalPermissions) {
            if (permissions.has(permission)) {
                optionalPermissions.delete(permission);
            }
        }

        return [permissions, optionalPermissions];
    }

    public virtual(file: EntrypointFile): string {
        for (const provider of this.providers) {
            try {
                return provider.virtual(file);
            } catch {}
        }

        throw new Error(`Virtual file "${file.file}" not found.`);
    }

    public async empty(): Promise<boolean> {
        return (await this.group()).size === 0;
    }

    public chunkName(): string {
        return this.names.getChunkName();
    }

    public likely(name?: string): boolean {
        if (!name) {
            return false;
        }

        return [EntrypointType.Relay, EntrypointType.ContentScript].some(
            type => name === type || name.endsWith(`.${type}`)
        );
    }

    public clear(): this {
        for (const provider of this.providers) {
            provider.clear();
        }

        this.names.reset();

        this._group = undefined;
        this._hostPermissions = undefined;
        this._permissions = undefined;

        return this;
    }
}
