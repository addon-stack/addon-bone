if (typeof document !== "undefined") {
    var loadStylesheet = function (chunkId) {
        var href = __ADNBN_CSS_FILENAME_EXPRESSION__(chunkId);
        var fullhref = __ADNBN_PUBLIC_PATH__ + href;

        return __ADNBN_REQUIRE__.__ADNBN_RUNTIME_PROPERTY__.load(fullhref);
    };

    __ADNBN_ORIGINAL_CSS_RUNTIME__;
}
