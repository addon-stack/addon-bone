import {expectRenderProps} from "./render-props-utils";
jest.setTimeout(90_000);
test("chrome prepares content and Relay before mounting UI with current DOM props", () => expectRenderProps("chrome"));
