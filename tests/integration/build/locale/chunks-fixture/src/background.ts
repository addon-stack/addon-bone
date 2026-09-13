import catalogue from "#adnbn/locale";

(globalThis as typeof globalThis & {catalogue: typeof catalogue}).catalogue = catalogue;

export default () => {};
