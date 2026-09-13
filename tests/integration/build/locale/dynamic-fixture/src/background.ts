import {DynamicLocale} from "adnbn/locale";

const locale = new DynamicLocale();
(globalThis as typeof globalThis & {dynamicLocale: DynamicLocale}).dynamicLocale = locale;
export default async () => {
    await locale.sync();
};
