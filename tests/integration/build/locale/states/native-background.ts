import {NativeLocale} from "adnbn/locale";

(globalThis as typeof globalThis & {nativeLocale: NativeLocale}).nativeLocale = new NativeLocale();
export default () => {};
