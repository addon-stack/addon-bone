import {execFileSync} from "node:child_process";
import path from "node:path";

type ReleaseCommit = {
    type?: string;
    header?: string;
    breaking?: string | boolean;
    footer?: string;
    notes?: Array<{title?: string; text?: string}>;
};

type Bump = {level: 0 | 1 | 2} | null;

const {whatBump} = require("../.release-it.cjs") as {
    whatBump: (commits: ReleaseCommit[], currentVersion?: string) => Bump;
};

describe("release-it version policy", () => {
    describe("breaking changes", () => {
        test("uses the package's current pre-1.0 version by default", () => {
            expect(whatBump([{type: "feat!"}])).toEqual({level: 1});
        });

        test.each([
            ["parser breaking field", {type: "feat", breaking: "!"}],
            ["type suffix", {type: "feat!"}],
            ["header suffix", {type: "feat", header: "feat(entrypoint)!: remove legacy API"}],
            ["BREAKING CHANGE note", {type: "fix", notes: [{title: "BREAKING CHANGE", text: "new contract"}]}],
            ["BREAKING-CHANGE footer", {type: "fix", footer: "BREAKING-CHANGE: new contract"}],
        ])("treats %s as a pre-1.0 minor bump", (_label, commit) => {
            expect(whatBump([commit], "0.6.0")).toEqual({level: 1});
        });

        test("becomes a major bump after 1.0", () => {
            expect(
                whatBump([{type: "fix", notes: [{title: "BREAKING CHANGE", text: "new contract"}]}], "1.4.2")
            ).toEqual({level: 0});
        });

        test("takes precedence over lower-level changes after 1.0", () => {
            expect(whatBump([{type: "fix"}, {type: "feat"}, {type: "refactor", breaking: true}], "2.0.0")).toEqual({
                level: 0,
            });
        });
    });

    test.each(["feat", "revert"])("uses a minor bump for %s", type => {
        expect(whatBump([{type}], "0.6.0")).toEqual({level: 1});
    });

    test.each(["fix", "perf", "refactor", "ci"])("uses a patch bump for %s", type => {
        expect(whatBump([{type}], "0.6.0")).toEqual({level: 2});
    });

    test("uses the highest non-breaking bump", () => {
        expect(whatBump([{type: "fix"}, {type: "feat"}], "0.6.0")).toEqual({level: 1});
    });

    test.each(["docs", "test", "chore", "build"])("does not release for %s alone", type => {
        expect(whatBump([{type}], "0.6.0")).toBeNull();
    });
});

describe("release-it GitHub release notes", () => {
    type Release = {version: string; name: string; notes: string};

    const renderRelease = (message: string, currentVersion = "0.8.0"): Release =>
        // Exercise the installed preset, parser, and writer without Jest transforms or release side effects.
        JSON.parse(
            execFileSync(
                process.execPath,
                [
                    "--input-type=module",
                    "-e",
                    `
                        import {readFileSync} from "node:fs";
                        import {CommitParser} from "conventional-commits-parser";
                        import {loadPreset} from "conventional-changelog-preset-loader";
                        import {Bumper} from "conventional-recommended-bump";
                        import {writeChangelogString} from "conventional-changelog-writer";
                        import semver from "semver";
                        import createReleaseConfig from "./.release-it.cjs";

                        const {message, currentVersion} = JSON.parse(readFileSync(0, "utf8"));
                        const config = createReleaseConfig();
                        const options = config.plugins["@release-it/conventional-changelog"];
                        const preset = await loadPreset(options.preset);
                        const commit = new CommitParser({...preset.parser, ...options.parserOpts}).parse(message);
                        const {releaseType} = await new Bumper().commits([commit]).bump(
                            commits => options.whatBump(commits, currentVersion)
                        );
                        const version = semver.inc(currentVersion, releaseType);
                        const changelog = await writeChangelogString([commit], {
                            ...options.context,
                            contributors: [],
                            version,
                            date: "2026-08-27",
                        }, {...preset.writer, ...options.writerOpts});

                        process.stdout.write(JSON.stringify({
                            version,
                            name: config.github.releaseName.replace("\${version}", version),
                            notes: config.github.releaseNotes({changelog}),
                        }));
                    `,
                ],
                {
                    cwd: path.resolve(__dirname, ".."),
                    encoding: "utf8",
                    input: JSON.stringify({message, currentVersion}),
                    timeout: 10_000,
                }
            )
        );

    let release: Release;

    beforeAll(() => {
        release = renderRelease(
            "feat(relay)!: update relay targets\n\nBREAKING CHANGE: targets are mutually exclusive"
        );
    });

    test("recommends 0.9.0 for a parsed pre-1.0 breaking change", () => {
        expect(release.version).toBe("0.9.0");
    });

    test("uses only the version in the GitHub release title and the framework name in the notes heading", () => {
        expect(release.name).toBe("v0.9.0");
        expect(release.notes).toMatch(/^## 🚀 Release Addon Bone v0\.9\.0 \(2026-08-27\)/);
        expect(release.notes).not.toContain("`adnbn`");
    });

    test("preserves the breaking changes section in a pre-1.0 release", () => {
        expect(release.notes).toContain("### 💥 Breaking Changes");
        expect(release.notes).toContain("targets are mutually exclusive");
    });

    test("renders a breaking commit description without repeating its header", () => {
        expect(release.notes).toContain("* **relay:** update relay targets\n");
    });

    test.each([
        ["feat(relay)!: update relay targets", "* **relay:** update relay targets\n"],
        ["feat!: update relay targets", "* update relay targets\n"],
    ])("renders %s without a breaking footer", (message, commitLine) => {
        const {notes} = renderRelease(message);

        expect(notes).toContain("### 💥 Breaking Changes\n\n* update relay targets\n");
        expect(notes).toContain(`### ✨ Features\n\n${commitLine}`);
    });

    test.each([
        ["0.8.0", "0.9.0"],
        ["1.4.2", "2.0.0"],
    ])("bumps %s to %s for a breaking fix without a footer", (currentVersion, expectedVersion) => {
        const result = renderRelease("fix(relay)!: update relay targets", currentVersion);

        expect(result.version).toBe(expectedVersion);
    });

    test("omits a pull request suffix from a breaking commit description", () => {
        const {notes} = renderRelease("feat(relay)!: update relay targets (#42)");

        expect(notes).toContain("### 💥 Breaking Changes\n\n* update relay targets\n");
        expect(notes).toContain("### ✨ Features\n\n* **relay:** update relay targets\n");
    });

    test.each(["BREAKING CHANGE", "BREAKING-CHANGE"])("recognizes a %s footer without an exclamation mark", keyword => {
        const result = renderRelease(`fix(relay): update relay targets\n\n${keyword}: targets are mutually exclusive`);

        expect(result.version).toBe("0.9.0");
        expect(result.notes).toContain("### 💥 Breaking Changes\n\n* targets are mutually exclusive\n");
        expect(result.notes).toContain("### 🐛 Bug Fixed\n\n* **relay:** update relay targets\n");
    });

    test("keeps an ordinary fix as a patch without a breaking changes section", () => {
        const result = renderRelease("fix(relay): update relay targets");

        expect(result.version).toBe("0.8.1");
        expect(result.notes).toContain("### 🐛 Bug Fixed\n\n* **relay:** update relay targets\n");
        expect(result.notes).not.toContain("### 💥 Breaking Changes");
    });
});
