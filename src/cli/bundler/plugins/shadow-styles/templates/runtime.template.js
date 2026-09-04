var shadowStyleRoots = new Map();
var shadowRequestedStyles = new Set();
var shadowStyleTimeout = __ADNBN_TIMEOUT__;
var shadowStyleEntry = __ADNBN_ENTRY__;

var createShadowStyleError = function (url, type) {
    var error = new Error('Loading shadow CSS for entrypoint "' + shadowStyleEntry + '" failed.\n(' + url + ")");
    error.code = "CSS_CHUNK_LOAD_FAILED";
    error.type = type;
    error.request = url;
    return error;
};

var attachShadowStyle = function (root, url) {
    var rootState = shadowStyleRoots.get(root);

    if (!rootState) return Promise.resolve();

    var existing = rootState.styles.get(url);

    if (existing) return existing.promise;

    var resolveStyle;
    var rejectStyle;
    var promise = new Promise(function (resolve, reject) {
        resolveStyle = resolve;
        rejectStyle = reject;
    });
    var link = document.createElement("link");
    var record = {
        link: link,
        promise: promise,
        reject: rejectStyle,
        resolve: resolveStyle,
        timer: undefined,
    };

    rootState.styles.set(url, record);
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = url;

    var settle = function (error) {
        link.onerror = link.onload = null;

        if (record.timer !== undefined) clearTimeout(record.timer);

        if (error) {
            rootState.styles.delete(url);
            link.remove();
            rejectStyle(error);
        } else {
            resolveStyle();
        }
    };

    link.onload = function () {
        settle();
    };
    link.onerror = function (event) {
        var type = event && event.type ? event.type : "error";
        settle(createShadowStyleError(url, type));
    };
    record.timer = setTimeout(function () {
        settle(createShadowStyleError(url, "timeout"));
    }, shadowStyleTimeout);

    root.insertBefore(link, rootState.target);

    return promise;
};

__ADNBN_REQUIRE__.__ADNBN_RUNTIME_PROPERTY__ = {
    add: function (root, target, initialStyles) {
        if (shadowStyleRoots.has(root)) return;

        shadowStyleRoots.set(root, {target: target, styles: new Map()});

        initialStyles.concat(Array.from(shadowRequestedStyles)).forEach(function (url) {
            attachShadowStyle(root, url).catch(function (error) {
                console.error(error);
            });
        });
    },
    delete: function (root) {
        var rootState = shadowStyleRoots.get(root);

        if (!rootState) return;

        rootState.styles.forEach(function (record) {
            record.link.onerror = record.link.onload = null;

            if (record.timer !== undefined) clearTimeout(record.timer);

            record.resolve();
        });
        shadowStyleRoots.delete(root);
    },
    load: function (url) {
        shadowRequestedStyles.add(url);

        return Promise.all(
            Array.from(shadowStyleRoots.keys(), function (root) {
                return attachShadowStyle(root, url);
            })
        ).then(function () {});
    },
};
