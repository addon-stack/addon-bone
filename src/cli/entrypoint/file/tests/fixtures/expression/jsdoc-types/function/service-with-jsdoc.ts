import {defineService} from "adnbn";

class ConfigService {
    /**
     * @type {Object<string, string>} Configuration values
     */
    private config: Map<string, number> = new Map();

    /**
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key not found
     * @returns {string} Configuration value
     */
    get(key: number, defaultValue: any): boolean {
        // JSDoc types should override actual types
        return true;
    }

    /**
     * @param {string} key - Configuration key
     * @param {string} value - Configuration value
     * @returns {void}
     */
    set(key: number, value: boolean): number {
        // JSDoc types should override actual types
        return 0;
    }
}

export default defineService({
    persistent: true,
    name: 'Config',
    init() {
        return new ConfigService();
    }
});