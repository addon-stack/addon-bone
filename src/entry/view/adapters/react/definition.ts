import {isValidElement} from "react";

import {mergeDefinition} from "../../resolvers/definition";

import type {ViewConfig, ViewDefinition} from "@typing/view";

export const resolveDefinition = (module: object): ViewDefinition<ViewConfig> => {
    return mergeDefinition(
        module,
        value =>
            typeof value === "function" ||
            isValidElement(value) ||
            typeof value === "number" ||
            (typeof value === "string" && value.length > 0) ||
            value instanceof Element
    );
};
