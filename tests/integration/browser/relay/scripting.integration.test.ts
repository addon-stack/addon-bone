import {expectRelayScripting} from "./scripting-utils";

jest.setTimeout(90_000);
test("Chrome MV3 preserves Relay scripting responses and missing-manager errors", () =>
    expectRelayScripting("chrome", 3));
