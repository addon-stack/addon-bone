const {execSync} = require("node:child_process");
const pkg = require("./package.json");

function deriveGithubFromEmail(email) {
    if (!email) {
        return {};
    }

    const m = email.match(/^([^@]+)@users\.noreply\.github\.com$/i);

    if (!m) {
        return {};
    }

    const local = m[1];
    const login = local.includes("+") ? local.split("+").pop() : local;

    if (!login) {
        return {};
    }

    return {login, url: `https://github.com/${login}`};
}

function getContributors() {
    try {
        let fromTag;

        try {
            const tag = execSync("git describe --tags --abbrev=0", {encoding: "utf8"}).trim();
            fromTag = tag || null;
        } catch {
            fromTag = null;
        }

        const range = fromTag ? `${fromTag}..HEAD` : "";
        const cmd = `git shortlog -sne ${range}`.trim();
        const out = execSync(cmd, {encoding: "utf8"}).trim();

        if (!out) {
            return [];
        }

        const lines = out.split("\n").filter(Boolean);

        const map = new Map();

        for (const line of lines) {
            const m = line.match(/^\s*(\d+)\s+(.*?)(?:\s+<([^>]+)>)?\s*$/);

            const count = Number(m?.[1] || 0);

            const displayName = (m?.[2] || "").trim() || undefined;
            const displayEmail = (m?.[3] || "").trim() || undefined;

            const lcName = (displayName || "").toLowerCase();
            const lcEmail = (displayEmail || "").toLowerCase();

            // Filter bots using lowercase keys only
            if (lcName.includes("bot") || lcEmail.includes("bot")) {
                continue;
            }

            const gh = deriveGithubFromEmail(displayEmail);
            const loginKey = gh.login ? gh.login.toLowerCase() : null;

            const key = loginKey ? `gh:${loginKey}` : lcEmail ? `em:${lcEmail}` : `nm:${lcName}`;

            const existing = map.get(key);

            if (existing) {
                existing.count += count;
                if (!existing.login && gh.login) {
                    existing.login = gh.login;
                    existing.url = gh.url;
                }
                if (!existing.name && displayName) {
                    existing.name = displayName;
                }
                if (!existing.email && displayEmail) {
                    existing.email = displayEmail;
                }
            } else {
                map.set(key, {count, name: displayName, email: displayEmail, ...gh});
            }
        }

        return Array.from(map.values());
    } catch {
        return [];
    }
}

const types = new Map([
    ["feat", "✨ Features"],
    ["fix", "🐛 Bug Fixed"],
    ["perf", "⚡️ Performance Improvements"],
    ["refactor", "🛠️ Refactoring"],
    ["docs", "📝 Documentation"],
    ["test", "🧪 Tests"],
    ["build", "🏗️ Build System"],
    ["ci", "🤖 CI"],
    ["chore", "🧹 Chores"],
    ["revert", "⏪ Reverts"],
]);

const normalizeRepoUrl = url => url.replace(/^git\+/, "").replace(/\.git$/, "");
const repoUrl = pkg?.repository?.url ? normalizeRepoUrl(pkg.repository.url) : null;

const breakingChangePattern = /\bBREAKING[ -]?CHANGE\b/i;

function hasBreakingChange(commit) {
    if (commit.breaking) {
        return true;
    }

    const type = String(commit.type || "").trim();

    if (type.endsWith("!")) {
        return true;
    }

    if (typeof commit.header === "string" && /^\w+(?:\([^)]+\))?!:/.test(commit.header)) {
        return true;
    }

    if (
        commit.notes?.some(note =>
            [note.title, note.text].some(value => typeof value === "string" && breakingChangePattern.test(value))
        )
    ) {
        return true;
    }

    return typeof commit.footer === "string" && breakingChangePattern.test(commit.footer);
}

function whatBump(commits, currentVersion = pkg.version) {
    let isBreaking = false;
    let isMinor = false;
    let isPatch = false;

    for (const commit of commits) {
        if (hasBreakingChange(commit)) {
            isBreaking = true;
        }

        const type = String(commit.type || "")
            .trim()
            .toLowerCase()
            .replace(/!+$/, "");

        if (["feat", "revert"].includes(type)) {
            isMinor = true;
        }

        if (["fix", "perf", "refactor", "ci"].includes(type)) {
            isPatch = true;
        }
    }

    if (isBreaking) {
        const currentMajor = Number.parseInt(String(currentVersion).replace(/^v/i, "").split(".")[0], 10);

        return {level: Number.isNaN(currentMajor) || currentMajor >= 1 ? 0 : 1};
    }

    if (isMinor) return {level: 1};
    if (isPatch) return {level: 2};

    return null;
}

