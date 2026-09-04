export const ShadowStylesRuntimeProperty = "__adnbnShadowStyles";

export interface ShadowStylesRuntime {
    add(root: ShadowRoot, target: Element, initialStyles: string[]): void;
    delete(root: ShadowRoot): void;
    load(url: string): Promise<void>;
}

interface WebpackRuntime {
    (moduleId: string | number): unknown;
    __adnbnShadowStyles?: ShadowStylesRuntime;
}

declare const __webpack_require__: WebpackRuntime;

export const getShadowStylesRuntime = (): ShadowStylesRuntime => {
    const runtime =
        typeof __webpack_require__ === "function" ? __webpack_require__[ShadowStylesRuntimeProperty] : undefined;

    if (!runtime) {
        throw new Error("Shadow styles runtime is unavailable in this content entrypoint");
    }

    return runtime;
};
