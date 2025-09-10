import type {Compilation, Compiler, RspackPluginInstance} from "@rspack/core";
import {DefinePlugin, sources} from "@rspack/core";
import {customAlphabet} from "nanoid";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface EntryPointMetaPluginOptions {
    ident?: string;

    statsOptions?: {
        entrypoints?: boolean;
        chunks?: boolean;
        assets?: boolean;
    };
}

const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz1234567890", 24);

export default class implements RspackPluginInstance {
    private readonly ident: string;
    private readonly statsOptions: Required<EntryPointMetaPluginOptions["statsOptions"]>;
    private readonly metaSentinel: string;
    private readonly nameSentinel: string;
    private readonly metaRegex: RegExp;
    private readonly nameRegex: RegExp;

    constructor(opts: EntryPointMetaPluginOptions = {}) {
        this.ident = opts.ident ?? "__ENTRYPOINT_META__";
        this.statsOptions = {
            entrypoints: true,
            chunks: true,
            assets: true,
            ...(opts.statsOptions ?? {}),
        };

        const suffix = generateId(24);
        this.metaSentinel = `__ADNBN_EM__META__${suffix}__`;
        this.nameSentinel = `__ADNBN_EM__NAME__${suffix}__`;
        this.metaRegex = new RegExp(`(["'])${escapeRegex(this.metaSentinel)}\\1`, "g");
        this.nameRegex = new RegExp(`(["'])${escapeRegex(this.nameSentinel)}\\1`, "g");
    }

    apply(compiler: Compiler) {
        const PLUGIN = "EntrypointMetaPlugin";

        new DefinePlugin({
            __ENTRYPOINT_META__: `(0, "${this.metaSentinel}")`,
            __ENTRYPOINT_NAME__: `(0, "${this.nameSentinel}")`,
        }).apply(compiler);

        compiler.hooks.thisCompilation.tap(PLUGIN, (compilation: Compilation) => {
            const summarizeStage = compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE;

            compilation.hooks.processAssets.tap({name: PLUGIN, stage: summarizeStage}, () => {
                const META_RE = this.metaRegex;
                const NAME_RE = this.nameRegex;

                const byEntry: Record<string, {js: string[]; css: string[]; assets: string[]}> = {};

                const chunkGraph = compilation.chunkGraph;

                for (const [entryName, ep] of compilation.entrypoints) {
                    const fileSet = new Set<string>();
                    const chunks = ep.chunks ?? [];

                    for (const chunk of chunks) {
                        for (const f of chunk.files) {
                            fileSet.add(String(f));
                        }

                        for (const f of chunk.auxiliaryFiles) {
                            fileSet.add(String(f));
                        }
                    }

                    for (const chunk of chunks) {
                        const mods = chunkGraph.getChunkModulesIterable(chunk);

                        for (const mod of mods) {
                            for (const a of Object.keys(mod.buildInfo.assets)) {
                                if (compilation.getAsset(a)) {
                                    fileSet.add(a);
                                }
                            }
                        }
                    }

                    const files = Array.from(fileSet);
                    const js = files.filter(f => f.endsWith(".js"));
                    const css = files.filter(f => f.endsWith(".css"));
                    const others = files.filter(f => !f.endsWith(".js") && !f.endsWith(".css"));

                    byEntry[entryName] = {js, css, assets: others};
                }

                const fullLiteral = JSON.stringify(byEntry);

                for (const [entryName, meta] of Object.entries(byEntry)) {
                    const nameLiteral = JSON.stringify(entryName);

                    for (const assetName of meta.js) {
                        const asset = compilation.getAsset(assetName);

                        if (!asset) {
                            continue;
                        }

                        let replaced = asset.source.source().toString();
                        let changed = false;

                        if (META_RE.test(replaced)) {
                            replaced = replaced.replace(META_RE, `(${fullLiteral})`);
                            changed = true;
                        }

                        if (NAME_RE.test(replaced)) {
                            replaced = replaced.replace(NAME_RE, `(${nameLiteral})`);
                            changed = true;
                        }

                        if (changed) {
                            compilation.updateAsset(assetName, () => new sources.RawSource(replaced));
                        }
                    }
                }
            });
        });
    }
}
