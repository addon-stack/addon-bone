import {SandboxGlobalAccess} from "@typing/sandbox";
import RegisterSandbox from "./RegisterSandbox";

test("reports the sandbox context error before a missing registration", () => {
    globalThis[SandboxGlobalAccess] = false;

    const registration = new RegisterSandbox("parser", () => ({}));

    expect(() => registration.get()).toThrow('Sandbox "parser" can be getting only from sandbox context.');
});
