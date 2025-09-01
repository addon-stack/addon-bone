import {mergeWebAccessibleResources} from "./utils";

import {
    CoreManifest,
    FirefoxManifest,
    Manifest,
    ManifestAccessibleResource,
    ManifestAccessibleResources,
    ManifestBackground,
    ManifestBuilder,
    ManifestCommands,
    ManifestContentScripts,
    ManifestDependencies,
    ManifestHostPermissions,
    ManifestIcons,
    ManifestIncognito,
    ManifestPermissions,
    ManifestOptionalPermissions,
    ManifestPopup,
    ManifestSidebar,
    ManifestVersion,
} from "@typing/manifest";
import {Browser} from "@typing/browser";
import {Language} from "@typing/locale";
import {CommandExecuteActionName} from "@typing/command";
import {DefaultIconGroupName} from "@typing/icon";
import {SidebarAlternativeBrowsers} from "@typing/sidebar";
import {ContentScriptMatches} from "@typing/content";

type ManifestV3 = chrome.runtime.ManifestV3;
type ManifestPermission = chrome.runtime.ManifestPermissions;
type ManifestOptionalPermission = chrome.runtime.ManifestOptionalPermissions;
type CoreManifestIcons = chrome.runtime.ManifestIcons;

export class ManifestError extends Error {
    public constructor(message: string) {
        super("Manifest: " + message);
    }
}

export default abstract class<T extends CoreManifest> implements ManifestBuilder<T> {
    protected name: string = "__MSG_app_name__";
    protected email?: string;
    protected author?: string;
    protected homepage?: string;
    protected shortName?: string;
    protected description?: string;
    protected minimumVersion?: string;
    protected version: string = "0.0.0";
    protected icon?: string;
    protected incognito?: ManifestIncognito;
    protected locale?: Language;
    protected icons: ManifestIcons = new Map();
    protected background?: ManifestBackground;
    protected popup?: ManifestPopup;
    protected sidebar?: ManifestSidebar;
    protected commands: ManifestCommands = new Set();
    protected contentScripts: ManifestContentScripts = new Set();
    protected dependencies: ManifestDependencies = new Map();
    protected permissions: ManifestPermissions = new Set();
    protected optionalPermissions: ManifestOptionalPermissions = new Set();
    protected hostPermissions: ManifestHostPermissions = new Set();
    protected optionalHostPermissions: ManifestHostPermissions = new Set();
    protected accessibleResources: ManifestAccessibleResources = new Set();

    public abstract getManifestVersion(): ManifestVersion;

    protected abstract buildAction(): Partial<T> | undefined;

    protected abstract buildPermissions(): Partial<T> | undefined;

    protected abstract buildOptionalPermissions(): Partial<T> | undefined;

    protected abstract buildHostPermissions(): Partial<T> | undefined;

    protected abstract buildOptionalHostPermissions(): Partial<T> | undefined;

    protected abstract buildWebAccessibleResources(): Partial<T> | undefined;

    protected constructor(protected readonly browser: Browser = Browser.Chrome) {}

    public setAuthor(author?: string): this {
        this.author = author;

        return this;
    }

    public setHomepage(homepage?: string): this {
        this.homepage = homepage;

        return this;
    }

    public setEmail(email?: string): this {
        this.email = email;

        return this;
    }

    public setName(name: string): this {
        this.name = name;

        return this;
    }

    public setShortName(shortName?: string): this {
        this.shortName = shortName;

        return this;
    }

    public setDescription(description?: string): this {
        this.description = description;

        return this;
    }

    public setVersion(version?: string): this {
        this.version = version || "0.0.0";

        return this;
    }

    public setMinimumVersion(minimumVersion?: string): this {
        this.minimumVersion = minimumVersion;

        return this;
    }

    public setLocale(lang?: Language): this {
        this.locale = lang;

        return this;
    }

    public setIncognito(incognito?: ManifestIncognito): this {
        this.incognito = incognito;

        return this;
    }

    public setIcons(icons?: ManifestIcons): this {
        this.icons = icons || new Map();

        return this;
    }

    public setIcon(icon?: string): this {
        this.icon = icon;

        return this;
    }

    public setBackground(background?: ManifestBackground): this {
        this.background = background;

        return this;
    }

    public setCommands(commands?: ManifestCommands): this {
        this.commands = commands || new Set();

        return this;
    }

