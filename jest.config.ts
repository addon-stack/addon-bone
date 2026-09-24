import type {Config} from "jest";
import {availableParallelism} from "node:os";

const shared: Config = {
    rootDir: import.meta.dirname,
    testEnvironment: "node",
    globals: {ADNBN_TEST_ROOT: import.meta.dirname},
    setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
    transformIgnorePatterns: ["/node_modules/(?!(@addon-core/storage|nanoid)/)"],
    modulePathIgnorePatterns: ["<rootDir>/.cache/"],
    resolver: "<rootDir>/tests/raw-module-resolver.cjs",
    moduleNameMapper: {
        "^#adnbn/(.*)$": "<rootDir>/src/virtual/$1.ts",
        "^@cli/(.*)$": "<rootDir>/src/cli/$1",
        "^@entry/(.*)$": "<rootDir>/src/entry/$1",
        "^@frame/(.*)$": "<rootDir>/src/frame/$1",
        "^@locale/(.*)$": "<rootDir>/src/locale/$1",
        "^@offscreen/(.*)$": "<rootDir>/src/offscreen/$1",
        "^@message/(.*)$": "<rootDir>/src/message/$1",
        "^@relay/(.*)$": "<rootDir>/src/relay/$1",
        "^@sandbox/(.*)$": "<rootDir>/src/sandbox/$1",
        "^@service/(.*)$": "<rootDir>/src/service/$1",
        "^@shared/(.*)$": "<rootDir>/src/shared/$1",
        "^@storage/(.*)$": "<rootDir>/src/storage/$1",
        "^@transport/(.*)$": "<rootDir>/src/transport/$1",
        "^@main/(.*)$": "<rootDir>/src/main/$1",
        "^@typing/(.*)$": "<rootDir>/src/types/$1",
        "^@tests/(.*)$": "<rootDir>/tests/$1",
    },
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    transform: {
        "^.+\\.template\\.js$": "<rootDir>/tests/raw-module-transformer.cjs",
        "^.+\\.(t|j)sx?$": [
            "@swc/jest",
            {
                sourceMaps: true,
                module: {type: "es6"},
                jsc: {
                    target: "es2020",
                    parser: {syntax: "typescript", tsx: true, decorators: true},
                    transform: {react: {runtime: "automatic"}},
                },
            },
        ],
    },
};

const buildTests = [
    "<rootDir>/src/cli/bundler/plugins/**/*.test.ts",
    "<rootDir>/src/cli/index.test.ts",
    "<rootDir>/src/cli/virtual/virtual.test.ts",
    "<rootDir>/src/cli/plugins/content/RelayDeclaration.test.ts",
    "<rootDir>/src/cli/plugins/locale/declaration/LocaleDeclaration.test.ts",
    "<rootDir>/tests/build-output.test.ts",
    "<rootDir>/tests/integration/build/**/*.test.ts",
];
const domTests = [
    "<rootDir>/tests/browser-harness-dom.test.ts",
    "<rootDir>/src/entry/**/*.test.ts",
    "<rootDir>/src/frame/**/*.test.ts",
    "<rootDir>/src/sandbox/providers/**/*.test.ts",
    "<rootDir>/src/offscreen/OffscreenBridge.test.ts",
    "<rootDir>/src/locale/adapters/**/*.test.ts",
    "<rootDir>/src/message/adapters/**/*.test.ts",
];
const exclude = (patterns: string[]) =>
    patterns.map(pattern => `!${pattern.replace("<rootDir>", import.meta.dirname.replaceAll("\\", "/"))}`);

const config: Config = {
    verbose: false,
    maxWorkers: Math.max(1, Math.min(8, availableParallelism() - 1)),
    coverageProvider: "babel",
    projects: [
        {
            ...shared,
            displayName: "unit-node",
            testMatch: [
                "<rootDir>/src/**/*.test.ts",
                "<rootDir>/tests/*.test.ts",
                "<rootDir>/tests/integration/utils/**/*.test.ts",
                "<rootDir>/tests/integration/browser/utils/**/*.test.ts",
                ...exclude(buildTests),
                ...exclude(domTests),
            ],
        },
        {
            ...shared,
            displayName: "unit-dom",
            testEnvironment: "jsdom",
            testMatch: domTests,
        },
        {...shared, displayName: "build", testMatch: buildTests},
        {...shared, displayName: "types", testMatch: ["<rootDir>/tests/integration/types/**/*.test.ts"]},
        {
            ...shared,
            displayName: "chrome",
            setupFilesAfterEnv: [],
            testMatch: [
                "<rootDir>/tests/integration/browser/**/*.integration.test.ts",
                ...exclude(["<rootDir>/tests/integration/browser/**/*.firefox.integration.test.ts"]),
            ],
        },
        {
            ...shared,
            displayName: "firefox",
            setupFilesAfterEnv: [],
            testMatch: ["<rootDir>/tests/integration/browser/**/*.firefox.integration.test.ts"],
        },
    ],
};

export default config;
