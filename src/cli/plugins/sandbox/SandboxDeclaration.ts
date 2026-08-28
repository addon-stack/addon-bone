import {TransportDeclaration, TransportDeclarationLayer} from "../typescript";

import {ReadonlyConfig} from "@typing/config";

export default class extends TransportDeclaration {
    constructor(config: ReadonlyConfig) {
        super(config, TransportDeclarationLayer.Sandbox);
    }
}
