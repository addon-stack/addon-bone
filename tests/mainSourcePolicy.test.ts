import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {load} from "js-yaml";

const root = path.resolve(__dirname, "..");
const script = path.join(root, ".github/scripts/validateMainPullRequestSource.mjs");
const runPolicy = (input: string) =>
    spawnSync(process.execPath, [script], {
        cwd: root,
        encoding: "utf8",
        input,
        timeout: 10_000,
    });

const event = (head: unknown = {ref: "develop", repo: {id: 123}}, base: unknown = {ref: "main", repo: {id: 123}}) => ({
    pull_request: {head, base},
});

describe("main pull request source policy", () => {
    test("allows develop to main in the same repository", () => {
        const result = runPolicy(JSON.stringify(event()));

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Source policy passed: develop -> main in the same repository.");
    });

    test.each([
        ["another source branch", event({ref: "feature/fix", repo: {id: 123}})],
        ["a differently cased source branch", event({ref: "Develop", repo: {id: 123}})],
        ["a fork's develop branch", event({ref: "develop", repo: {id: 456}})],
        ["a different target branch", event(undefined, {ref: "develop", repo: {id: 123}})],
        ["missing head repository", event({ref: "develop"})],
        ["missing base repository", event(undefined, {ref: "main"})],
        ["both repositories missing", event({ref: "develop"}, {ref: "main"})],
        ["a deleted head repository", event({ref: "develop", repo: null})],
        ["string repository IDs", event({ref: "develop", repo: {id: "123"}}, {ref: "main", repo: {id: "123"}})],
        ["invalid repository IDs", event({ref: "develop", repo: {id: 0}}, {ref: "main", repo: {id: 0}})],
        ["missing pull request", {}],
        ["null event", null],
        ["false event", false],
    ])("rejects %s", (_label, payload) => {
        const result = runPolicy(JSON.stringify(payload));

        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Only pull requests from this repository's develop branch may target main.");
    });

    test("fails closed for invalid JSON", () => {
        const result = runPolicy("{");

        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Unable to read valid pull request event JSON.");
    });
});

type Workflow = {
    on: Record<string, {branches?: string[]; types?: string[]}>;
    permissions?: Record<string, string>;
    jobs: Record<
        string,
        {
            name?: string;
            if?: string;
            steps: Array<{uses?: string; run?: string; with?: Record<string, string | boolean>}>;
        }
    >;
};

const workflow = (name: string) => load(readFileSync(path.join(root, ".github/workflows", name), "utf8")) as Workflow;

describe("main source policy workflow", () => {
    const policy = workflow("main-pr.yml");
    const job = policy.jobs["source-policy"];

    test("covers main PR creation, updates, reopening, and retargeting using a trusted event", () => {
        expect(policy.on).toEqual({
            pull_request_target: {
                branches: ["main"],
                types: ["opened", "reopened", "synchronize", "edited"],
            },
        });
        expect(job.if).toBeUndefined();
    });

    test("executes only the policy from the trusted workflow revision with read-only permissions", () => {
        expect(policy.permissions).toEqual({contents: "read"});
        expect(job.steps).toEqual([
            expect.objectContaining({
                uses: "actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683",
                with: {ref: "${{ github.workflow_sha }}", "persist-credentials": false},
            }),
            expect.objectContaining({
                run: 'node .github/scripts/validateMainPullRequestSource.mjs < "$GITHUB_EVENT_PATH"',
            }),
        ]);
    });

    test("runs CI before merging to main without changing development push targets", () => {
        const ci = workflow("ci.yml");

        expect(ci.on.pull_request.branches).toEqual(["main", "develop", "feature/**"]);
        expect(ci.on.push.branches).toEqual(["develop", "feature/**"]);
    });
});
