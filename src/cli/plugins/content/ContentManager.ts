import ContentName from "./ContentName";

import {ContentGroupItems, ContentProvider} from "./types";
import {getContentScriptConfigFromOptions, hasIsolatedTarget} from "./utils";
import {getContentChunkName} from "./bundler";

import {ReadonlyConfig} from "@typing/config";
import {
    ContentScriptDeclarative,
    ContentScriptIsolation,
    ContentScriptEntrypointOptions,
    ContentScriptWorld,
    type ContentScriptWorldValue,
} from "@typing/content";
import {EntrypointEntries, EntrypointFile} from "@typing/entrypoint";
import {
    ManifestContentScripts,
    ManifestHostPermissions,
    ManifestOptionalPermissions,
    ManifestPermissions,
} from "@typing/manifest";

export default class ContentManager {
    protected readonly providers = new Set<ContentProvider<ContentScriptEntrypointOptions>>();

    protected readonly names: ContentName;

    protected _group?: ContentGroupItems<ContentScriptEntrypointOptions>;

    protected _hostPermissions?: [ManifestHostPermissions, ManifestHostPermissions];

    protected _permissions?: Promise<[ManifestPermissions, ManifestOptionalPermissions]>;

    constructor(protected readonly config: ReadonlyConfig) {
        this.names = new ContentName(config);

        Object.values(ContentScriptWorld).forEach(world => this.names.reserve(getContentChunkName(world)));
    }

    public provider(provider: ContentProvider<ContentScriptEntrypointOptions>): this {
        this.providers.add(provider);

        return this;
    }

    protected async getGroup(): Promise<ContentGroupItems<ContentScriptEntrypointOptions>> {
        // prettier-ignore
        const content = await Promise.all(
            Array.from(this.providers, provider => provider.driver().items())
        );

        const group: ContentGroupItems<ContentScriptEntrypointOptions> = new Map();

        for (const items of content) {
            for (const [name, item] of items) {
                const options = this.normalizeOptions(item.file, item.options);
                const entry = this.names.create(name, options);

                group.set(entry, new Set([...(group.get(entry) || []), {...item, options}]));
            }
        }

        return group;
    }

    protected normalizeOptions(
        file: EntrypointFile,
        options: ContentScriptEntrypointOptions
    ): ContentScriptEntrypointOptions {
        const world = this.resolveWorld(options.world);

        if (this.config.manifestVersion !== 2) {
            if (
                world === ContentScriptWorld.Main &&
                (options.isolation?.type === ContentScriptIsolation.Shadow ||
                    (options.isolation?.type === ContentScriptIsolation.Iframe &&
                        !(options.isolation?.src && /^https?:\/\//.test(options.isolation.src))))
            ) {
                throw new Error(
                    `Content script "${file.file}" cannot use this isolation in the MAIN execution world; only external HTTP(S) isolation.src is supported`
                );
            }

            return options;
        }

        if (world === ContentScriptWorld.Main) {
            console.warn(
                `Content script "${file.file}" requests world "MAIN", but Addon Bone does not support MAIN content scripts in Manifest V2. It will be built and run in ISOLATED.`
            );
        }

        return {...options, world: ContentScriptWorld.Isolated};
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

    /** Settings are keyed by the final grouped entrypoint name, not the original source files. */
    public async entryOptions(): Promise<ReadonlyMap<string, ContentScriptEntrypointOptions>> {
        const entries = new Map<string, ContentScriptEntrypointOptions>();

        for (const [entry, items] of await this.group()) {
            const options = Array.from(items, item => item.options);
            const worlds = new Set(options.map(option => this.resolveWorld(option.world)));
            if (worlds.size !== 1) {
                throw new Error(`Content entrypoint "${entry}" cannot mix execution worlds`);
            }

            if (new Set(options.map(hasIsolatedTarget)).size !== 1) {
                throw new Error(`Content entrypoint "${entry}" cannot mix isolation style delivery modes`);
            }

            entries.set(entry, Object.assign({}, ...options));
        }

        return entries;
    }

    public async manifest(): Promise<ManifestContentScripts> {
        return new Set(
            Array.from(await this.entryOptions(), ([entry, options]) => ({
                entry,
                ...getContentScriptConfigFromOptions(options),
            }))
        );
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
        if (!this._group) {
            throw new Error(
                `Cannot create virtual file "${file.file}": content group is not prepared. Await entries() or entryOptions() before virtual().`
            );
        }

        const item = Array.from(this._group.values())
            .flatMap(items => Array.from(items))
            .find(item => item.file.file === file.file);

        if (!item) {
            throw new Error(`Virtual file "${file.file}" is not in the prepared content group.`);
        }

        for (const provider of this.providers) {
            try {
                return provider.virtual(file, item.options);
            } catch {}
        }

        throw new Error(`Virtual file "${file.file}" not found.`);
    }

    public async empty(): Promise<boolean> {
        return (await this.group()).size === 0;
    }

    protected resolveWorld(world?: ContentScriptWorldValue): ContentScriptWorld {
        switch (world) {
            case undefined:
            case ContentScriptWorld.Isolated:
                return ContentScriptWorld.Isolated;
            case ContentScriptWorld.Main:
                return ContentScriptWorld.Main;
            default:
                throw new Error(`Unsupported content script execution world "${String(world)}"`);
        }
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
