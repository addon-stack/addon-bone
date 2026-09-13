import {spawnSync} from "node:child_process";
import path from "node:path";

type Environment = Record<string, string | undefined>;
type Execute = (
    command: string,
    args: string[],
    options: {cwd: string; env: Environment; shell: false; stdio: "inherit"}
) => {status: number | null; error?: Error};

const {shouldRelease, getReleaseArguments, runRelease} = require("../.github/scripts/releaseAutomation.cjs") as {
    shouldRelease: (env: Environment) => boolean;
    getReleaseArguments: (env: Environment) => string[];
    runRelease: (env: Environment, execute: Execute) => number;
};

const root = path.resolve(__dirname, "..");
const script = path.join(root, ".github/scripts/releaseAutomation.cjs");
const environment = (overrides: Environment = {}): Environment => ({
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/main",
    GITHUB_ACTOR: "maintainer",
    RELEASE_APP_SLUG: "addon-bone-release",
    RELEASE_TOKEN_APP_SLUG: "addon-bone-release",
    ...overrides,
});

describe("release automation event policy", () => {
    test.each(["push", "workflow_dispatch"])("allows a human %s on main", eventName => {
        expect(shouldRelease(environment({GITHUB_EVENT_NAME: eventName}))).toBe(true);
    });

    test.each([
        ["a development push", {GITHUB_REF: "refs/heads/develop"}],
        [
            "a manual run from another branch",
            {GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/develop"},
        ],
        ["a tag named main", {GITHUB_REF: "refs/tags/main"}],
        ["a different event", {GITHUB_EVENT_NAME: "pull_request"}],
        ["the release App's push", {GITHUB_ACTOR: "addon-bone-release[bot]"}],
        [
            "a human rerun of the release App's push",
            {GITHUB_ACTOR: "addon-bone-release[bot]", GITHUB_TRIGGERING_ACTOR: "maintainer"},
        ],
    ])("skips %s", (_label, overrides) => {
        expect(shouldRelease(environment(overrides))).toBe(false);
    });

    test("does not trust a release-looking commit message to skip a human push", () => {
        expect(shouldRelease(environment({GITHUB_HEAD_COMMIT_MESSAGE: "chore(release): v9.9.9"}))).toBe(true);
    });

    test.each(["GITHUB_ACTOR", "RELEASE_APP_SLUG"])("fails closed when %s is missing", key => {
        expect(() => shouldRelease(environment({[key]: ""}))).toThrow("Release actor and App slug are required.");
    });

    test("emits the policy job output without invoking release-it", () => {
        const result = spawnSync(process.execPath, [script, "policy"], {
            cwd: root,
            env: {...process.env, ...environment()},
            encoding: "utf8",
            timeout: 10_000,
        });

        expect(result.status).toBe(0);
        expect(result.stdout).toBe("should_release=true\n");
    });

    test("does not release when the command is omitted", () => {
        const result = spawnSync(process.execPath, [script], {
            cwd: root,
            env: {...process.env, ...environment()},
            encoding: "utf8",
            timeout: 10_000,
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Expected policy or run.");
    });
});

describe("release automation invocation", () => {
    test("keeps automatic bumping and the latest npm tag by default", () => {
        expect(getReleaseArguments(environment())).toEqual(["--ci", "--npm.tag=latest"]);
    });

    test("passes explicit manual release options", () => {
        expect(
            getReleaseArguments(
                environment({RELEASE_VERSION: "1.2.3-beta.1", RELEASE_PREID: "beta", RELEASE_NPM_TAG: "beta"})
            )
        ).toEqual(["--ci", "--preRelease=beta", "--npm.tag=beta", "--increment=1.2.3-beta.1"]);
    });

    test.each(["latest", "beta", "next", "canary-1", "rc.2", "nightly_build"])("accepts the npm dist-tag %s", tag => {
        expect(getReleaseArguments(environment({RELEASE_NPM_TAG: tag}))).toEqual(["--ci", `--npm.tag=${tag}`]);
    });

    test.each([
        "--script-shell=/tmp/release-probe-never-executed",
        "next --no-git.push",
        "next\n--no-npm.publish",
        "$(printf injected)",
        "next; printf injected",
        "`printf injected`",
        "1.2.3",
        "v1.4",
        "x",
    ])("rejects the unsafe or version-like npm tag %s before starting release-it", tag => {
        const execute = jest.fn(() => ({status: 0}));

        expect(() => runRelease(environment({RELEASE_NPM_TAG: tag}), execute)).toThrow("Invalid npm dist-tag.");
        expect(execute).not.toHaveBeenCalled();
    });

    test("the installed release-it parser keeps version and prerelease strings inside argument values", () => {
        const env = environment({
            RELEASE_VERSION: "--config=/tmp/other.cjs",
            RELEASE_PREID: 'rc; $(printf injected) "quoted"',
            RELEASE_NPM_TAG: "beta",
        });

        const result = spawnSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                `
                    import {readFileSync} from "node:fs";
                    import {parseCliArguments} from "./node_modules/release-it/lib/args.js";
                    process.stdout.write(JSON.stringify(parseCliArguments(JSON.parse(readFileSync(0, "utf8")))));
                `,
            ],
            {cwd: root, encoding: "utf8", input: JSON.stringify(getReleaseArguments(env)), timeout: 10_000}
        );

        expect(result.status).toBe(0);
        const parsed = JSON.parse(result.stdout);
        expect(parsed).toMatchObject({
            ci: true,
            preRelease: env.RELEASE_PREID,
            npm: {tag: env.RELEASE_NPM_TAG},
            increment: env.RELEASE_VERSION,
        });
        expect(parsed.config).toBeUndefined();
        expect(parsed.git).toBeUndefined();
        expect(parsed.npm.publish).toBeUndefined();
    });

    test("runs the installed release-it without a shell and preserves its exit status", () => {
        const env = environment({GITHUB_TOKEN: "test-token", RELEASE_VERSION: "1.2.3"});
        const execute = jest.fn(() => ({status: 7}));

        expect(runRelease(env, execute)).toBe(7);
        expect(execute).toHaveBeenCalledWith(
            process.execPath,
            [
                path.join(root, "node_modules/release-it/bin/release-it.js"),
                "--ci",
                "--npm.tag=latest",
                "--increment=1.2.3",
            ],
            {cwd: root, env, shell: false, stdio: "inherit"}
        );
    });

    test.each([
        ["a non-main run", {GITHUB_REF: "refs/heads/develop"}, "This event is not allowed to release."],
        ["the release App's event", {GITHUB_ACTOR: "addon-bone-release[bot]"}, "This event is not allowed to release."],
        [
            "a different token App",
            {RELEASE_TOKEN_APP_SLUG: "another-app"},
            "The release token App does not match RELEASE_APP_SLUG.",
        ],
        [
            "a missing token App identity",
            {RELEASE_TOKEN_APP_SLUG: undefined},
            "The release token App does not match RELEASE_APP_SLUG.",
        ],
    ])("does not start release-it for %s", (_label, overrides, error) => {
        const execute = jest.fn(() => ({status: 0}));

        expect(() => runRelease(environment(overrides), execute)).toThrow(error);
        expect(execute).not.toHaveBeenCalled();
    });

    test("fails if the release process cannot start", () => {
        const error = new Error("Unable to start release-it");

        expect(() => runRelease(environment(), () => ({status: null, error}))).toThrow(error);
    });

    test("fails if the release process is terminated without an exit code", () => {
        expect(runRelease(environment(), () => ({status: null}))).toBe(1);
    });
});
