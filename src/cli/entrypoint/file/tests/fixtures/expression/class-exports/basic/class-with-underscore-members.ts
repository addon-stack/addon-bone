class ServiceWithPrivateMembers {
    // Public properties that should be included
    public publicProp: string = "value";
    
    // Private properties with underscore prefix that should be excluded
    public _prefixedPublicProp: number = 42;
    
    // Truly private properties (these would be excluded anyway)
    private normalPrivateProp: boolean = true;
    
    // Private properties with underscore prefix (double exclusion)
    private _privateWithPrefix: string = "hidden";
    
    // Protected properties with underscore prefix
    protected _protectedWithPrefix: string[] = ["a", "b"];
    
    // Constructor with public and private parameters
    constructor(
        public visibleParam: string,
        public _hiddenParam: number,
        private secretParam: boolean
    ) {}
    
    // Public methods that should be included
    public publicMethod(): void {
        this._privateHelper();
    }
    
    // Public methods with underscore prefix that should be excluded
    public _prefixedPublicMethod(): string {
        return "This should not be exposed";
    }
    
    // Private methods (these would be excluded anyway)
    private normalPrivateMethod(): void {
        console.log("Private");
    }
    
    // Private methods with underscore prefix (double exclusion)
    private _privateHelper(): void {
        console.log("Helper");
    }
    
    // Protected methods with underscore prefix
    protected _protectedMethod(): boolean {
        return true;
    }
}

export default () => {
    return new ServiceWithPrivateMembers('first', 2, false);
}