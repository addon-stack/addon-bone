import ContentManager from "./ContentManager";

import type {ContentDriver, ContentItems, ContentProvider} from "./types";

import type {ReadonlyConfig} from "@typing/config";
import type {ContentScriptEntrypointOptions} from "@typing/content";
import type {EntrypointFile} from "@typing/entrypoint";
import type {ManifestOptionalPermissions, ManifestPermissions} from "@typing/manifest";

class DriverFixture implements ContentDriver<ContentScriptEntrypointOptions> {
    public constructor(
        private readonly required: ManifestPermissions,
        private readonly optional: ManifestOptionalPermissions
    ) {}

    public async items(): Promise<ContentItems<ContentScriptEntrypointOptions>> {
        return new Map();
    }

    public async permissions(): Promise<ManifestPermissions> {
        return this.required;
    }

    public async optionalPermissions(): Promise<ManifestOptionalPermissions> {
        return this.optional;
    }
}

class ProviderFixture implements ContentProvider<ContentScriptEntrypointOptions> {
    public constructor(private readonly contentDriver: DriverFixture) {}

    public virtual(_file: EntrypointFile): string {
        return "";
    }

    public driver(): DriverFixture {
        return this.contentDriver;
    }

    public clear(): this {
        return this;
    }
}

describe("ContentManager permissions", () => {
    test("aggregates driver permissions and gives required permissions precedence", async () => {
        const manager = new ContentManager({rootDir: process.cwd()} as ReadonlyConfig)
            .provider(
                new ProviderFixture(
                    new DriverFixture(
                        new Set<chrome.runtime.ManifestPermission>(["scripting"]),
                        new Set<chrome.runtime.ManifestOptionalPermission>(["activeTab"])
                    )
                )
            )
            .provider(
                new ProviderFixture(
                    new DriverFixture(
                        new Set<chrome.runtime.ManifestPermission>(["webNavigation"]),
                        new Set<chrome.runtime.ManifestOptionalPermission>(["scripting"])
                    )
                )
            );

        await expect(manager.permissions()).resolves.toEqual(new Set(["scripting", "webNavigation"]));
        await expect(manager.optionalPermissions()).resolves.toEqual(new Set(["activeTab"]));
    });
});