    public setContentScripts(contentScripts?: ManifestContentScripts): this {
        this.contentScripts = contentScripts || new Set();

        return this;
    }

    public setPopup(popup?: ManifestPopup): this {
        this.popup = popup;

        return this;
    }

    public setSidebar(sidebar?: ManifestSidebar): this {
        this.sidebar = sidebar;

        return this;
    }

    public setDependencies(dependencies: ManifestDependencies): this {
        this.dependencies = dependencies;

        return this;
    }

    public addPermission(permission: ManifestPermission): this {
        this.permissions.add(permission);

        return this;
    }

    public setPermissions(permissions: ManifestPermissions): this {
        this.permissions = permissions;

        return this;
    }

    public appendPermissions(permissions: ManifestPermissions): this {
        for (const permission of permissions) {
            this.permissions.add(permission);
        }

        return this;
    }

    public addOptionalPermission(permission: ManifestOptionalPermission): this {
        this.optionalPermissions.add(permission);

        return this;
    }

    public setOptionalPermissions(permissions: ManifestOptionalPermissions): this {
        this.optionalPermissions = permissions;

        return this;
    }

    public appendOptionalPermissions(permissions: ManifestOptionalPermissions): this {
        for (const permission of permissions) {
            this.optionalPermissions.add(permission);
        }

        return this;
    }

    public addHostPermission(permission: string): this {
        this.hostPermissions.add(permission);

        return this;
    }

    public setHostPermissions(permissions: ManifestHostPermissions): this {
        this.hostPermissions = permissions;

        return this;
    }

    public appendHostPermissions(permissions: ManifestHostPermissions): this {
        for (const permission of permissions) {
            this.hostPermissions.add(permission);
        }

        return this;
    }

    public addOptionalHostPermission(permission: string): this {
        this.optionalHostPermissions.add(permission);

        return this;
    }

    public setOptionalHostPermissions(permissions: ManifestHostPermissions): this {
        this.optionalHostPermissions = permissions;

        return this;
    }

    public appendOptionalHostPermissions(permissions: ManifestHostPermissions): this {
        for (const permission of permissions) {
            this.optionalHostPermissions.add(permission);
        }

        return this;
    }

    public addAccessibleResource(accessibleResource: ManifestAccessibleResource): this {
        this.accessibleResources.add(accessibleResource);

        return this;
    }

    public appendAccessibleResources(accessibleResources: ManifestAccessibleResources): this {
        for (const accessibleResource of accessibleResources) {
            this.accessibleResources.add(accessibleResource);
        }

        return this;
    }

    public setManifestAccessibleResource(accessibleResources: ManifestAccessibleResources): this {
        this.accessibleResources = accessibleResources;

        return this;
    }

    private marge<T extends CoreManifest>(manifest: T, ...sources: Array<Partial<T> | undefined>): T {
        sources = sources.filter(source => source !== undefined);

        if (sources.length === 0) {
            return manifest;
        }

        const result = {...manifest};

        for (const source of sources) {
            Object.assign(result, source);
        }

        return result;
    }

    public build(): T {
        let manifest: Manifest = {
            name: this.name,
            short_name: this.shortName,
            description: this.description,
            version: this.version,
            manifest_version: this.getManifestVersion(),
            minimum_chrome_version: this.minimumVersion,
            author: this.author,
            homepage_url: this.homepage,
            incognito: this.incognito,
        };

        manifest = this.marge<Manifest>(
            manifest,
            this.buildLocale(),
            this.buildIcons(),
            this.buildBackground(),
            this.buildCommands(),
            this.buildAction(),
            this.buildSidebar(),
            this.buildContentScripts(),
            this.buildPermissions(),
            this.buildOptionalPermissions(),
            this.buildHostPermissions(),
            this.buildOptionalHostPermissions(),
            this.buildWebAccessibleResources(),
            this.buildBrowserSpecificSettings()
        );

        return manifest as T;
    }

    protected buildIcons(): Partial<CoreManifest> | undefined {
        if (this.icon) {
            return {icons: this.getIconsByName(this.icon)};
        }
    }

    protected buildBackground(): Partial<CoreManifest> | undefined {
        if (this.background) {
            const {entry, persistent} = this.background;

            const dependencies = this.dependencies.get(entry);

            if (!dependencies) {
                throw new ManifestError(`Background entry "${entry}" not found in dependencies`);
            }

            if (dependencies.js.size === 0) {
                throw new ManifestError(`Background entry "${entry}" has no dependencies`);
            }

            const scripts = Array.from(dependencies.js);

            return {background: {scripts, persistent: persistent || undefined}};
        }
    }