const createReleaseConfig = () => {
    const contributors = getContributors();

    return {
        ci: true,

        git: {
            requireCleanWorkingDir: true,
            requireUpstream: false,
            requireBranch: "main",
            commit: true,
            commitMessage: "chore(release): v${version}",
            tag: true,
            tagName: "v${version}",
            tagAnnotation: "v${version}",
            push: true,
        },

        github: {
            release: true,
            releaseName: "v${version}",
            autoGenerate: false,
            releaseNotes: ({changelog}) => changelog,
        },

        npm: {
            publish: true,
            skipChecks: true,
            versionArgs: ["--no-git-tag-version"],
        },

        plugins: {
            "@release-it/conventional-changelog": {
                infile: "CHANGELOG.md",
                preset: "conventionalcommits",

                parserOpts: {
                    // The preset's breaking pattern is incompatible with our extra breaking capture.
                    breakingHeaderPattern: null,
                    headerPattern: /^(\w+)(?:\(([^)]+)\))?(!)?:\s(.+?)(?:\s\(#\d+\))?$/,
                    headerCorrespondence: ["type", "scope", "breaking", "subject"],
                    noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
                },

                presetConfig: {
                    types: [...types.entries()].map(([type, section]) => ({type, section, hidden: false})),
                },

                context: {
                    name: pkg.name,
                    pkg: {name: pkg.name},
                    repoUrl,
                    contributors,
                },

                whatBump,
                writerOpts: {
                    headerPartial: "## 🚀 Release Addon Bone v{{version}} ({{date}})\n\n",
                    footerPartial: `{{#if @root.contributors.length}}\n### 🙌 Contributors\n\n{{#each @root.contributors}}- {{#if url}}{{#if name}}[{{name}}]({{url}}){{#if login}} (@{{login}}){{/if}}{{else}}[@{{login}}]({{url}}){{/if}}{{else}}{{#if email}}{{#if name}}[{{name}}](mailto:{{email}}){{else}}{{email}}{{/if}}{{else}}{{name}}{{/if}}{{/if}} — commits: {{count}}\n{{/each}}{{/if}}`,
                    mainTemplate:
                        "{{> header}}\n" +
                        "{{#if noteGroups}}\n### 💥 Breaking Changes\n\n{{#each noteGroups}}{{#each notes}}* {{{text}}}\n\n{{/each}}{{/each}}{{/if}}" +
                        "{{#each commitGroups}}\n### {{title}}\n\n{{#each commits}}{{> commit root=@root}}\n{{/each}}\n\n{{/each}}" +
                        "{{#unless commitGroups}}\n{{#each commits}}{{> commit root=@root}}\n{{/each}}{{/unless}}\n\n" +
                        "{{> footer}}",
                    commitPartial:
                        "{{#if type}}* {{#if scope}}**{{scope}}:** {{/if}}{{#if subject}}{{subject}}{{else}}{{header}}{{/if}}{{#if href}} ([{{shorthash}}]({{href}})){{/if}}\n\n{{#if body}}{{{body}}}\n{{/if}}{{/if}}",
                    groupBy: "type",
                    commitGroupsSort: "title",
                    commitsSort: ["scope", "subject"],
                    transform: commit => {
                        const nextCommit = {...commit};

                        // If header had a '!' (captured into `breaking` by parser), ensure we surface a BREAKING note
                        if (nextCommit.breaking && (!nextCommit.notes || nextCommit.notes.length === 0)) {
                            const text = nextCommit.subject || nextCommit.header;
                            nextCommit.notes = [{title: "BREAKING CHANGE", text}];
                        }

                        // Normalize type: lowercase and drop trailing '!' so 'feat!' maps to 'feat'
                        const type = (nextCommit.type || "").toLowerCase().replace(/!+$/, "");
                        const section = types.get(type);

                        if (section) {
                            nextCommit.type = section;
                        } else {
                            nextCommit.type = "🧩 Other";
                        }

                        if (nextCommit.body) {
                            const body = nextCommit.body.replace(/\r\n/g, "\n").trim();

                            nextCommit.body = body
                                .split("\n")
                                .map(line => (line ? `  ${line}` : ""))
                                .join("\n");
                        }

                        if (!nextCommit.href && nextCommit.hash && repoUrl) {
                            nextCommit.href = `${repoUrl}/commit/${nextCommit.hash}`;
                        }

                        if (!nextCommit.shorthash && nextCommit.hash) {
                            nextCommit.shorthash = nextCommit.hash.slice(0, 7);
                        }

                        return nextCommit;
                    },
                },
            },
        },
    };
};

module.exports = Object.assign(createReleaseConfig, {whatBump});
