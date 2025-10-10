import {onActionClicked, onSpecificCommand} from "@addon-core/browser";

import Builder from "@entry/core/Builder";

import {isValidCommandExecuteFunction, isValidCommandName} from "./resolvers";

import {
    CommandBuilder,
    CommandExecuteActionName,
    CommandResolvedDefinition,
    CommandUnresolvedDefinition,
} from "@typing/command";

type Tab = chrome.tabs.Tab;

export default class extends Builder implements CommandBuilder {
    protected readonly definition: CommandResolvedDefinition;

    protected unsubscribe?: () => void;

    public constructor(definition: CommandUnresolvedDefinition) {
        super();

        const {name, execute} = definition;

        if (!isValidCommandExecuteFunction(execute)) {
            throw new Error("The command entrypoint must export a execute function");
        }

        if (!isValidCommandName(name)) {
            throw new Error("The command entrypoint must export a name string");
        }

        this.definition = {
            ...definition,
            name,
            execute,
        };
    }

    public async build(): Promise<void> {
        await this.destroy();

        const {name} = this.definition;

        if (name == CommandExecuteActionName) {
            this.unsubscribe = onActionClicked(tab => {
                this.handle(tab);
            });

            return;
        }

        this.unsubscribe = onSpecificCommand(name, tab => {
            this.handle(tab);
        });
    }

    public async destroy(): Promise<void> {
        this.unsubscribe?.();
    }

    protected handle(tab?: Tab): void {
        const {name, execute, ...options} = this.definition;

        try {
            Promise.resolve(execute(tab, {name, ...options})).catch(e => {
                console.error("The command execute async function crashed:", e);
            });
        } catch (e) {
            console.error("The command execute function crashed:", e);
        }
    }
}
