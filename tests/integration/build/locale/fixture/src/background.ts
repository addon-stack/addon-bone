import catalogue, {keys, lang, languages} from "#adnbn/locale";

(globalThis as typeof globalThis & {readLocaleCatalogue: () => typeof catalogue}).readLocaleCatalogue = () => catalogue;
(globalThis as typeof globalThis & {readLocaleKeys: () => typeof keys}).readLocaleKeys = () => keys;
(globalThis as typeof globalThis & {readLocaleLanguage: () => typeof lang}).readLocaleLanguage = () => lang;
(globalThis as typeof globalThis & {readLocaleLanguages: () => typeof languages}).readLocaleLanguages = () => languages;

export default () => {};
