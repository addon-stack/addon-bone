import {Configuration as RspackConfig} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import TypescriptConfig from "./TypescriptConfig";

import {TransportDeclaration, TransportDeclarationLayer, VendorDeclaration} from "./declaration";

export {default as FileBuilder} from "./FileBuilder";
export {TypescriptConfig, VendorDeclaration, TransportDeclaration, TransportDeclarationLayer};

export default definePlugin(() => {
    let typescript: TypescriptConfig;

    return {
        name: "adnbn:typescript",
        startup: ({config}) => {
            typescript = TypescriptConfig.make(config);

            VendorDeclaration.make(config);
        },
        bundler: () => {
            return {
                resolve: {
                    extensions: [".ts", ".tsx", ".js", ".jsx"],
                    alias: typescript.aliases(),
                },
                module: {
                    rules: [
                        {
                            test: /\.tsx?$/,
                            loader: "builtin:swc-loader",
                            options: {
                                jsc: {
                                    parser: {
                                        syntax: "typescript",
                                        tsx: true,
                                    },
                                    target: "es2020",
                                },
                            },
                            type: "javascript/auto",
                        },
                        {
                            test: /\.jsx$/,
                            loader: "builtin:swc-loader",
                            options: {
                                jsc: {
                                    parser: {
                                        syntax: "ecmascript",
                                        jsx: true,
                                    },
                                    target: "es2020",
                                },
                            },
                            type: "javascript/auto",
                        },
                    ],
                },
            } satisfies RspackConfig;
        },
    };
});
