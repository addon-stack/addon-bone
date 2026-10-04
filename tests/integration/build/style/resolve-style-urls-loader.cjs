// Rspack uses native import() for ESM loaders, which Jest's CJS VM does not host.
// Adapt only module loading; the built production loader still owns all behavior.
// The native consumer smoke test additionally exercises its real ESM entry.
module.exports = require("../../../../dist/cli/bundler/loaders/resolve-style-urls.js").default;
