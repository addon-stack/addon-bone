// @ts-ignore
import type {ExtraType} from "somelib";

class ExternalServiceWithUndefined {
    public extraProperty: ExtraType | undefined;
    public someExtraProperty?: ExtraType;

    constructor() {
        this.extraProperty = undefined;
    }

    public getExtraProperty(): ExtraType | undefined {
        return this.extraProperty;
    }

    public setExtraProperty(extra: ExtraType | undefined): void {
        this.extraProperty = extra;
    }
}

export default () => {
    return new ExternalServiceWithUndefined();
};