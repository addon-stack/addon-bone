import type {Compiler} from "@rspack/core";

import {getManifestHooks} from "../utils/manifest-hooks";
import {validateResourceAccess} from "./utils";

export interface ResourceAccessPluginRequirement {
    resource: string;
    matches: readonly string[];
    /** Identifies the caller in build diagnostics; it has no effect on access rules. */
    issuer: string;
    /** Optional caller-specific guidance when access is insufficient. */
    hint?: string;
}

export interface ResourceAccessPluginOptions {
    /** Resolvers run against the final manifest on every compilation, including watch rebuilds. */
    requirements:
        | readonly ResourceAccessPluginRequirement[]
        | (() => readonly ResourceAccessPluginRequirement[] | Promise<readonly ResourceAccessPluginRequirement[]>);
}

/** Validates requested access without granting permissions or modifying the manifest. */
export default class ResourceAccessPlugin {
    public constructor(private readonly options: ResourceAccessPluginOptions) {}

    public apply(compiler: Compiler): void {
        compiler.hooks.compilation.tap("ResourceAccessPlugin", compilation => {
            getManifestHooks(compilation).validate.tapPromise("ResourceAccessPlugin", async manifest => {
                const requirements =
                    typeof this.options.requirements === "function"
                        ? await this.options.requirements()
                        : this.options.requirements;

                validateResourceAccess(requirements, manifest);
            });
        });
    }
}
