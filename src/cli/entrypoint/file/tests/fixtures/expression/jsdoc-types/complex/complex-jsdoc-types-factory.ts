class AdvancedTypes {
    /**
     * @type {(string|number)[]} Array of strings or numbers
     */
    mixedArray: boolean[] = [true, false];

    /**
     * @type {Object<string, number>} Dictionary of counts
     */
    counts: Map<number, string> = new Map();

    /**
     * @template T
     * @param {T} data - Input data
     * @param {function(T): any} transformer - Data transformer
     * @returns {Promise<T>} Processed data
     */
    async process<T>(data: T, transformer: (input: T) => string): Promise<string> {
        // JSDoc generic types should override actual types
        return "processed";
    }

    /**
     * @typedef {Object} SearchOptions
     * @property {string} query - Search query
     * @property {number} [limit=10] - Result limit
     * @property {boolean} [caseSensitive=false] - Case sensitivity
     *
     * @param {SearchOptions} options - Search options
     * @returns {string[]} Search results
     */
    search(options: { query: string; limit?: number; caseSensitive?: boolean; }): number[] {
        // JSDoc custom type definition should be used
        return [1, 2, 3];
    }
}

export default () => new AdvancedTypes();
