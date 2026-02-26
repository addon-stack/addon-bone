import _ from "lodash";

import {mergeWebAccessibleResources, normalizeDataCollectionPermissions} from "./utils";

import {
    CoreManifest,
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
    ManifestOptionalPermissions,
    ManifestPermissions,
    ManifestPopup,
    ManifestSidebar,
    ManifestVersion,
    OptionalManifest,
} from "@typing/manifest";
import {Browser, BrowserSpecific} from "@typing/browser";
import {Language} from "@typing/locale";
import {CommandExecuteActionName} from "@typing/command";
import {DefaultIconGroupName} from "@typing/icon";
import {SidebarAlternativeBrowsers} from "@typing/sidebar";
import {ContentScriptMatches} from "@typing/content";

type ManifestV3 = chrome.runtime.ManifestV3;
type ManifestPermission = chrome.runtime.ManifestPermission;
type ManifestOptionalPermission = chrome.runtime.ManifestOptionalPermission;
type CoreManifestIcons = chrome.runtime.ManifestIcons;

export class ManifestError extends Error {
    public constructor(message: string) {
        super("Manifest: " + message);
    }
}

export default abstract class<T extends CoreManifest> implements ManifestBuilder<T> {
    protected name?: string;
    protected author?: string;
    protected homepage?: string;
    protected shortName?: string;
    protected description?: string;
    protected minimumVersion?: string;
    protected version?: string;
    protected icon?: string;
    protected incognito?: ManifestIncognito;
    protected specific?: BrowserSpecific;
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

    protected raws: Set<OptionalManifest> = new Set();
    protected mergedRaws?: OptionalManifest;

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
        this.version = version;

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

    public setSpecific(settings?: BrowserSpecific): this {
        this.specific = settings;

        return this;
    }

