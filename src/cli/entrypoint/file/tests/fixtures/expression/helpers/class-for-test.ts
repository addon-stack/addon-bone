type Config = Record<string, any>

export type UserMap = Record<string, { name: string }>;

export type ServiceInfo = { name: string, version: number }

export class BaseService {

    public name: string = "BaseService";
    public version: number = 1.0;

    protected apiUrl: string = "https://api.example.com";
    protected timeout: number = 5000;

    private _isInitialized: boolean = false;
    private _config: Config = {};


    constructor(config?: Config) {
        if (config) {
            this._config = config;
        }
    }

    public getUsersMap(): UserMap {
        return {
            "user1": {name: "Jack"},
            "user2": {name: "Kate"},
            "user3": {name: "Bob"}
        };
    }

    public getServiceInfo(): ServiceInfo {
        return {
            name: this.name,
            version: this.version
        };
    }

    public async fetchData<T>(endpoint: string): Promise<T> {
        this.logRequest(endpoint);

        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({} as T);
            }, this.timeout);
        });
    }

    protected validateConfig(): boolean {
        return Object.keys(this._config).length > 0;
    }

    protected getDefaultUsers(): Record<string, { name: string }> {
        return {
            "default": {name: "Guest"},
        };
    }

    private logRequest(endpoint: string): void {
        console.log(`Request to ${this.apiUrl}/${endpoint}`);
    }

    private getConfigValue<T>(key: string, defaultValue: T): T {
        return (this._config[key] as T) || defaultValue;
    }

    public static createInstance(config?: Record<string, any>): BaseService {
        return new BaseService(config);
    }

    get isInitialized(): boolean {
        return this._isInitialized;
    }

    set isInitialized(value: boolean) {
        this._isInitialized = value;
    }
}