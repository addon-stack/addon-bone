export default () => ({
    publicProp: "value",
    publicMethod(): string {
        return this._privateHelper();
    },
    _privateProp: "hidden",
    _privateMethod() {
        return "This should not be exposed";
    },
    _privateHelper() {
        return "Helper method";
    }
});