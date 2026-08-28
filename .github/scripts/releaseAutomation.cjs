const {spawnSync} = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

const shouldRelease = env => {
    if (env.GITHUB_REF !== "refs/heads/main" || !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)) {
        return false;
    }

    const actor = env.GITHUB_ACTOR;
    const appSlug = env.RELEASE_APP_SLUG;
    if (!actor || !appSlug) {
        throw new Error("Release actor and App slug are required.");
    }

    // The authenticated actor survives reruns; commit authors and messages can be spoofed.
    return actor.toLowerCase() !== `${appSlug}[bot]`.toLowerCase();
};

const getReleaseArguments = env => {
    // The policy job runs before npm ci, so load this dependency only for release arguments.
    const {validRange} = require("semver");
    const tag = env.RELEASE_NPM_TAG || "latest";
    // release-it later passes ['--tag', tag] to npm, where a leading '--' could become another option.
    if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(tag) || validRange(tag)) {
        throw new Error("Invalid npm dist-tag.");
    }

    return [
        "--ci",
        ...(env.RELEASE_PREID ? [`--preRelease=${env.RELEASE_PREID}`] : []),
        `--npm.tag=${tag}`,
        ...(env.RELEASE_VERSION ? [`--increment=${env.RELEASE_VERSION}`] : []),
    ];
};

const runRelease = (env = process.env, execute = spawnSync) => {
    if (!shouldRelease(env)) {
        throw new Error("This event is not allowed to release.");
    }
    if (env.RELEASE_TOKEN_APP_SLUG !== env.RELEASE_APP_SLUG) {
        throw new Error("The release token App does not match RELEASE_APP_SLUG.");
    }

    const result = execute(
        process.execPath,
        [path.join(root, "node_modules/release-it/bin/release-it.js"), ...getReleaseArguments(env)],
        {cwd: root, env, shell: false, stdio: "inherit"}
    );
    if (result.error) {
        throw result.error;
    }
    return result.status ?? 1;
};

if (require.main === module) {
    try {
        if (process.argv[2] === "policy") {
            process.stdout.write(`should_release=${shouldRelease(process.env)}\n`);
        } else if (process.argv[2] === "run") {
            process.exitCode = runRelease();
        } else {
            throw new Error("Expected policy or run.");
        }
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = {shouldRelease, getReleaseArguments, runRelease};
