module.exports = (request, options) => {
    const suffix = "?raw";
    const target = request.endsWith(suffix) ? request.slice(0, -suffix.length) : request;

    // Storage publishes ESM only. SWC transforms that entry for Jest's CJS runtime.
    if (target === "@addon-core/storage" || target.startsWith("@addon-core/storage/")) {
        return options.defaultResolver(target, {...options, conditions: ["import", "default"]});
    }

    return options.defaultResolver(target, options);
};
