export interface ProbeState {
    async: string;
    asyncCss: string;
    asyncJs: string;
    asset: string;
    backgroundImage: string;
    color: string;
    count: number;
    currentGetter: string;
    frame: string;
    fullGetter: string;
    extensionResources: string;
    initialCss: string;
    initialJs: string;
    publicPath: string;
    runs: string;
    world: string;
}

export interface DocumentState {
    isolated?: ProbeState;
    isolatedGlobal: boolean;
    isolatedSecondaryRuns?: string;
    main?: ProbeState;
    mainGlobal: boolean;
    mainSecondaryRuns?: string;
}

export const DocumentStateExpression = `
    (doc => {
        const probe = world => {
            const selector = '[data-testid="content-' + world.toLowerCase() + '"]';
            const root = doc.querySelector(selector);

            if (!root) return undefined;

            const style = doc.defaultView.getComputedStyle(root);

            return {
                async: root.dataset.async,
                asyncCss: root.dataset.asyncCss,
                asyncJs: root.dataset.asyncJs,
                asset: root.dataset.asset,
                backgroundImage: style.backgroundImage,
                color: style.color,
                count: doc.querySelectorAll(selector).length,
                currentGetter: root.dataset.currentGetter,
                frame: root.dataset.frame,
                fullGetter: root.dataset.fullGetter,
                extensionResources: root.dataset.extensionResources,
                initialCss: root.dataset.initialCss,
                initialJs: root.dataset.initialJs,
                publicPath: root.dataset.publicPath,
                runs: root.dataset.runs,
                world: root.dataset.world,
            };
        };

        return {
            isolated: probe('ISOLATED'),
            main: probe('MAIN'),
            isolatedGlobal: doc.defaultView.__adnbnIsolatedWorldVisibleToPage === true,
            mainGlobal: doc.defaultView.__adnbnMainWorldVisibleToPage === true,
            isolatedSecondaryRuns: doc.documentElement.dataset.adnbnIsolatedSecondaryRuns,
            mainSecondaryRuns: doc.documentElement.dataset.adnbnMainSecondaryRuns,
        };
    })`;

export const expectLoadedProbe = (
    probe: ProbeState | undefined,
    world: "ISOLATED" | "MAIN",
    frame: string,
    expectedAsyncChunks: boolean,
    protocol = "chrome-extension:"
): void => {
    if (probe?.async !== "loaded") {
        throw new Error(`The ${world} ${frame} probe did not load: ${JSON.stringify(probe)}`);
    }

    expect(probe).toMatchObject({
        async: "loaded",
        currentGetter: "ok",
        frame,
        fullGetter: "blocked",
        runs: "1",
        world,
    });
    expect(probe?.count).toBe(1);
    expect(Number(probe?.initialJs)).toBeGreaterThan(0);
    expect(Number(probe?.initialCss)).toBeGreaterThan(0);
    if (expectedAsyncChunks) {
        expect(Number(probe?.asyncJs)).toBeGreaterThan(0);
        expect(Number(probe?.asyncCss)).toBeGreaterThan(0);
        expect(probe?.publicPath).toBe("extension");
    } else {
        expect(Number(probe?.asyncJs)).toBe(0);
        expect(Number(probe?.asyncCss)).toBe(0);
        expect(probe?.publicPath).toMatch(/^unavailable:/);
    }
    expect(probe?.asset).toMatch(/assets\/probe-[a-f0-9]{4}\.svg$/);
    expect(probe?.color).toBe("rgb(17, 34, 51)");
    expect(probe?.backgroundImage).toMatch(
        /^url\("(?:chrome|moz)-extension:\/\/[^/]+\/assets\/probe-[a-f0-9]{4}\.svg"\)$/
    );
    expect(probe?.backgroundImage).toContain(protocol);
};
