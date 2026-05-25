import type {Config} from "jest";

const config: Config = {
    verbose: true,
    testEnvironment: "jsdom",
    setupFiles: ["<rootDir>/tests/jest.setup.ts"],
    moduleNameMapper: {
        "^@cli/(.*)$": "<rootDir>/src/cli/$1",
        "^@entry/(.*)$": "<rootDir>/src/entry/$1",
        "^@frame/(.*)$": "<rootDir>/src/frame/$1",
        "^@locale/(.*)$": "<rootDir>/src/locale/$1",
        "^@offscreen/(.*)$": "<rootDir>/src/offscreen/$1",
        "^@message/(.*)$": "<rootDir>/src/message/$1",
        "^@sandbox/(.*)$": "<rootDir>/src/sandbox/$1",
        "^@service/(.*)$": "<rootDir>/src/service/$1",
        "^@storage/(.*)$": "<rootDir>/src/storage/$1",
        "^@transport/(.*)$": "<rootDir>/src/transport/$1",
        "^@main/(.*)$": "<rootDir>/src/main/$1",
        "^@typing/(.*)$": "<rootDir>/src/types/$1",
    },
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    transform: {
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
    testMatch: ["**/*.test.ts"],
};

export default config;
