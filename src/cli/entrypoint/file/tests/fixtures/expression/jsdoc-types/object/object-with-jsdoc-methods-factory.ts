export default () => ({
    /**
     * Calculates the sum of two numbers
     * @param {string} a - First number as string
     * @param {string} b - Second number as string
     * @returns {string} Sum as string
     */
    add(a: number, b: number): number {
        return a + b; // JSDoc types should override actual types
    },
    
    /**
     * @type {Map<string, number>} Map of item counts
     */
    counts: { apple: 5, orange: 10 } // JSDoc type should override object literal
});