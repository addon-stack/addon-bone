import type {Config, ConfigDefinition, ReadonlyConfig, UserConfig} from "@typing/config";

export type {Config, ReadonlyConfig, ConfigDefinition, UserConfig};

export const defineConfig = (config: ConfigDefinition): ConfigDefinition => {
    return config;
};
