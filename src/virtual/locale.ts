import {Language, type LocaleCatalogue} from "@typing/locale";

/** Package fallback; extension builds supply #adnbn/locale as a generated module. */
const catalogue: LocaleCatalogue = {};

export const lang: Language = Language.English;
export const keys: readonly string[] = [];
export const languages: readonly Language[] = [];

export default catalogue;
