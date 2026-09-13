import {useEffect} from "react";
import type {LocaleReactContract} from "../types";

/**
 * Applies language attributes from either locale hook to an element after render.
 * An omitted target or undefined selects html; null disables application.
 * Cleanup restores each previous attribute only while its applied value is unchanged.
 */
export const useLocaleAttributes = (
    locale: Pick<LocaleReactContract, "lang" | "dir">,
    target: string | Element | null = "html"
): void => {
    const {lang, dir} = locale;

    useEffect(() => {
        const element = typeof target === "string" ? document.querySelector(target) : target;

        if (!element) return;

        const attributes = Object.entries({lang, dir}).map(([name, value]) => ({
            name,
            value,
            previous: element.getAttribute(name),
        }));

        for (const {name, value} of attributes) {
            element.setAttribute(name, value);
        }

        return () => {
            for (const {name, value, previous} of attributes) {
                if (element.getAttribute(name) !== value) continue;

                if (previous === null) {
                    element.removeAttribute(name);
                } else {
                    element.setAttribute(name, previous);
                }
            }
        };
    }, [target, lang, dir]);
};
