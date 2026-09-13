import _ from "lodash";
import path from "path";
import fs from "fs";
import {Configuration as RspackConfig, CssExtractRspackPlugin, RuleSetUse, RuleSetUseItem} from "@rspack/core";

import {mergeStyleSources} from "./utils";
import type {StylePluginOptions} from "./types";
import {IsolatedStylesLayer} from "@cli/bundler/utils/styles";

import {definePlugin} from "@main/plugin";

import {appFilenameResolver} from "@cli/bundler";
import {getAppSourcePath, getResolvePath, getSharedPath} from "@cli/resolvers/path";
import {toPosix} from "@cli/utils/path";

import {ReadonlyConfig} from "@typing/config";

// CssExtract also identifies dependencies by loader request, not just by layer.
// Keep isolated requests distinct from ordinary CSS and from each other's options.
const IsolatedAsIsLoaderIdent = "adnbn-isolated-asis";
const IsolatedModulesLoaderIdent = "adnbn-isolated-modules";

// prettier-ignore
const styleMergerLoader =
    (config: ReadonlyConfig) =>
        (sharedStyle: string, sharedPath: string): string | void => {
            const sharedDir = getResolvePath(getSharedPath(config));

            if (sharedPath.startsWith(sharedDir)) {
                const relativePath = path.relative(sharedDir, sharedPath);

                const appDir = getResolvePath(getAppSourcePath(config));
                const appPath = getResolvePath(path.join(appDir, relativePath));

                if (fs.existsSync(appPath)) {
                    let appStyle = fs.readFileSync(appPath, "utf8");

                    appStyle = appStyle.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, filePath) => {
                        if (
                            filePath.startsWith("/") ||
                            filePath.startsWith("http") ||
                            filePath.startsWith("data:")
                        ) {
                            return match;
                        }

                        const cssDir = path.dirname(appPath);
                        const assetAbs = path.resolve(cssDir, filePath);

                        const sharedFileDir = path.dirname(sharedPath);

                        const relativeToSharedFile = path.relative(sharedFileDir, assetAbs);

                        return `url("${toPosix(relativeToSharedFile)}")`;
                    });

                    return mergeStyleSources(sharedStyle, appStyle);
                }
            }
        };

export default definePlugin(({isolationIssuerLayer}: StylePluginOptions = {}) => {
    return {
        name: "adnbn:styles",
        bundler: ({config}) => {
            const {app, cssDir, cssFilename, cssIdentName, mergeStyles} = config;

            const filename = appFilenameResolver(app, cssFilename, cssDir);
            const kebabApp = _.kebabCase(app);

            const createSassRuleSet = (rule: RuleSetUseItem): RuleSetUse => {
                const rules: RuleSetUse = [CssExtractRspackPlugin.loader, rule, "sass-loader"];

                if (mergeStyles) {
                    rules.push({
                        loader: "source-modifier-loader",
                        options: {
                            modify: styleMergerLoader(config),
                        },
                    });
                }

                return rules;
            };

            const createStyleRules = (isolated = false) => [
                {
                    resourceQuery: /[?&]asis(?:[=&]|$)/,
                    use: createSassRuleSet({
                        loader: "css-loader",
                        ...(isolated ? {ident: IsolatedAsIsLoaderIdent} : {}),
                        options: {esModule: true, modules: false},
                    }),
                },
                {
                    use: createSassRuleSet({
                        loader: "css-loader",
                        ...(isolated ? {ident: IsolatedModulesLoaderIdent} : {}),
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
                optimization: {
                    splitChunks: {
                        cacheGroups: {
                            adnbnIsolatedStyles: {
                                type: "css/mini-extract",
                                layer: IsolatedStylesLayer,
                                chunks: "all",
                                enforce: true,
                                name: false,
                                priority: 100,
                            },
                        },
                    },
                },
                module: {
                    rules: [
                        {
                            test: /\.(scss|css)$/,
                            type: "javascript/auto",
                            oneOf: [
                                ...(isolationIssuerLayer === undefined
                                    ? []
                                    : [
                                          {
                                              issuerLayer: isolationIssuerLayer,
                                              resourceQuery: /[?&]isolation(?:[=&]|$)/,
                                              layer: IsolatedStylesLayer,
                                              oneOf: createStyleRules(true),
                                          },
                                      ]),
                                {oneOf: createStyleRules()},
                            ],
                        },
                    ],
                },
            } satisfies RspackConfig;
        },
    };
});
