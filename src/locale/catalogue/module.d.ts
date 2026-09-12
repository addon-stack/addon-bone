declare module "#adnbn/locale" {
    const catalogue: import("@typing/locale").LocaleCatalogue;
    export const lang: import("@typing/locale").Language;
    export const keys: readonly string[];
    export const languages: readonly import("@typing/locale").Language[];
    export default catalogue;
}
