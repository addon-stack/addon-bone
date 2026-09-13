var isolatedStyleRoots = new Map();
var isolatedRequestedStyles = new Set();
var isolatedStyleTimeout = __ADNBN_TIMEOUT__;
var isolatedStyleEntry = __ADNBN_ENTRY__;
var isolatedInitialStyles;

var createStyleError = function (url, type) {
    var error = new Error('Loading isolated CSS for entrypoint "' + isolatedStyleEntry + '" failed.\n(' + url + ")");
    error.code = "CSS_CHUNK_LOAD_FAILED";
    error.type = type;
    error.request = url;
    return error;
};

var attachStyle = function (root, url, retry) {
    var rootState = isolatedStyleRoots.get(root);

    if (!rootState) return Promise.resolve();

    var existing = rootState.styles.get(url);

    if (existing) return existing.promise;

    var resolveStyle;
    var rejectStyle;
    var promise = new Promise(function (resolve, reject) {
        resolveStyle = resolve;
        rejectStyle = reject;
    });
    var settled = false;
    var record = {
        link: undefined,
        promise: promise,
        cancel: function () {
            settle();
            record.link.remove();
        },
    };

    rootState.styles.set(url, record);

    var settle = function (error) {
        if (settled) return;
        settled = true;
        record.link.onerror = record.link.onload = null;
        clearTimeout(timer);

        if (error) {
            rootState.styles.delete(url);
            record.link.remove();
            rejectStyle(error);
        } else {
            resolveStyle();
        }
    };

    var start = function (previous) {
        var link = root.ownerDocument.createElement("link");
        record.link = link;
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = url;
        link.onload = function () {
            if (!settled && record.link === link) settle();
        };
        link.onerror = function (event) {
            if (settled || record.link !== link) return;
            if (retry) {
                retry = false;
                link.onerror = link.onload = null;
                start(link);
            } else {
                var type = event && event.type ? event.type : "error";
                settle(createStyleError(url, type));
            }
        };
        // Replace in place: appending a retry could change the CSS cascade order.
        root.insertBefore(link, previous || rootState.target);
        if (previous) previous.remove();
    };
    // One budget for both attempts, never another timer for the retry.
    var timer = setTimeout(function () {
        settle(createStyleError(url, "timeout"));
    }, isolatedStyleTimeout);

    start();

    return promise;
};

__ADNBN_REQUIRE__[__ADNBN_PROPERTY__] = {
    initialize: function (resolveUrl) {
        if (!isolatedInitialStyles) isolatedInitialStyles = __ADNBN_INITIAL_STYLES__.map(resolveUrl);
    },
    add: function (root, target, retry) {
        if (isolatedStyleRoots.has(root)) return;
        if (!isolatedInitialStyles)
            throw new Error('Isolated stylesheet URLs for entrypoint "' + isolatedStyleEntry + '" are not initialized');

        isolatedStyleRoots.set(root, {target: target, styles: new Map()});

        isolatedInitialStyles.concat(Array.from(isolatedRequestedStyles)).forEach(function (url) {
            attachStyle(root, url, retry).catch(function (error) {
                console.error(error);
            });
        });
    },
    delete: function (root) {
        var rootState = isolatedStyleRoots.get(root);

        if (!rootState) return;

        isolatedStyleRoots.delete(root);
        rootState.styles.forEach(function (record) {
            record.cancel();
        });
    },
    load: function (url) {
        isolatedRequestedStyles.add(url);

        return Promise.all(
            Array.from(isolatedStyleRoots.keys(), function (root) {
                return attachStyle(root, url);
            })
        ).then(function () {});
    },
};
