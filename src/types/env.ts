export const EnvReservedKeys = new Set<string>(["APP", "BROWSER", "MODE", "MANIFEST_VERSION"]);

export type EnvFilterFunction = (value: string) => boolean;

export type EnvFilterVariant = string | EnvFilterFunction;

export type EnvFilterOptions = {
    filter: EnvFilterVariant;
};
