import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Iframe Content Integration",
    description: "Exercises production iframe rendering, styles, local fonts and document recovery.",
    version: "1.0.0",
    specific: {gecko: {id: "isolation-iframe@adnbn.test"}},
    assetsFilename: "[name].[contenthash:8][ext]",
    jsFilename: "[name].[chunkhash:8].js",
    cssFilename: "[name].[contenthash:8].css",
    bundler: {
        optimization: {
            splitChunks: {
                cacheGroups: {
                    sharedStyles: {
                        name: "shared-styles",
                        test: /shared[\\/]styles\.module\.css$/,
                        type: "css/mini-extract",
                        chunks: "all",
                        minChunks: 2,
                        enforce: true,
                    },
                },
            },
        },
    },
});
