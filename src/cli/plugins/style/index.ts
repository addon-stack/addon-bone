import _ from "lodash";
import path from "path";
import fs from "fs";
import {
    Configuration as RspackConfig,
    CssExtractRspackPlugin,
    LoaderContext,
    RuleSetUse,
    RuleSetUseItem,
} from "@rspack/core";

import {mergeStyleSources} from "./utils";
import {DocumentStylesLayer, DefaultStylesLayer} from "@cli/bundler/layers";

import {definePlugin} from "@main/plugin";

import {appFilenameResolver} from "@cli/bundler";
import {getAppSourcePath, getResolvePath, getSharedPath} from "@cli/resolvers/path";

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

        if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
            return content;
        }

        const appPath = path.join(appDir, relative);

        if (!fs.existsSync(appPath)) {
            context.addMissingDependency(appPath);

            return content;
        }

        context.addDependency(appPath);

        try {
            return mergeStyleSources(
                {filename, content},
                {filename: appPath, content: fs.readFileSync(appPath, "utf8")}
            );
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
            const {app, cssDir, cssFilename, cssIdentName, mergeStyles} = config;

            const filename = appFilenameResolver(app, cssFilename, cssDir);
            const kebabApp = _.kebabCase(app);

            const createSassRuleSet = (rule: RuleSetUseItem): RuleSetUse => {
                return [
                    CssExtractRspackPlugin.loader,
                    rule,
                    {
                        loader: "sass-loader",
                        options: mergeStyles ? {additionalData: createStyleMerger(config)} : {},
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
