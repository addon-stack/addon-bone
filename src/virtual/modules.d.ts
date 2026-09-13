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

declare module "#adnbn/relay" {
    export const options: typeof import("./relay").options;
}
