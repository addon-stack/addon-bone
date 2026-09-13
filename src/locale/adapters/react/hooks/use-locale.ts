import {useMemo, useSyncExternalStore} from "react";

import ReactLocale from "../ReactLocale";

import {ObservableLocale} from "@locale/providers";

import type {LocaleReactDynamicContract} from "../types";
import type {LocaleRegistry, LocaleStorageDriver} from "@typing/locale";

export const useLocale = (storage?: LocaleStorageDriver | false): LocaleReactDynamicContract => {
    const locale = useMemo(() => ObservableLocale.getInstance(storage), [storage]);
    const snapshot = useSyncExternalStore(locale.subscribe, locale.snapshot);

    return useMemo(
        () =>
            Object.assign(new ReactLocale<LocaleRegistry>(snapshot), {
                change: locale.change,
            }),
        [locale, snapshot]
    );
};
