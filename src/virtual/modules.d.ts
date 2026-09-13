declare module "#adnbn/locale" {
    const catalogue: typeof import("./locale").default;
    export const lang: typeof import("./locale").lang;
    export const keys: typeof import("./locale").keys;
    export const languages: typeof import("./locale").languages;
    export default catalogue;
}

declare module "#adnbn/page" {
    export const aliases: typeof import("./page").aliases;
}

declare module "#adnbn/entrypoint" {
    export const readAssets: typeof import("./entrypoint").readAssets;
    export const readAssetsMap: typeof import("./entrypoint").readAssetsMap;
}

declare module "#adnbn/relay" {
    export const options: typeof import("./relay").options;
}

declare module "#adnbn/popup" {
    export const aliases: typeof import("./popup").aliases;
}

declare module "#adnbn/sidebar" {
    export const aliases: typeof import("./sidebar").aliases;
}

declare module "#adnbn/offscreen" {
    export const parameters: typeof import("./offscreen").parameters;
}

declare module "#adnbn/sandbox" {
    export const parameters: typeof import("./sandbox").parameters;
}

declare module "#adnbn/icon" {
    export const groups: typeof import("./icon").groups;
}
