import {useMemo} from "react";
import NativeLocale from "@locale/providers/NativeLocale";
import ReactLocale from "../ReactLocale";
import type {LocaleRegistry} from "@typing/locale";
import type {LocaleReactContract} from "../types";

/** Uses browser-selected translations with React substitutions. */
export const useNativeLocale = (): LocaleReactContract => {
    return useMemo(() => new ReactLocale<LocaleRegistry>(NativeLocale.getInstance()), []);
};
