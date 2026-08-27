import ContentDriver from "./ContentDriver";

import RelayFinder from "@cli/entrypoint/finder/RelayFinder";

import {ContentScriptDeclarative, type ContentScriptEntrypointOptions} from "@typing/content";
import {RelayAllFrames, type RelayEntrypointOptions, RelayMethod} from "@typing/relay";
import type {ManifestOptionalPermissions, ManifestPermissions} from "@typing/manifest";

export default class extends ContentDriver<ContentScriptEntrypointOptions, RelayEntrypointOptions> {
    public constructor(finder: RelayFinder) {
        super(finder);
    }

    protected transform(relayOptions: RelayEntrypointOptions): ContentScriptEntrypointOptions {
        const {allFrames, method: _method, name: _name, ...options} = relayOptions;

        return {
            ...options,
            ...(allFrames === undefined ? {} : {allFrames: allFrames !== false}),
        };
    }

    protected async calculatePermissions(): Promise<[ManifestPermissions, ManifestOptionalPermissions]> {
        const permissions: ManifestPermissions = new Set();
        const optionalPermissions: ManifestOptionalPermissions = new Set();
        const relays = Array.from((await this.getOptions()).values());

        if (
            relays.some(
                options =>
                    (options.method ?? RelayMethod.Messaging) === RelayMethod.Messaging &&
                    options.allFrames === RelayAllFrames.All
            )
        ) {
            permissions.add("webNavigation");
        }

        if (
            relays.some(
                options =>
                    options.method === RelayMethod.Scripting &&
                    (options.declarative === true || options.declarative === ContentScriptDeclarative.Required)
            )
        ) {
            permissions.add("scripting");
        } else if (
            relays.some(
                options =>
                    options.method === RelayMethod.Scripting &&
                    options.declarative === ContentScriptDeclarative.Optional
            )
        ) {
            optionalPermissions.add("scripting");
        }

        return [permissions, optionalPermissions];
    }
}
