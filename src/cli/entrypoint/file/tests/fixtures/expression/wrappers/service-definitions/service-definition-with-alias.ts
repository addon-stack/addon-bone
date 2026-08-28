import { defineService as svc } from "adnbn";

class Math {
    public add(a: number, b: number): number { return a + b; }
    public subtract(a: number, b: number): number { return a - b; }
    public multiply(a: number, b: number): number { return a * b; }
}

// alias import of wrapper function
export default svc({
    persistent: true,
    name: 'Math',
    init() {
        return new Math();
    }
});
