class BaseService {
    /**
     * @type {string} Service name
     */
    name: string = "base";

    /**
     * @param {number} id - Resource ID
     * @returns {Promise<Object>} Resource data
     */
    async getResource(id: string): Promise<string> {
        return "resource";
    }
}

class UserService extends BaseService {
    /**
     * @type {Map<string, Object>} User cache
     */
    cache: Record<string, string> = {}; // JSDoc type should override

    /**
     * @override
     * @param {string} userId - User ID
     * @returns {Promise<{ name: string, email: string }>} User data
     */
    // @ts-ignore
    async getResource(userId: number): Promise<any> {
        // JSDoc types should override inherited and actual types
        return {name: "John", email: "john@example.com"};
    }
}

export default () => new UserService();