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
    let release: {version: string; name: string; notes: string};

    beforeAll(() => {
        // Exercise the installed ESM parser and writer without Jest transforms or release side effects.
        release = JSON.parse(
            execFileSync(
                process.execPath,
                [
                    "--input-type=module",
                    "-e",
                    `
                        import {CommitParser} from "conventional-commits-parser";
                        import {Bumper} from "conventional-recommended-bump";
                        import {writeChangelogString} from "conventional-changelog-writer";
                        import semver from "semver";
                        import createReleaseConfig from "./.release-it.cjs";

                        const config = createReleaseConfig();
                        const options = config.plugins["@release-it/conventional-changelog"];
                        const commit = new CommitParser(options.parserOpts).parse(
                            "feat(relay)!: update relay targets\\n\\nBREAKING CHANGE: targets are mutually exclusive"
                        );
                        const {releaseType} = await new Bumper().commits([commit]).bump(
                            commits => options.whatBump(commits, "0.8.0")
                        );
                        const version = semver.inc("0.8.0", releaseType);
                        const changelog = await writeChangelogString([commit], {
                            ...options.context,
                            version,
                            date: "2026-08-27",
                        }, options.writerOpts);

                        process.stdout.write(JSON.stringify({
                            version,
                            name: config.github.releaseName.replace("\${version}", version),
                            notes: config.github.releaseNotes({changelog}),
                        }));
                    `,
                ],
                {cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 10_000}
            )
        );
    });

    test("recommends 0.9.0 for a parsed pre-1.0 breaking change", () => {
        expect(release.version).toBe("0.9.0");
    });

    test("uses the framework name in the GitHub release title and notes heading", () => {
        expect(release.name).toBe("Addon Bone v0.9.0");
        expect(release.notes).toMatch(/^## 🚀 Release Addon Bone v0\.9\.0 \(2026-08-27\)/);
        expect(release.notes).not.toContain("`adnbn`");
    });

    test("preserves the breaking changes section in a pre-1.0 release", () => {
        expect(release.notes).toContain("### 💥 Breaking Changes");
        expect(release.notes).toContain("targets are mutually exclusive");
    });
});