    protected buildCommands(): Partial<CoreManifest> | undefined {
        if (this.commands.size > 0) {
            const commands = Array.from(this.commands).reduce(
                (commands, command) => {
                    const item = {
                        suggested_key: {
                            default: command?.defaultKey,
                            windows: command?.windowsKey,
                            mac: command?.macKey,
                            chromeos: command?.chromeosKey,
                            linux: command?.linuxKey,
                        },
                        description:
                            command?.description ||
                            (command.name === CommandExecuteActionName ? undefined : command.name),
                        global: command?.global,
                    };

                    return {...commands, [command.name]: item};
                },
                {} as CoreManifest["commands"]
            );

            return {commands};
        }
    }

    protected buildContentScripts(): Partial<CoreManifest> | undefined {
        if (this.contentScripts.size > 0) {
            const contentScripts: ManifestV3["content_scripts"] = [];

            for (const script of this.contentScripts.values()) {
                const {
                    entry,
                    matches,
                    excludeMatches,
                    allFrames,
                    runAt,
                    excludeGlobs,
                    includeGlobs,
                    world,
                    matchAboutBlank,
                    matchOriginAsFallback,
                } = script;

                const dependencies = this.dependencies.get(entry);

                if (!dependencies) {
                    throw new ManifestError(`Content script entry "${entry}" not found in dependencies`);
                }

                const js = Array.from(dependencies.js);
                const css = Array.from(dependencies.css);

                if (js.length === 0 && css.length === 0) {
                    throw new ManifestError(`Content script and style entry "${entry}" not found in dependencies`);
                }

                contentScripts.push({
                    matches,
                    exclude_matches: excludeMatches,
                    js: js.length > 0 ? js : undefined,
                    css: css.length > 0 ? css : undefined,
                    all_frames: allFrames,
                    run_at: runAt,
                    exclude_globs: excludeGlobs,
                    include_globs: includeGlobs,
                    match_about_blank: matchAboutBlank,
                    //@ts-ignore
                    match_origin_as_fallback: matchOriginAsFallback,
                    world,
                });
            }

            return {content_scripts: contentScripts};
        }
    }

    protected buildSidebar(): Partial<CoreManifest> | undefined {
        if (!this.sidebar) {
            return;
        }

        const {path, icon, title} = this.sidebar;

        const commonProps = {
            open_at_install: this.browser === Browser.Firefox ? false : undefined,
            default_title: title || this.name,
            default_icon: this.getIconsByName(icon),
        };

        return SidebarAlternativeBrowsers.has(this.browser)
            ? {sidebar_action: {...commonProps, default_panel: path}}
            : {side_panel: {...commonProps, default_path: path}};
    }

    protected buildLocale(): Partial<CoreManifest> | undefined {
        if (this.locale) {
            return {default_locale: this.locale};
        }
    }

    protected buildBrowserSpecificSettings(): Partial<FirefoxManifest> | undefined {
        if (this.browser === Browser.Firefox && this.email && this.permissions.has("storage")) {
            return {
                browser_specific_settings: {
                    gecko: {
                        id: this.email,
                        // strict_min_version: this.minimumVersion,
                    },
                },
            };
        }
    }

    protected hasExecuteActionCommand(): boolean {
        return this.commands.size > 0 && Array.from(this.commands).some(({name}) => name === CommandExecuteActionName);
    }

    protected getIconsByName(name?: string): CoreManifestIcons | undefined {
        if (this.icons.size === 0) {
            return;
        }

        if (!name) {
            name = DefaultIconGroupName;
        }

        const icons = this.icons.get(name) || this.icons.get(DefaultIconGroupName) || this.icons.values().next().value;

        if (icons) {
            return Object.fromEntries(icons);
        }
    }

    public get(): T {
        return this.build();
    }

    public getWebAccessibleResources(): ManifestAccessibleResource[] {
        const resources: ManifestAccessibleResource[] = [...this.accessibleResources];

        for (const contentScript of this.contentScripts.values()) {
            const assets = this.dependencies.get(contentScript.entry)?.assets;

            if (assets && assets.size > 0) {
                resources.push({
                    resources: Array.from(assets),
                    matches: contentScript.matches || ContentScriptMatches,
                });
            }
        }

        return mergeWebAccessibleResources(resources)
    }
}
