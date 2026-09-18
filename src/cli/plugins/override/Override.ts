import path from "path";

import View from "../view/View";

import {
    AbstractOverrideFinder,
    BookmarksFinder,
    collectPermissions,
    HistoryFinder,
    NewtabFinder,
} from "@cli/entrypoint";
import {resolveRootPath} from "@cli/resolvers/path";
import {toPosix} from "@cli/utils/path";

import {Browser} from "@typing/browser";
import {EntrypointFile, EntrypointType} from "@typing/entrypoint";
import type {ReadonlyConfig} from "@typing/config";
import type {CspConfig} from "@typing/csp";
import type {ManifestOverride} from "@typing/manifest";
import type {OverrideEntrypointOptions, OverrideEntrypointType} from "@typing/override";
import type {EntrypointPermissions} from "@typing/permissions";

type OverrideFinder = AbstractOverrideFinder<OverrideEntrypointOptions>;

const ChromiumBrowsers: readonly Browser[] = [Browser.Chrome, Browser.Chromium, Browser.Edge];

/** Browsers that honour each overridden page. Other targets are built without that entrypoint. */
const OverrideBrowsers: Readonly<Record<OverrideEntrypointType, ReadonlySet<Browser>>> = {
    [EntrypointType.Newtab]: new Set([...ChromiumBrowsers, Browser.Firefox, Browser.Safari]),
    [EntrypointType.Bookmarks]: new Set(ChromiumBrowsers),
    [EntrypointType.History]: new Set(ChromiumBrowsers),
};

/**
 * Owns the rule shared by the override entrypoints: a build carries at most one of them.
 * Pages the target browser does not support are skipped first, then the remaining ones must not compete.
 */
export default class Override {
    protected readonly finders: Readonly<Record<OverrideEntrypointType, OverrideFinder>>;

    protected _finder?: Promise<OverrideFinder | undefined>;

    public constructor(protected readonly config: ReadonlyConfig) {
        this.finders = {
            [EntrypointType.Newtab]: new NewtabFinder(config),
            [EntrypointType.Bookmarks]: new BookmarksFinder(config),
            [EntrypointType.History]: new HistoryFinder(config),
        };
    }

    public files(type: OverrideEntrypointType): Promise<Set<EntrypointFile>> {
        return this.finders[type].files();
    }

    public async view(): Promise<View<OverrideEntrypointOptions> | undefined> {
        const finder = await this.finder();

        return finder && new View(this.config, finder);
    }

    public async manifest(): Promise<ManifestOverride | undefined> {
        const finder = await this.finder();

        if (!finder) {
            return;
        }

        const [view] = (await finder.views()).values();

        return {page: `${finder.type()}` as const, path: view.filename};
    }

    public async csp(): Promise<CspConfig[]> {
        const finder = await this.finder();

        return finder ? finder.csp() : [];
    }

    /** Permissions of the override that reaches the build; skipped and losing candidates contribute nothing. */
    public async permissions(): Promise<EntrypointPermissions> {
        const finder = await this.finder();

        return collectPermissions(finder ? await finder.selectedOptions() : []);
    }

    public clear(): this {
        this._finder = undefined;

        for (const finder of Object.values(this.finders)) {
            finder.clear();
        }

        return this;
    }

    protected finder(): Promise<OverrideFinder | undefined> {
        return (this._finder ??= this.select());
    }

    protected async select(): Promise<OverrideFinder | undefined> {
        const {browser, debug} = this.config;

        const finders: OverrideFinder[] = [];

        for (const finder of Object.values(this.finders)) {
            if (await finder.empty()) {
                continue;
            }

            if (!OverrideBrowsers[finder.type()].has(browser)) {
                if (debug) {
                    console.warn(`The "${finder.type()}" override is not supported by ${browser} and was skipped`);
                }

                continue;
            }

            finders.push(finder);
        }

        if (finders.length > 1) {
            throw new Error(await this.describeConflict(finders));
        }

        return finders[0];
    }

    protected async describeConflict(finders: OverrideFinder[]): Promise<string> {
        const {app, browser} = this.config;

        const rootDir = resolveRootPath(this.config);

        const entries = await Promise.all(
            finders.map(async finder => {
                const [{file}] = (await finder.views()).values();

                const location = file.external ? file.import : toPosix(path.relative(rootDir, file.file));

                return `  - ${finder.type()}: ${location}`;
            })
        );

        return [
            `An extension can override only one browser page, but app "${app}" enables ${finders.length} override entrypoints for ${browser}:`,
            ...entries,
            `Keep a single override or limit the others with "includeApp", "excludeApp", "includeBrowser" or "excludeBrowser".`,
        ].join("\n");
    }
}
