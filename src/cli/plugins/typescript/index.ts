import {Configuration as RspackConfig} from "@rspack/core";

import {definePlugin} from "@main/plugin";

import {ConfigBuilder} from "@cli/builders/typescript";

import TypescriptConfig from "./TypescriptConfig";

import {TransportDeclaration, TransportDeclarationLayer, VendorDeclaration} from "./declaration";

export {default as FileBuilder} from "./FileBuilder";
export {TypescriptConfig, VendorDeclaration, TransportDeclaration, TransportDeclarationLayer};

export default definePlugin(() => {
    let typescript: TypescriptConfig;

    return {
        name: "adnbn:typescript",
        startup: ({config}) => {
            const {tsConfig} = config;
            const configBuilder = ConfigBuilder.from();

            if (typeof tsConfig === "function") {
                tsConfig(configBuilder);
            } else if (typeof tsConfig === "object") {
                configBuilder.raw(tsConfig);
            }

            typescript = new TypescriptConfig(config).merge(configBuilder.get()).build();

            VendorDeclaration.make(config);
        },
        bundler: () => {
            return {
                resolve: {
                    extensions: [".ts", ".tsx", ".js"],
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
                    ],
                },
            } satisfies RspackConfig;
        },
    };
});
