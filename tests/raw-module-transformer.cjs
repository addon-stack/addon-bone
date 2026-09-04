module.exports = {
    getCacheKey(source, filename) {
        return require("crypto").createHash("sha256").update(source).update(filename).update("raw-v2").digest("hex");
    },
    process(source) {
        return {code: `module.exports = ${JSON.stringify(source)};`};
    },
};
