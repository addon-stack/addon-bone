declare module "#adnbn/locale" {
    export const lang: import("adnbn/locale").Language;
    const catalogue: Record<string, Record<string, string>>;
    export const keys: readonly string[];
    export const languages: readonly import("adnbn/locale").Language[];
    export default catalogue;
}
