import {Command, Mode, PackageName} from "@typing/app";
import {Browser} from "@typing/browser";
import {RelayMethod} from "@typing/relay";
import {ContentScriptAppend, ContentScriptDeclarative, ContentScriptMarker} from "@typing/content";
import {OffscreenReason} from "@typing/offscreen";

import {Injector} from "../types";

export default (): Injector[] => {
    const resolvers: Injector[] = [];

    Object.entries(Browser).forEach(([key, value]) => {
        resolvers.push({
            from: PackageName,
            target: "Browser",
            name: key,
            value,
        });
    });

    Object.entries(Mode).forEach(([key, value]) => {
        resolvers.push({
            from: PackageName,
            target: "Mode",
            name: key,
            value,
        });
    });

    Object.entries(Command).forEach(([key, value]) => {
        resolvers.push({
            from: PackageName,
            target: "Command",
            name: key,
            value,
        });
    });

    Object.entries(ContentScriptDeclarative).forEach(([key, value]) => {
        resolvers.push({
            from: PackageName,
            target: "ContentScriptDeclarative",
            name: key,
            value,
        });
    });

    Object.entries(ContentScriptAppend).forEach(([key, value]) => {
        resolvers.push({
            from: PackageName,
            target: "ContentScriptAppend",
            name: key,
            value,
        });
    });

    Object.entries(ContentScriptMarker).forEach(([key, value]) => {
        resolvers.push({
            from: PackageName,
            target: "ContentScriptMarker",
            name: key,
            value,
        });
    });

    Object.entries(RelayMethod).forEach(([key, value]) => {
        resolvers.push({
            from: PackageName,
            target: "RelayMethod",
            name: key,
            value,
        });
    });

    Object.entries(OffscreenReason).forEach(([key, value]) => {
        resolvers.push({
            from: PackageName,
            target: "OffscreenReason",
            name: key,
            value,
        });
    });

    return resolvers;
};
