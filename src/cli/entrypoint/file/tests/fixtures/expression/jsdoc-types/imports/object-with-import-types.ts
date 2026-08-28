export default () => {
    return {
        /**
         * @type {import('external-lib').Settings} Application settings
         */
        settings: {},
        
        /**
         * Configures the application
         * @param {import('external-lib').ConfigParams} config - Configuration parameters
         * @returns {import('external-lib').ConfigResult} Configuration result
         */
        configure(config: any): any {
            // JSDoc types with imports should be preserved as-is
            return {};
        },
        
        /**
         * Validates input data
         * @param {import('external-lib').ValidationInput<T>} input - Input to validate
         * @template T
         * @returns {import('external-lib').ValidationResult<T>} Validation result
         */
        validate<T>(input: any): any {
            // JSDoc types with imports and generics should be preserved
            return { valid: true };
        }
    };
};