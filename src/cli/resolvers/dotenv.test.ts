import {spawnSync} from "node:child_process";
import {cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const fixtures = path.join(__dirname, "tests/fixtures/dotenv");
const resolver = path.resolve(__dirname, "../../../dist/cli/resolvers/config.js");
const filenames = [
    ".env.development.chrome.local",
    ".env.development.chrome",
    ".env.chrome.local",
    ".env.chrome",
    ".env.development.local",
    ".env.development",
    ".env.local",
    ".env",
];

describe("dotenv resolution through the built config loader", () => {
    let temporary: string;
    let root: string;
    let cwd: string;

    beforeEach(() => {
        temporary = mkdtempSync(path.join(os.tmpdir(), "adnbn-dotenv-"));
        root = path.join(temporary, "project");
        cwd = path.join(temporary, "caller");
        mkdirSync(root);
        mkdirSync(cwd);
    });

    afterEach(() => {
        rmSync(temporary, {recursive: true, force: true});
    });

    const inspect = (env: NodeJS.ProcessEnv = {}, configFile = "missing.config.mjs") => {
        const inherited = Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !key.startsWith("ADNBN_ENV_"))
        );
        const result = spawnSync(process.execPath, [path.join(fixtures, "inspect.mjs"), resolver, root, configFile], {
            cwd,
            env: {...inherited, ...env},
            encoding: "utf8",
            timeout: 30_000,
        });

        expect(result.error).toBeUndefined();
        expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});

        return JSON.parse(result.stdout);
    };

    test("preserves all 24 file priorities, process precedence and reserved keys", () => {
        const directories = [path.join(root, "src/apps/sample/source"), path.join(root, "src/apps/sample"), root];
        const expected: Record<string, string> = {};
        let rank = 0;

        for (const directory of directories) {
            mkdirSync(directory, {recursive: true});

            for (const filename of filenames) {
                const values: Record<string, string> = {
                    ADNBN_ENV_CALLER: "file",
                    APP: "file",
                    BROWSER: "file",
                    MODE: "file",
                    MANIFEST_VERSION: "file",
                };

                for (let key = 0; key <= rank; key++) {
                    values[`ADNBN_ENV_PRIORITY_${key}`] = String(rank);
                }

                expected[`ADNBN_ENV_PRIORITY_${rank}`] = String(rank);
                writeFileSync(
                    path.join(directory, filename),
                    Object.entries(values)
                        .map(([key, value]) => `${key}=${value}`)
                        .join("\n")
                );
                rank++;
            }
        }

        const result = inspect({
            ADNBN_ENV_CALLER: "caller",
            APP: "caller",
            BROWSER: "caller",
            MODE: "caller",
            MANIFEST_VERSION: "caller",
        });
        const reserved = {APP: "sample", BROWSER: "chrome", MODE: "development", MANIFEST_VERSION: "3"};

        expect(result.host).toMatchObject({...expected, ...reserved, ADNBN_ENV_CALLER: "caller"});
        expect(result.bundled).toMatchObject({...expected, ...reserved, ADNBN_ENV_CALLER: "file"});
    });

    test("loads framework dotenv before config, repeats after target changes and leaves references literal", () => {
        cpSync(path.join(fixtures, "adnbn.config.mjs"), path.join(root, "adnbn.config.mjs"));
        writeFileSync(
            path.join(root, ".env.development.chrome"),
            "ADNBN_ENV_VALUE=chrome\nADNBN_ENV_REFERENCE=${ADNBN_ENV_VALUE}"
        );
        writeFileSync(path.join(root, ".env.production.firefox"), "ADNBN_ENV_VALUE=firefox\nADNBN_ENV_SECOND=second");
        const result = inspect({ADNBN_ENV_SWITCH: "1"}, "adnbn.config.mjs");

        expect(result.config).toMatchObject({
            ADNBN_ENV_VALUE: "chrome",
            ADNBN_ENV_REFERENCE: "${ADNBN_ENV_VALUE}",
            BROWSER: "chrome",
            MODE: "development",
            MANIFEST_VERSION: "3",
        });
        expect(result.host).toMatchObject({
            ADNBN_ENV_VALUE: "chrome",
            ADNBN_ENV_SECOND: "second",
            BROWSER: "firefox",
            MODE: "production",
            MANIFEST_VERSION: "2",
        });
        expect(result.bundled).toMatchObject({
            ADNBN_ENV_VALUE: "firefox",
            ADNBN_ENV_SECOND: "second",
            ADNBN_ENV_REFERENCE: "${ADNBN_ENV_VALUE}",
        });
    });

    test("ignores unrelated cwd dotenv when loading user config", () => {
        cpSync(path.join(fixtures, "adnbn.config.mjs"), path.join(root, "adnbn.config.mjs"));
        writeFileSync(path.join(cwd, ".env"), "ADNBN_ENV_CWD=cwd\nADNBN_ENV_CWD_REFERENCE=${ADNBN_ENV_CWD}");
        const result = inspect({}, "adnbn.config.mjs");

        expect(result.config).not.toHaveProperty("ADNBN_ENV_CWD");
        expect(result.config).not.toHaveProperty("ADNBN_ENV_CWD_REFERENCE");
        expect(result.host).not.toHaveProperty("ADNBN_ENV_CWD");
        expect(result.bundled).not.toHaveProperty("ADNBN_ENV_CWD");
    });
});
