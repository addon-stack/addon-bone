import {processPluginHandler} from "./plugin";

import {mergeTopology} from "@cli/utils/topology";

import {ReadonlyConfig} from "@typing/config";
import {TopologyContribution, TopologySnapshot} from "@typing/topology";

/**
 * Assemble the {@link TopologySnapshot} by running the `topology` plugin hook across all plugins
 * and merging their slices via {@link mergeTopology}. Must run AFTER `bundler` so the entrypoint
 * discovery the plugins cache during their `bundler` hook is already populated (the `topology`
 * hook just reads it — no extra filesystem scan).
 *
 * The merge/sort itself is pure and lives in `@cli/utils/topology` so it can be unit-tested
 * directly; this resolver only owns running the hook across plugins.
 */
export default async (config: ReadonlyConfig): Promise<TopologySnapshot> => {
    const contributions: TopologyContribution[] = [];

    for await (const {result} of processPluginHandler(config.plugins, "topology", {config})) {
        contributions.push(result);
    }

    return mergeTopology(contributions);
};
