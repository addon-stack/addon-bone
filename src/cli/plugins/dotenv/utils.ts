import _ from "lodash";
import {EnvFilterFunction, EnvFilterOptions, EnvFilterVariant, EnvReservedKeys} from "@typing/env";

export type EnvOption = EnvFilterVariant | Partial<EnvFilterOptions>;

export const resolveEnvOptions = (option?: EnvOption): {filter: EnvFilterFunction} => {
    let userFilter: EnvFilterVariant | undefined;

    if (_.isString(option)) {
        userFilter = option;
    } else if (_.isFunction(option)) {
        userFilter = option;
    } else if (option && _.isObject(option)) {
        const {filter: f} = option as Partial<EnvFilterOptions>;

        userFilter = f;
    }

    const filter = (key: string): boolean => {
        if (EnvReservedKeys.has(key)) {
            return true;
        }

        if (_.isFunction(userFilter)) {
            return userFilter(key);
        }

        if (_.isString(userFilter)) {
            return key.startsWith(userFilter.trim());
        }

        return true;
    };

    return {filter};
};

export const filterEnvVars = <T extends Record<string, any>>(vars: T, filter: EnvFilterFunction): Partial<T> => {
    return Object.fromEntries(Object.entries(vars).filter(([key]) => filter(key))) as Partial<T>;
};
