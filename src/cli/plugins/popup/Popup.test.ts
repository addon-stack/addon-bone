import path from "path";

import Popup from "./Popup";
import type {ViewItems} from "@cli/entrypoint/finder/AbstractViewFinder";
import type {ReadonlyConfig} from "@typing/config";
import type {PopupEntrypointOptions} from "@typing/popup";

const rootDir = path.resolve(__dirname);

class TestPopup extends Popup {
    public constructor(private readonly entries: ViewItems<PopupEntrypointOptions>) {
        super({rootDir, app: "test-app"} as ReadonlyConfig);
    }

    public async views(): Promise<ViewItems<PopupEntrypointOptions>> {
        return this.entries;
    }
}

const entry = (alias: string, options: PopupEntrypointOptions) => ({
    alias,
    filename: `${alias}.html`,
    file: {file: path.join(rootDir, `${alias}.ts`), import: `./${alias}.ts`},
    options,
});

test.each([
    {tooltip: undefined, expected: undefined},
    {tooltip: "Open account", expected: "Open account"},
    {tooltip: "@popup.account", expected: "__MSG_popup_account__"},
    {tooltip: "", expected: ""},
])("prepares tooltip $tooltip independently of the document title", async ({tooltip, expected}) => {
    const popup = new TestPopup(new Map([["account", entry("account", {title: "Account document", tooltip})]]));

    await expect(popup.manifest()).resolves.toEqual({path: "account.html", title: expected});
    await expect(popup.entriesByAlias()).resolves.toEqual({account: {path: "account.html", tooltip}});
    expect((await popup.view().html())[0].title).toBe("Account document");
});

test("keeps unapplied popup metadata but excludes its tooltip from the initial manifest", async () => {
    const popup = new TestPopup(
        new Map([
            ["alternate", entry("alternate", {apply: false, tooltip: "Alternate"})],
            ["account", entry("account", {tooltip: "Account"})],
        ])
    );

    await expect(popup.manifest()).resolves.toEqual({path: "account.html", title: "Account"});
    await expect(popup.entriesByAlias()).resolves.toEqual({
        alternate: {path: "alternate.html", tooltip: "Alternate"},
        account: {path: "account.html", tooltip: "Account"},
    });
    expect((await popup.view().html())[0].title).toBe("Test App");
});
