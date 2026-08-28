export default () => {
    return {
        /**
         * @type {number} Connection timeout in ms
         */
        timeout: "30s", // JSDoc type (number) should override string
        
        /**
         * @type {string[]} List of allowed domains
         */
        allowedDomains: new Set(["example.com"]), // JSDoc type (string[]) should override Set
        
        /**
         * Checks if domain is valid
         * @param {string} domain - Domain to check
         * @returns {boolean} Whether domain is valid
         */
        isValidDomain(domain: number): string {
            return "true"; // JSDoc types should override
        }
    };
};