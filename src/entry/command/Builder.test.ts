import Builder from "./Builder";

import {defineExecuteActionCommand} from "@main/command";
import {getBrowserTest} from "@tests/browser-harness/session";

describe.each([
    {manifestVersion: 2, action: "browserAction"},
    {manifestVersion: 3, action: "action"},
] as const)("MV$manifestVersion command handler", ({manifestVersion, action}) => {
    it("connects the internal action command to the button and disconnects it on destroy", async () => {
        const {harness} = getBrowserTest();

        harness.runtime.setManifest({name: "Command Addon", version: "1.0.0", manifest_version: manifestVersion});

        const execute = jest.fn();
        const definition = defineExecuteActionCommand({defaultKey: "Ctrl+Shift+Y", execute});
        const builder = new Builder(definition);
        const tab = {id: 1} as chrome.tabs.Tab;

        expect(definition.name).toBe("_execute_action");

        try {
            await builder.build();
            await harness.configurable.active.commands.onCommand.emit("_execute_action", tab);

            expect(execute).not.toHaveBeenCalled();

            await harness.configurable.active[action].onClicked.emit(tab);

            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith(tab, {name: "_execute_action", defaultKey: "Ctrl+Shift+Y"});

            await builder.destroy();
            await harness.configurable.active[action].onClicked.emit(tab);

            expect(execute).toHaveBeenCalledTimes(1);
        } finally {
            await builder.destroy();
        }
    });
});