    public mergeSpecific(settings: BrowserSpecific): this {
        this.specific = _.mergeWith({}, this.specific, settings, (objValue, srcValue) => {
            if (_.isArray(objValue) && _.isArray(srcValue)) {
                return _.union(objValue, srcValue);
            }
        });

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

    public setAccessibleResource(accessibleResources: ManifestAccessibleResources): this {
        this.accessibleResources = accessibleResources;

        return this;
    }

    public raw(manifest: OptionalManifest): this {
        this.raws.add(manifest);

        return this;
    }

    public build(): T {
        return this.merge<Manifest>(
            this.buildName(),
            this.buildShortName(),
            this.buildDescription(),
            this.buildVersion(),
            this.buildManifestVersion(),
            this.buildMinimumChromeVersion(),
            this.buildAuthor(),
            this.buildHomepageUrl(),
            this.buildIncognito(),
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
            this.buildBrowserSpecificSettings(),
            this.buildRaw()
        ) as T;
    }

    public get(): T {
        return this.build();
    }

    protected get combinedRaws(): OptionalManifest {
        if (this.mergedRaws) return this.mergedRaws;

        this.mergedRaws = Array.from(this.raws).reduce((result, raw) => {
            return _.mergeWith(result, raw, (objValue, srcValue) => {
                if (Array.isArray(objValue) && Array.isArray(srcValue)) {
                    return objValue.concat(srcValue);
                }
            });
        }, {});

        return this.mergedRaws;
    }

    protected get combinedPermissions(): ManifestPermissions {
        const result = new Set(this.permissions);
        if (this.combinedRaws.permissions) {
            for (const permission of this.combinedRaws.permissions) {
                result.add(permission);
            }
        }
        return result;
    }

    protected get combinedOptionalPermissions(): ManifestOptionalPermissions {
        const result = new Set(this.optionalPermissions);
        if (this.combinedRaws.optional_permissions) {
            for (const permission of this.combinedRaws.optional_permissions) {
                result.add(permission);
            }
        }
        return result;
    }

    protected get combinedHostPermissions(): ManifestHostPermissions {
        const result = new Set(this.hostPermissions);
        if (this.combinedRaws.host_permissions) {
            for (const permission of this.combinedRaws.host_permissions) {
                result.add(permission);
            }
        }
        return result;
    }

    protected get combinedOptionalHostPermissions(): ManifestHostPermissions {
        const result = new Set(this.optionalHostPermissions);
        if (this.combinedRaws.optional_host_permissions) {
            for (const permission of this.combinedRaws.optional_host_permissions) {
                result.add(permission);
            }
        }
        return result;
    }

    private merge<T extends CoreManifest>(...sources: Array<Partial<T> | undefined>): T {
        sources = sources.filter(source => source !== undefined);

        if (sources.length === 0) {
            throw new ManifestError("No sources provided for manifest merging");
        }

        const result = {} as T;

        for (const source of sources) {
            Object.assign(result, source);
        }

        return result;
    }

    protected buildName(): Partial<CoreManifest> {
        return {name: this.name || this.combinedRaws.name || "__MSG_app_name__"};
    }

    protected buildShortName(): Partial<CoreManifest> | undefined {
        const shortName = this.shortName || this.combinedRaws.short_name;
        return shortName ? {short_name: shortName} : undefined;
    }

    protected buildDescription(): Partial<CoreManifest> | undefined {
        const description = this.description || this.combinedRaws.description;
        return description ? {description} : undefined;
    }

    protected buildVersion(): Partial<CoreManifest> {
        return {version: this.version || this.combinedRaws.version || "0.0.0"};
    }

    protected buildManifestVersion(): Partial<CoreManifest> {
        return {manifest_version: this.getManifestVersion()};
    }

    protected buildMinimumChromeVersion(): Partial<CoreManifest> | undefined {
        const version = this.minimumVersion || this.combinedRaws.minimum_chrome_version;
        return version ? {minimum_chrome_version: version} : undefined;
    }

    protected buildAuthor(): Partial<CoreManifest> | undefined {
        const author = this.author || this.combinedRaws.author;
        return author ? {author} : undefined;
    }

    protected buildHomepageUrl(): Partial<CoreManifest> | undefined {
        const homepage = this.homepage || this.combinedRaws.homepage_url;
        return homepage ? {homepage_url: homepage} : undefined;
    }

    protected buildIncognito(): Partial<CoreManifest> | undefined {
        const incognito = this.incognito || this.combinedRaws.incognito;
        return incognito !== undefined ? {incognito} : undefined;
    }

    protected buildLocale(): Partial<CoreManifest> | undefined {
        const defaultLocale = this.locale || this.combinedRaws.default_locale;
        return defaultLocale ? {default_locale: defaultLocale} : undefined;
    }

    protected buildIcons(): Partial<CoreManifest> | undefined {
        const icons = {
            ...this.combinedRaws.icons,
            ...this.getIconsByName(this.icon),
        };
        return Object.keys(icons).length ? {icons} : undefined;
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
        const internalCommands = Array.from(this.commands).reduce(
            (commands, command) => {
                return {
                    ...commands,
                    [command.name]: {
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
                    },
                };
            },
            {} as CoreManifest["commands"]
        );

        const commands = _.merge(this.combinedRaws.commands, internalCommands);

        if (Object.keys(commands).length) return {commands};
    }

    protected buildContentScripts(): Partial<CoreManifest> | undefined {
        const contentScripts: ManifestV3["content_scripts"] = [];

        if (this.combinedRaws.content_scripts) {
            contentScripts.push(...this.combinedRaws.content_scripts);
        }

        if (this.contentScripts.size > 0) {
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
        }

        return contentScripts.length ? {content_scripts: contentScripts} : undefined;
    }

    protected buildSidebar(): Partial<CoreManifest> | undefined {
        if (!this.sidebar) {
            const sidebarAction = this.combinedRaws.sidebar_action;
            const sidePanel = this.combinedRaws.side_panel;

            if (SidebarAlternativeBrowsers.has(this.browser)) {
                if (sidebarAction) return {sidebar_action: sidebarAction};
            } else {
                if (sidePanel) return {side_panel: sidePanel};
            }

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

    protected buildBrowserSpecificSettings(): Partial<Manifest> | undefined {
        const optionalSettings = this.combinedRaws.browser_specific_settings;
        const {safari, gecko, geckoAndroid} = this.specific || {};

        if (this.browser === Browser.Firefox) {
            const id = gecko?.id || optionalSettings?.gecko?.id;
            const updateUrl = gecko?.updateUrl || optionalSettings?.gecko?.update_url;
            const geckoMinVersion = gecko?.strictMinVersion || optionalSettings?.gecko?.strict_min_version;
            const geckoMaxVersion = gecko?.strictMaxVersion || optionalSettings?.gecko?.strict_max_version;
            const dataCollectionPermissions = _.mergeWith(
                optionalSettings?.gecko?.data_collection_permissions,
                gecko?.dataCollectionPermissions,
                (objValue, srcValue) => {
                    if (Array.isArray(objValue) && Array.isArray(srcValue)) {
                        return objValue.concat(srcValue);
                    }
                }
            );

            const androidMinVersion =
                geckoAndroid?.strictMinVersion || optionalSettings?.gecko_android?.strict_min_version;
            const androidMaxVersion =
                geckoAndroid?.strictMaxVersion || optionalSettings?.gecko_android?.strict_max_version;

            return {
                browser_specific_settings: {
                    gecko: {
                        id,
                        update_url: updateUrl,
                        strict_min_version: geckoMinVersion,
                        strict_max_version: geckoMaxVersion,
                        data_collection_permissions: normalizeDataCollectionPermissions(dataCollectionPermissions),
                    },
                    gecko_android:
                        _.isEmpty(androidMinVersion) && _.isEmpty(androidMaxVersion)
                            ? undefined
                            : {
                                  strict_min_version: androidMinVersion,
                                  strict_max_version: androidMaxVersion,
                              },
                },
            };
        } else if (this.browser === Browser.Safari) {
            const minVersion = safari?.strictMinVersion || optionalSettings?.safari?.strict_min_version;
            const maxVersion = safari?.strictMaxVersion || optionalSettings?.safari?.strict_max_version;

            if (_.isEmpty(minVersion) && _.isEmpty(maxVersion)) {
                return;
            }

            return {
                browser_specific_settings: {
                    safari: {
                        strict_min_version: minVersion,
                        strict_max_version: maxVersion,
                    },
                },
            };
        }
    }

    protected buildRaw(): Partial<Manifest> | undefined {
        const {
            name,
            short_name,
            description,
            version,
            minimum_chrome_version,
            author,
            homepage_url,
            incognito,
            default_locale,
            icons,
            background,
            commands,
            action,
            sidebar,
            content_scripts,
            permissions,
            optional_permissions,
            host_permissions,
            optional_host_permissions,
            web_accessible_resources,
            browser_specific_settings,
            ...other
        } = this.combinedRaws;

        return other;
    }

    protected hasExecuteActionCommand(): boolean {
        const optionalCommands = this.combinedRaws.commands;

        const inInternalCommands =
            this.commands.size > 0 && Array.from(this.commands).some(({name}) => name === CommandExecuteActionName);
        const inOptionalCommands = optionalCommands && Object.keys(optionalCommands).includes(CommandExecuteActionName);
        return inInternalCommands || inOptionalCommands;
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

        if (this.combinedRaws.web_accessible_resources) {
            resources.push(...this.combinedRaws.web_accessible_resources);
        }

        return mergeWebAccessibleResources(resources);
    }
}
