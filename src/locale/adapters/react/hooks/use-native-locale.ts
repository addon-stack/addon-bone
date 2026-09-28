import {useMemo} from "react";

import ReactLocale from "../ReactLocale";

import {NativeLocale} from "@locale/providers";

import type {LocaleReactContract} from "../types";

import type {LocaleRegistry} from "@typing/locale";

/** Uses browser-selected translations with React substitutions. */
export const useNativeLocale = (): LocaleReactContract => {
    return useMemo(() => new ReactLocale<LocaleRegistry>(NativeLocale.getInstance()), []);
};
