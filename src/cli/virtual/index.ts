import background from "./background.ts?raw";
import command from "./command.ts?raw";
import content from "./content.ts?raw";
import offscreen from "./offscreen.ts?raw";
import offscreenBackground from "./offscreen.background.ts?raw";
import relay from "./relay.ts?raw";
import sandbox from "./sandbox.ts?raw";
import service from "./service.ts?raw";
import view from "./view.ts?raw";

import {inferEntrypointFramework} from "@cli/entrypoint";

import {PackageName} from "@typing/app";
import {EntrypointFile} from "@typing/entrypoint";

const templates = {background, command, content, offscreen, relay, sandbox, service, view};

const getEntryFramework = (file: EntrypointFile, entry: "content" | "view"): string => {
    return `${PackageName}/entry/${entry}/${inferEntrypointFramework(file)}`;
};

const getVirtualModule = (file: EntrypointFile, template: keyof typeof templates): string => {
    return templates[template].replace(`virtual:${template}-entrypoint`, file.import);
};

export const virtualBackgroundModule = (file: EntrypointFile): string => {
    return getVirtualModule(file, "background");
};

export const virtualCommandModule = (file: EntrypointFile, name: string): string => {
    return getVirtualModule(file, "command").replace("virtual:command-name", name);
};

export const virtualContentScriptModule = (file: EntrypointFile, navigation = false): string => {
    // prettier-ignore
    return getVirtualModule(file, "content")
        .replace(`virtual:content-builder`, navigation ? `${PackageName}/entry/content` : getEntryFramework(file, "content"));
};

export const virtualOffscreenModule = (file: EntrypointFile, name: string): string => {
    return getVirtualModule(file, "offscreen")
        .replace("virtual:offscreen-name", name)
        .replace(`virtual:view-builder`, getEntryFramework(file, "view"));
};

export const virtualOffscreenBackgroundModule = (): string => {
    return offscreenBackground;
};

export const virtualRelayModule = (file: EntrypointFile, name: string, navigation = false): string => {
    return getVirtualModule(file, "relay")
        .replace("virtual:relay-name", name)
        .replace(
            `virtual:content-builder`,
            navigation ? `${PackageName}/entry/content` : getEntryFramework(file, "content")
        );
};

export const virtualSandboxModule = (file: EntrypointFile, name: string): string => {
    return getVirtualModule(file, "sandbox")
        .replace("virtual:sandbox-name", name)
        .replace(`virtual:view-builder`, getEntryFramework(file, "view"));
};

export const virtualServiceModule = (file: EntrypointFile, name: string): string => {
    return getVirtualModule(file, "service").replace("virtual:service-name", name);
};

export const virtualViewModule = (file: EntrypointFile): string => {
    // prettier-ignore
    return getVirtualModule(file, "view")
        .replace(`virtual:view-builder`, getEntryFramework(file, "view"));
};
