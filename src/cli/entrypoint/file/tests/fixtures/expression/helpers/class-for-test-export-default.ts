export default class {

    public name: string;
    public age: number = 25;

    private _id: number;
    private _secretKey: string = "secret123";

    protected role: string;
    protected isActive: boolean = true;

    static count: number = 0;
    static readonly VERSION: string = "1.0.0";

    constructor(name: string, id: number, role: string = "user") {
        this.name = name;
        this._id = id;
        this.role = role;
    }

    public getInfo(): string {
        return `Name: ${this.name}, Age: ${this.age}, Role: ${this.role}`;
    }

    public updateAge(newAge: number): void {
        this.age = newAge;
        console.log(`Age updated to ${newAge}`);
    }

    private generateToken(): string {
        return `${this._id}_${this._secretKey}_${Date.now()}`;
    }

    private validateUser(): boolean {
        return this._id > 0 && this.name.length > 2;
    }

    protected logActivity(action: string): void {
        console.log(`User ${this.name} (ID: ${this._id}) performed action: ${action}`);
    }

    protected setRole(newRole: string): void {
        this.role = newRole;
    }

    get id(): number {
        return this._id;
    }

    set secretKey(value: string) {
        if (value.length >= 8) {
            this._secretKey = value;
        } else {
            throw new Error("Secret key must be at least 8 characters long");
        }
    }
}