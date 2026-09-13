var resolveExtensionChunkPublicPath = function () {
    if (!__ADNBN_PUBLIC_PATH__) {
        var extensionApi =
            globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.getURL
                ? globalThis.browser
                : globalThis.chrome;

        if (!extensionApi || !extensionApi.runtime || !extensionApi.runtime.getURL) {
            return Promise.reject(new Error("Unable to resolve the extension URL for chunk loading"));
        }

        __ADNBN_PUBLIC_PATH__ = extensionApi.runtime.getURL("/");
    }

    return Promise.resolve();
};

var ensureExtensionChunk = __ADNBN_ENSURE_CHUNK__;

__ADNBN_ENSURE_CHUNK__ = function (chunkId) {
    return resolveExtensionChunkPublicPath().then(function () {
        return ensureExtensionChunk(chunkId);
    });
};

__ADNBN_LOAD_SCRIPT__ = function (url, done) {
    import(url).then(
        function () {
            done({type: "load", target: {src: url}});
        },
        function (error) {
            done({type: "error", target: {src: url}, error: error});
        }
    );
};
