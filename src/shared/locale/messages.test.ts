import {escapeLocaleMessage} from "./messages";

test.each([
    ["", ""],
    ["Hello {{name}}", "Hello {{name}}"],
    ["${{value}}/week", "$${{value}}/week"],
    ["$ {{value}}/week", "$$ {{value}}/week"],
    ["$1/week", "$$1/week"],
    ["cost $", "cost $$"],
    ["$$", "$$$"],
    ["$$$", "$$$$"],
    ["$USD$ and ${{value}}", "$$USD$$ and $${{value}}"],
])("escapes native message %j as %j", (message, escaped) => {
    expect(escapeLocaleMessage(message)).toBe(escaped);
});
