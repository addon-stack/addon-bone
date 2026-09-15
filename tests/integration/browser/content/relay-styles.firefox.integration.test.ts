import {expectRelayStyles} from "./relay-styles-utils";

jest.setTimeout(90_000);
test.each([2, 3] as const)("firefox MV%s routes Relay CSS and calls its UI through real RPC", version =>
    expectRelayStyles("firefox", version)
);
