import {expectRelayScripting} from "./scripting-utils";

jest.setTimeout(90_000);
test.each([2, 3] as const)("Firefox MV%s preserves Relay scripting responses and missing-manager errors", version =>
    expectRelayScripting("firefox", version)
);
