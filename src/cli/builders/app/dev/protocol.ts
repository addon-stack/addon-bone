import type {OptionalConfig} from "@typing/config";

/** Build settings the dev session passes to its build process; everything else comes from the project config. */
export type BuildRunnerOptions = Pick<
    OptionalConfig,
    "rootDir" | "app" | "browser" | "mode" | "manifestVersion" | "configFile" | "debug"
>;

export enum BuildRunnerFatalCode {
    ConfigFailed = "E_CONFIG_FAILED",
    BuildFatal = "E_BUILD_FATAL",
    CloseFailed = "E_CLOSE_FAILED",
}

export interface BuildRunnerStartRequest {
    type: "start";
    options: BuildRunnerOptions;
    /** Id of the first compilation; a restarted process continues the session's numbering. */
    buildId: number;
}

export interface BuildRunnerCloseRequest {
    type: "close";
    /** Milliseconds the compiler gets to close; a failure or a timeout is reported as `E_CLOSE_FAILED`. */
    timeout: number;
}

export type BuildRunnerRequest = BuildRunnerStartRequest | BuildRunnerCloseRequest;

/**
 * A compilation started. A later `compile` supersedes an attempt that has not reported `done`:
 * Rspack drops the result of a compilation interrupted by a new change.
 */
export interface BuildRunnerCompileEvent {
    type: "compile";
    buildId: number;
    modifiedFiles: string[];
    removedFiles: string[];
}

export interface BuildRunnerDoneEvent {
    type: "done";
    buildId: number;
    ok: boolean;
    errors: string[];
    warnings: string[];
}

/** The process cannot continue and exits with code 1 after sending this event. */
export interface BuildRunnerFatalEvent {
    type: "fatal";
    code: BuildRunnerFatalCode;
    message: string;
}

export type BuildRunnerEvent = BuildRunnerCompileEvent | BuildRunnerDoneEvent | BuildRunnerFatalEvent;
