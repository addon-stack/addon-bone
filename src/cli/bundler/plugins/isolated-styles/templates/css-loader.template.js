__ADNBN_ORIGINAL_CSS_LOADER__;

var loadDocumentStylesheet = __ADNBN_CSS_STYLESHEET_LOADER__;
__ADNBN_CSS_STYLESHEET_LOADER__ = function (chunkId, fetchPriority) {
    if (!__ADNBN_ISOLATED_CSS_CHUNKS__[chunkId]) {
        return loadDocumentStylesheet(chunkId, fetchPriority);
    }

    var href = __ADNBN_CSS_FILENAME_EXPRESSION__(chunkId);
    var fullhref = __ADNBN_PUBLIC_PATH__ + href;

    return __ADNBN_REQUIRE__[__ADNBN_PROPERTY__].load(fullhref);
};

__ADNBN_ORIGINAL_CSS_RUNTIME__;
