import type {Compiler, RspackPluginInstance} from "@rspack/core";
import {sources} from "@rspack/core";

export interface EntryPointMetaPluginOptions {

    ident?: string;

    statsOptions?: {
        entrypoints?: boolean;
        chunks?: boolean;
        assets?: boolean;
    };
}

export default class implements RspackPluginInstance {
    private readonly ident: string;
    private readonly statsOptions: Required<EntryPointMetaPluginOptions["statsOptions"]>;

    constructor(opts: EntryPointMetaPluginOptions = {}) {
        this.ident = opts.ident ?? "__ENTRYPOINT_META__";
        this.statsOptions = {
            entrypoints: true,
            chunks: true,
            assets: true,
            ...(opts.statsOptions ?? {}),
        };
    }

    apply(compiler: Compiler) {
        const PLUGIN = "EntrypointMetaPlugin";


        compiler.hooks.thisCompilation.tap(PLUGIN, (compilation: any) => {
            const summarizeStage = (compiler as any).rspack?.Compilation?.PROCESS_ASSETS_STAGE_SUMMARIZE ?? 10000;

            compilation.hooks.processAssets.tap(
                {name: PLUGIN, stage: summarizeStage},
                () => {
                    const stats = compilation.getStats().toJson(this.statsOptions);
                    const byEntry: Record<string, {
                        name: string;
                        files: string[];
                        js: string[];
                        css: string[];
                        assets: string[]
                    }>
                        = {};

                    for (const [name, ep] of Object.entries<any>(stats.entrypoints ?? {})) {
                        const files = (ep.assets ?? [])
                            .map((a: any) => (typeof a === "string" ? a : a?.name))
                            .filter(Boolean);

                        const js = files.filter((f) => typeof f === "string" && f.endsWith(".js"));
                        const css = files.filter((f) => typeof f === "string" && f.endsWith(".css"));
                        const others = files.filter((f) => typeof f === "string" && !f.endsWith(".js") && !f.endsWith(".css"));

                        byEntry[name] = {
                            name,
                            files: files as string[],
                            js: js as string[],
                            css: css as string[],
                            assets: others as string[]
                        };
                    }

                    const fullLiteral = JSON.stringify(byEntry);

                    const META_RE = /(["'])__ADNBN_EM__META__\1/g;
                    const NAME_RE = /(["'])__ADNBN_EM__NAME__\1/g;


                    for (const [entryName, meta] of Object.entries(byEntry)) {
                        const nameLiteral = JSON.stringify(entryName); // строковый литерал с кавычками
                        for (const assetName of meta.js) {
                            const asset = compilation.getAsset(assetName);
                            if (!asset) continue;
                            const src = asset.source.source().toString();
                            let replaced = src;
                            let changed = false;

                            if (META_RE.test(replaced)) {
                                replaced = replaced.replace(META_RE, `(${fullLiteral})`);
                                changed = true;
                            }

                            if (NAME_RE.test(replaced)) {
                                replaced = replaced.replace(NAME_RE, `(${nameLiteral})`);
                                changed = true;
                            }
                            if (!changed) continue;
                            compilation.updateAsset(
                                assetName,
                                () => new sources.RawSource(replaced)
                            );
                        }
                    }
                }
            );
        });
    }
}