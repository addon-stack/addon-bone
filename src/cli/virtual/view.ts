import type {ViewDefinition, ViewOptions} from "adnbn";
import {resolve} from "adnbn/locale";
import {isViewDefinition, isValidViewDefinitionRenderValue} from "adnbn/entry/view";

import view from "virtual:view-framework";

import * as module from "virtual:view-entrypoint";

try {
    const {default: defaultDefinition, ...otherDefinition} = module;

    let definition: ViewDefinition<ViewOptions> = otherDefinition;

    if (isViewDefinition(defaultDefinition)) {
        definition = {...definition, ...defaultDefinition};
    } else if (isValidViewDefinitionRenderValue(defaultDefinition)) {
        definition = {...definition, render: defaultDefinition};
    }

    const {title, ...options} = definition;

    view({title: title ? resolve(title) : undefined, ...options});
} catch (e) {
    console.error("The view crashed on startup:", e);
}
