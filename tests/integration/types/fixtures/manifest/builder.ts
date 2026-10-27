import {Browser, DataCollectionPermission, ManifestIncognito, defineConfig, definePlugin} from "adnbn";
import type {
    ActionOptions,
    BrowserSpecific,
    CoreManifest,
    CspConfig,
    DataCollectionPermissions,
    GeckoSpecific,
    Manifest,
    ManifestAccessibleResource,
    ManifestAccessibleResources,
    ManifestBackground,
    ManifestBuilder,
    ManifestCommand,
    ManifestCommands,
    ManifestContentScript,
    ManifestContentScripts,
    ManifestEntry,
    ManifestHostPermissions,
    ManifestIcon,
    ManifestIcons,
    ManifestIncognitoValue,
    ManifestOptionalPermission,
    ManifestOptionalPermissions,
    ManifestOptions,
    ManifestOverride,
    ManifestOverridePage,
    ManifestPermission,
    ManifestPermissions,
    ManifestPopup,
    ManifestSandbox,
    ManifestSidebar,
    ManifestVersion,
    OptionalManifest,
    VersionSpecific,
} from "adnbn";

// @ts-expect-error: Compilation dependencies are not a root export.
import type {ManifestDependencies} from "adnbn";
// @ts-expect-error: Compilation dependency entries are not a root export.
import type {ManifestDependency} from "adnbn";

const version: ManifestVersion = 3;
const core: CoreManifest = {manifest_version: version, name: "Example", version: "1.0.0"};
const manifest: Manifest = core;
const raw: OptionalManifest = {version_name: "1.0 beta"};
const incognito: ManifestIncognitoValue = ManifestIncognito.Split;
const entry: ManifestEntry = {entry: "background"};
const background: ManifestBackground = {...entry, persistent: false};
const command: ManifestCommand = {name: "open", defaultKey: "Ctrl+Shift+Y"};
const commands: ManifestCommands = new Set([command]);
const content: ManifestContentScript = {entry: "content", matches: ["https://example.com/*"], allFrames: false};
const contents: ManifestContentScripts = new Set([content]);
const popup: ManifestPopup = {path: "popup.html", title: "Open"};
const sidebar: ManifestSidebar = {path: "sidebar.html", title: "Panel", icon: "default"};
const options: ManifestOptions = {path: "options.html", openInTab: false};
const page: ManifestOverridePage = "newtab";
const override: ManifestOverride = {page, path: "newtab.html"};
const sandbox: ManifestSandbox = "sandbox.html";
const icon: ManifestIcon = new Map([[16, "icon-16.png"]]);
const icons: ManifestIcons = new Map([["default", icon]]);
const permission: ManifestPermission = "storage";
const permissions: ManifestPermissions = new Set([permission]);
const optionalPermission: ManifestOptionalPermission = "bookmarks";
const optionalPermissions: ManifestOptionalPermissions = new Set([optionalPermission]);
const hosts: ManifestHostPermissions = new Set(["https://example.com/*"]);

const resource: ManifestAccessibleResource = {
    resources: ["panel.html"],
    matches: ["https://example.com/*"],
    useDynamicUrl: false,
};

const resources: ManifestAccessibleResources = new Set([resource]);

const dataCollection: DataCollectionPermissions = {
    required: [DataCollectionPermission.BrowsingActivity],
    optional: ["technicalAndInteraction"],
};

const versions: VersionSpecific = {strictMinVersion: "140.0"};
const gecko: GeckoSpecific = {...versions, id: "example@example.com", dataCollectionPermissions: dataCollection};
const specific: BrowserSpecific = {gecko, geckoAndroid: versions, safari: versions};
const action: ActionOptions = {title: "Open", icon: "default"};
const csp: CspConfig = {wasm: false};

