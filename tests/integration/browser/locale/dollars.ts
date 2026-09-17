import path from "path";
import {createIntegrationFixture} from "../../utils/fixture";
import {waitFor} from "../utils/browser";
import {startBrowserSession} from "../utils/session";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";

export const verifyLocaleDollars = async (browser: "chrome" | "firefox"): Promise<void> => {
    const fixture = await createIntegrationFixture(
        ADNBN_TEST_ROOT,
        path.join(ADNBN_TEST_ROOT, "tests/integration/build/locale/dollars-fixture")
    );
    let session: Awaited<ReturnType<typeof startBrowserSession>> | undefined;
    let site: IntegrationSite | undefined;

    try {
        const directory = await fixture.build({browser});
        site = await startIntegrationSite(path.join(fixture.directory, "site"));
        session = await startBrowserSession(browser, ADNBN_TEST_ROOT, directory);
        await session.navigate(site.origin);

        const result = await waitFor(
            () => session!.evaluate('document.getElementById("locale-dollar-results")?.textContent'),
            15_000,
            "native and dynamic dollar translations"
        );
        const expected = {
            price: "$1.15/week",
            spaced: "$ 1.15/week",
            number: "$1/week",
            trailing: "cost $",
            single: "$",
            double: "$$",
            triple: "$$$",
            named: "$USD$",
            substitution: "$1.15/week",
            plural: "$1.15 for 2 weeks",
        };

        expect(JSON.parse(result)).toMatchObject({
            native: expected,
            dynamic: expected,
        });
        expect(session.errors).toEqual([]);
    } finally {
        try {
            await session?.close();
        } finally {
            await site?.close();
            await fixture.dispose();
        }
    }
};
