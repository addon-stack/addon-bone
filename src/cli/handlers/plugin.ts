import _ from "lodash";

import {Plugin, PluginHandler, PluginHandlerKeys, PluginHandlerOptions, PluginNameHandlerResult} from "@typing/plugin";

const resolvePluginHandler = async <O extends object, T>(
    handler: PluginHandler<O, T> | undefined,
    options: O
): Promise<T | undefined> => {
    if (_.isFunction(handler)) {
        const result = handler(options);

        if (result instanceof Promise) {
            return await result;
        }

        return result;
    }

    return handler;
};

export const processPluginHandler = async function* <K extends PluginHandlerKeys>(
    plugins: Plugin[],
    key: K,
    options: PluginHandlerOptions<K> | {(): PluginHandlerOptions<K>}
): AsyncGenerator<PluginNameHandlerResult<K>, void, void> {
    for await (const plugin of plugins) {
        const handler = plugin[key] as PluginHandler<PluginHandlerOptions<K>> | undefined;

        const opt = _.isFunction(options) ? options() : options;

        const result = await resolvePluginHandler(handler, opt);

        if (result !== undefined) {
            yield {name: plugin.name, result};
        }
    }
};
