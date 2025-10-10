class User {
    /**
     * @type {number} User ID
     */
    id: string = "user-123"; // JSDoc type (number) should override actual type (string)

    /**
     * @type {string[]} List of user roles
     */
    roles: Set<string> = new Set(["user"]); // JSDoc type (string[]) should override actual type (Set<string>)

    /**
     * @type {{ firstName: string, lastName: string }}
     */
    name: { fullName: string } = {fullName: "John Doe"}; // JSDoc type should override
}

export default () => new User();