const configure = (builder: ManifestBuilder): ManifestBuilder => {
    return builder
        .setIncognito(incognito)
        .setBackground(background)
        .setCommands(commands)
        .setContentScripts(contents)
        .setPopup(popup)
        .setSidebar(sidebar)
        .setOptions(options)
        .setOverride(override)
        .addSandbox(sandbox)
        .setIcons(icons)
        .setPermissions(permissions)
        .setOptionalPermissions(optionalPermissions)
        .setHostPermissions(hosts)
        .setAccessibleResource(resources)
        .addAccessibleResource(resource)
        .setSpecific(specific)
        .mergeSpecific(specific)
        .setAction(action)
        .addCsp(csp)
        .raw(raw);
};

declare const builder: ManifestBuilder;
const result: Manifest = configure(builder).get();
const accessible: ManifestAccessibleResource[] = builder.getWebAccessibleResources();
declare const coreBuilder: ManifestBuilder<CoreManifest>;
const coreResult: CoreManifest = coreBuilder.get();

// @ts-expect-error: Dependency injection belongs to the internal builder.
builder.setDependencies(new Map());
// @ts-expect-error: Fluent calls must keep the public boundary.
builder.raw(raw).setName("Example").setDependencies(new Map());

defineConfig({
    browser: Browser.Firefox,
    specific,
    manifest(builder) {
        configure(builder);
        const current: Manifest = builder.get();
        const accessible: ManifestAccessibleResource[] = builder.getWebAccessibleResources();
        // @ts-expect-error: Configuration callbacks receive the public builder.
        builder.setDependencies(new Map());
        // @ts-expect-error: Fluent calls do not expose the implementation.
        builder.raw(raw).setSidebar(sidebar).setDependencies(new Map());

        return raw;
    },
});

definePlugin(() => ({
    name: "manifest-contract",
    manifest({manifest: builder}) {
        configure(builder);
        const current: Manifest = builder.get();
        const accessible: ManifestAccessibleResource[] = builder.getWebAccessibleResources();
        // @ts-expect-error: Plugin handlers receive the public builder.
        builder.setDependencies(new Map());
        // @ts-expect-error: Fluent calls do not expose the implementation.
        builder.raw(raw).setOverride(override).setDependencies(new Map());
    },
}));

// @ts-expect-error: Only Manifest V2 and V3 are supported.
const invalidVersion: ManifestVersion = 4;
// @ts-expect-error: Incognito values are restricted.
const invalidIncognito: ManifestIncognitoValue = "private";
// @ts-expect-error: Entry names are strings.
const invalidEntry: ManifestEntry = {entry: 123};
// @ts-expect-error: Background persistence is boolean.
const invalidBackground: ManifestBackground = {...entry, persistent: "false"};
// @ts-expect-error: Command names are required.
const invalidCommand: ManifestCommand = {description: "Open"};
// @ts-expect-error: Content script matches must be an array.
const invalidContent: ManifestContentScript = {entry: "content", matches: "https://example.com/*"};
// @ts-expect-error: Sidebar paths are strings.
const invalidSidebar: ManifestSidebar = {path: 123};
// @ts-expect-error: Options pages require a path.
const invalidOptions: ManifestOptions = {openInTab: false};
// @ts-expect-error: Only supported override pages are accepted.
const invalidOverride: ManifestOverride = {page: "downloads", path: "downloads.html"};
// @ts-expect-error: Icon sizes are numbers.
const invalidIcon: ManifestIcon = new Map([["16", "icon.png"]]);
// @ts-expect-error: Permission values are strings.
const invalidPermissions: ManifestPermissions = new Set([123]);
// @ts-expect-error: Dynamic resource URLs use a boolean flag.
const invalidResource: ManifestAccessibleResource = {resources: ["panel.html"], useDynamicUrl: "false"};
// @ts-expect-error: Browser version limits are strings.
const invalidSpecific: BrowserSpecific = {gecko: {strictMinVersion: 140}};
// @ts-expect-error: Data collection categories use the existing restricted contract.
const invalidDataCollection: DataCollectionPermissions = {required: ["unknown"]};
