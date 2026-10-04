import vm from "vm";
import postcss from "postcss";
import type {Compilation, Stats} from "@rspack/core";

export const getBadgeClass = (compilation: Compilation, entry: string): string => {
    const script = compilation.getAsset(`${entry}.js`)!.source.source().toString();

    return vm.runInNewContext(`${script}\nmodule.exports.default.badge`, {module: {exports: {}}});
};

export const getFont = (compilation: Compilation): string => {
    return compilation
        .getAssets()
        .filter(asset => asset.name.endsWith(".woff2"))
        .map(asset => asset.source.source().toString())
        .join("");
};

export const assertSuccess = (stats: Stats): void => {
    expect(stats.toJson({all: false, errors: true}).errors).toEqual([]);
};

export const hasDeclaration = (css: string, prop: string, value: string): boolean => {
    let found = false;

    postcss.parse(css).walkDecls(prop, declaration => {
        found ||= declaration.value === value;
    });

    return found;
};
