export interface Whitelist {
    [domain: string]: number;
}

class WhitelistService {
    private whitelist: Whitelist = {};

    public get(): Whitelist {
        return this.whitelist;
    }
}

export default () => new WhitelistService();