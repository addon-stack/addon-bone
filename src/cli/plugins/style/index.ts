import _ from "lodash";
import path from "path";
import fs from "fs";
import {createRequire} from "module";
import {
    Configuration as RspackConfig,
    CssExtractRspackPlugin,
    LoaderContext,
    RuleSetUse,
    RuleSetUseItem,
} from "@rspack/core";

import {prepareStyleSources, joinStyleUrl, type StyleSource} from "@cli/bundler/styles";
import {DocumentStylesLayer, DefaultStylesLayer} from "@cli/bundler/layers";

import {definePlugin} from "@main/plugin";

import {appFilenameResolver} from "@cli/bundler";
import {getAppSourcePath, getResolvePath, getSharedPath} from "@cli/workspace";

import {ReadonlyConfig} from "@typing/config";

// CssExtract also identifies dependencies by loader request, not just by layer.
// Keep default and document styles distinct even when their contents are identical.
const DefaultAsIsLoaderIdent = "adnbn-default-asis";
const DefaultModulesLoaderIdent = "adnbn-default-modules";

const createStyleMerger = (config: ReadonlyConfig) => {
    const sharedDir = getResolvePath(getSharedPath(config));
    const appDir = getResolvePath(getAppSourcePath(config));

    return (content: string, context: LoaderContext): string => {
        const filename = context.resourcePath;
        const relative = path.relative(sharedDir, filename);
        const sources: StyleSource[] = [{filename, content}];
        const inShared = relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);

        try {
            if (config.mergeStyles && inShared) {
                const appPath = path.join(appDir, relative);

                if (appPath !== filename) {
                    if (fs.existsSync(appPath)) {
                        context.addDependency(appPath);
                        sources.push({filename: appPath, content: fs.readFileSync(appPath, "utf8")});
                    } else {
                        context.addMissingDependency(appPath);
                    }
                }
            }

            // Even an unmerged source can configure a partial with a full relative url().
            return prepareStyleSources(sources, filename, (dependency, exists) => {
                if (exists) {
                    context.addDependency(dependency);
                } else {
                    context.addMissingDependency(dependency);
                }
            });
        } catch (error) {
            // sass-loader prepares additionalData outside its error handler. Fail the compilation
            // explicitly and supply no stylesheet instead of compiling an incomplete shared fallback.
            context.emitError(error instanceof Error ? error : new Error(String(error)));

            return "";
        }
    };
};

export default definePlugin(() => {
    return {
        name: "adnbn:styles",
        bundler: ({config}) => {
            const {app, cssDir, cssFilename, cssIdentName} = config;

            const filename = appFilenameResolver(app, cssFilename, cssDir);
            const kebabApp = _.kebabCase(app);

            const urlLoader = createRequire(import.meta.url).resolve("../../bundler/loaders/resolve-style-urls");

            const createSassRuleSet = (rule: RuleSetUseItem): RuleSetUse => {
                return [
                    CssExtractRspackPlugin.loader,
                    rule,
                    {
                        loader: urlLoader,
                        options: {join: joinStyleUrl},
                    },
                    {
                        loader: "sass-loader",
                        options: {sourceMap: true, additionalData: createStyleMerger(config)},
                    },
                ];
            };

            const createStyleRules = (defaultStyles = false) => [
                {
                    resourceQuery: /[?&]asis(?:[=&]|$)/,
                    use: createSassRuleSet({
                        loader: "css-loader",
                        ...(defaultStyles ? {ident: DefaultAsIsLoaderIdent} : {}),
                        options: {esModule: true, modules: false},
                    }),
                },
                {
                    use: createSassRuleSet({
                        loader: "css-loader",
                        ...(defaultStyles ? {ident: DefaultModulesLoaderIdent} : {}),
                        options: {
                            esModule: true,
                            modules: {
                                exportLocalsConvention: "as-is",
                                namedExport: false,
                                localIdentName: cssIdentName.replaceAll("[app]", kebabApp),
                                localIdentHashSalt: kebabApp,
                            },
                        },
                    }),
                },
            ];

            return {
                resolve: {
                    extensions: [".css", ".scss"],
                },
                plugins: [
                    new CssExtractRspackPlugin({
                        filename,
                        chunkFilename: filename,
                    }),
                ],
                module: {
                    rules: [
                        {
                            test: /\.(scss|css)$/,
                            type: "javascript/auto",
                            oneOf: [
                                {
                                    resourceQuery: /[?&]unisolated(?:[=&]|$)/,
                                    layer: DocumentStylesLayer,
                                    oneOf: createStyleRules(),
                                },
                                {
                                    // Nested CSS imports preserve an explicit document destination.
                                    issuerLayer: DocumentStylesLayer,
                                    layer: DocumentStylesLayer,
                                    oneOf: createStyleRules(),
                                },
                                {layer: DefaultStylesLayer, oneOf: createStyleRules(true)},
                            ],
                        },
                    ],
                },
            } satisfies RspackConfig;
        },
    };
});
