export const PackageName = "adnbn";
export const SystemDir = ".adnbn";

export enum Mode {
    None = "none",
    Development = "development",
    Production = "production",
}

export enum Command {
    Build = "build",
    Watch = "watch",
    Dev = "dev",
}

export enum Workspace {
    Single = "single",
    Multi = "multi",
}

/**
 * "Watching" commands keep a compiler alive and react to file changes: the legacy
 * `watch` (write-to-disk only) and the modern `dev` (RspackDevServer + HMR). Build is one-shot.
 * Use this for every gate that should apply to both incremental modes.
 */
export const isWatchCommand = (command: Command): boolean => command === Command.Watch || command === Command.Dev;
