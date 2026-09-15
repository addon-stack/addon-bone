import {expectRelayStyles} from "./relay-styles-utils";

jest.setTimeout(90_000);
test("chrome MV3 routes Relay CSS and calls its UI through real RPC", () => expectRelayStyles("chrome", 3));
