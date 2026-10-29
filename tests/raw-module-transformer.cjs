module.exports = {
    getCacheKey(source, filename) {
        return require("crypto")
            .createHash("sha256")
            .update(source)
            .update(filename)
            .update("raw-esm-v3")
            .digest("hex");
    },
    process(source) {
        return {code: `export default ${JSON.stringify(source)};`};
    },
};
