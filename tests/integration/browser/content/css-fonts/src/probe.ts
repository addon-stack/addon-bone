// Browser resource-loading check only: no production renderer or JS font registration.
const extensionUrl = (file: string) => chrome.runtime.getURL(file);
const measure = (element: Element): number => {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().width;
};

const mount = async (mode: "shadow" | "iframe", index: number): Promise<void> => {
    const host = document.createElement("section");
    host.dataset.probe = `${mode}-${index}`;
    host.dataset.mode = mode;
    host.dataset.ready = "loading";
    document.querySelector("#probes")!.append(host);
    try {
        let doc = document;
        let styles: ShadowRoot | HTMLHeadElement;
        let target: ShadowRoot | HTMLElement;
        if (mode === "shadow") {
            styles = target = host.attachShadow({mode: "open"});
        } else {
            const frame = document.createElement("iframe");
            await new Promise<void>((resolve, reject) => {
                const onLoad = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                const timeout = setTimeout(() => {
                    frame.removeEventListener("load", onLoad);
                    reject(new Error("Blank iframe did not load within 5 seconds"));
                }, 5000);
                frame.addEventListener("load", onLoad, {once: true});
                host.append(frame);
            });
            doc = frame.contentDocument!;
            styles = doc.head;
            target = doc.body;
        }
        const marker = doc.createElement("div");
        marker.className = "scope-marker";
        target.append(marker);
        const samples = Object.fromEntries(
            ["manifest", "imported", "local", "fallback"].map(name => {
                const sample = doc.createElement("span");
                sample.className = `sample ${name}`;
                sample.textContent = "AAAA";
                marker.append(sample);
                return [name, sample];
            })
        );
        await new Promise<void>((resolve, reject) => {
            const link = doc.createElement("link");
            link.rel = "stylesheet";
            link.href = extensionUrl("styles/isolated.css");
            const timeout = setTimeout(() => reject(new Error(`CSS timeout: ${link.href}`)), 5000);
            const finish = (error?: Error) => {
                clearTimeout(timeout);
                link.onload = link.onerror = null;
                if (error) reject(error);
                else resolve();
            };
            link.onload = () => finish();
            link.onerror = () => finish(new Error(`CSS error: ${link.href}`));
            styles.append(link);
        });
        const deadline = performance.now() + 5000;
        while (performance.now() < deadline) {
            const widths = Object.fromEntries(
                Object.entries(samples).map(([name, element]) => [name, measure(element)])
            );
            const fonts = Array.from(doc.fonts, font => ({family: font.family, status: font.status}));
            const color = doc.defaultView!.getComputedStyle(marker).color;
            host.dataset.measurements = JSON.stringify({widths, fonts, color});
            const applied = (name: string) => Math.abs(widths[name] - 320) < 0.1;
            if (
                color === "rgb(17, 85, 153)" &&
                (mode === "shadow" ? applied("manifest") && applied("imported") : applied("local"))
            ) {
                host.dataset.ready = "true";
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        throw new Error("CSS font width did not reach 320px without JS font registration");
    } catch (error) {
        host.dataset.error = String(error);
        host.dataset.ready = "error";
    }
};

void (async () => {
    for (const mode of ["shadow", "iframe"] as const) {
        await mount(mode, 1);
        // A root created after the first font load must work without re-registering the font.
        await mount(mode, 2);
    }
})();

export {};
