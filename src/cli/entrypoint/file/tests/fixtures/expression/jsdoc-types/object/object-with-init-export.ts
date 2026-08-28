/**
 * @typedef {Object} ConfigOptions
 * @property {number} timeout - Timeout in milliseconds
 * @property {string[]} domains - Allowed domains
 * @property {boolean} debug - Enable debug mode
 */
export const init = () => {
    return {
        /**
         * @type {ConfigOptions}
         */
        config: {
            timeoutStr: "5000ms", // Should be interpreted as number
            domains: new Set(["example.com"]), // Should be interpreted as string[]
            debug: 1 // Should be interpreted as boolean
        },

        /**
         * @param {string} key - Configuration key
         * @returns {any} Configuration value
         */
        getConfig(key: number): boolean {
            return true; // JSDoc types should override
        }
    };
};