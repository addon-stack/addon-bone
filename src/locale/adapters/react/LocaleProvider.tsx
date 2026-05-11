import React, {PropsWithChildren, useCallback, useEffect, useMemo, useState} from "react";

import {LocaleContext, LocaleContract} from "./context";

import {getLocaleDir, isLocaleRtl} from "@locale/utils";

import {DynamicLocale} from "@locale/providers";

import {Language} from "@typing/locale";

export interface LocaleProviderProps {
    storage?: string | false;
    container?: string | Element | false;
}

const LocaleProvider = ({children, storage, container = "html"}: PropsWithChildren<LocaleProviderProps>) => {
    const locale = useMemo(() => new DynamicLocale(storage), []);

    const [lang, setLang] = useState<Language>(locale.lang());

    const t: LocaleContract["t"] = useCallback((key, ...args): string => {
        return locale.trans(key, ...args);
    }, []);

    const choice: LocaleContract["choice"] = useCallback((key, count, ...args): string => {
        return locale.choice(key, count, ...args);
    }, []);

    const change: LocaleContract["change"] = useCallback((lang): void => {
        locale
            .change(lang)
            .catch(err => console.error(`[LocaleProvider] Cannot find locale file for "${lang}" language`, err));
    }, []);

    useEffect(() => {
        if (container === false) {
            return;
        }

        const element = typeof container === "string" ? document.querySelector(container) : container;

        if (element) {
            element.setAttribute("lang", lang);
            element.setAttribute("dir", getLocaleDir(lang));

            return () => {
                element.removeAttribute("lang");
                element.removeAttribute("dir");
            };
        }
    }, [lang, container]);

    useEffect(() => {
        locale.sync().then(lang => setLang(lang));
    }, []);

    useEffect(() => {
        return locale.watch(lang => setLang(lang));
    }, []);

    return (
        <LocaleContext.Provider
            value={{
                t,
                choice,
                change,
                lang,
                dir: getLocaleDir(lang),
                isRtl: isLocaleRtl(lang),
            }}
        >
            {children}
        </LocaleContext.Provider>
    );
};

export default LocaleProvider;
