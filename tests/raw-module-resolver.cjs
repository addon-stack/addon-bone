module.exports = (request, options) => {
    const suffix = "?raw";
    const target = request.endsWith(suffix) ? request.slice(0, -suffix.length) : request;

    return options.defaultResolver(target, options);
};
