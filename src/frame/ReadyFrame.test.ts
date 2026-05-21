import ReadyFrame, {ReadyFrameParams} from "./ReadyFrame";

const wait = () => new Promise(resolve => setTimeout(resolve));

const ready = (frame: HTMLIFrameElement) =>
    window.dispatchEvent(new MessageEvent("message", {source: frame.contentWindow, data: {type: "ready"}}));

const make = (frames: ReadyFrame, key = "a", overrides: Partial<ReadyFrameParams> = {}) =>
    frames.make({
        key,
        url: `${key}.html`,
        isReady: (event, frame) =>
            event.source === frame.contentWindow && (event.data as {type?: string})?.type === "ready",
        ...overrides,
    });

describe("ReadyFrame", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        jest.useRealTimers();
    });

    test("creates one iframe for concurrent calls and resolves both on ready", async () => {
        const frames = new ReadyFrame();
        const first = make(frames);
        const second = make(frames);
        const frame = document.querySelector("iframe") as HTMLIFrameElement;

        expect(document.querySelectorAll("iframe")).toHaveLength(1);

        ready(frame);

        await expect(first).resolves.toBe(frame);
        await expect(second).resolves.toBe(frame);
    });

    test("resolves only when the matcher accepts, not on load alone", async () => {
        const frames = new ReadyFrame();
        const creation = make(frames);
        const frame = document.querySelector("iframe") as HTMLIFrameElement;

        let resolved = false;
        creation.then(() => (resolved = true));

        frame.dispatchEvent(new Event("load"));
        window.dispatchEvent(new MessageEvent("message", {source: frame.contentWindow, data: {type: "other"}}));
        await wait();

        expect(resolved).toBe(false);

        ready(frame);

        await expect(creation).resolves.toBe(frame);
    });

    test("reuses a ready frame for the same key", async () => {
        const frames = new ReadyFrame();
        const first = make(frames);
        const frame = document.querySelector("iframe") as HTMLIFrameElement;

        ready(frame);
        await first;

        await expect(make(frames)).resolves.toBe(frame);
        expect(document.querySelectorAll("iframe")).toHaveLength(1);
    });

    test("tracks independent frames per key", async () => {
        const frames = new ReadyFrame();
        const a = make(frames, "a");
        const b = make(frames, "b");
        const [frameA, frameB] = Array.from(document.querySelectorAll("iframe"));

        expect(document.querySelectorAll("iframe")).toHaveLength(2);

        ready(frameA as HTMLIFrameElement);
        ready(frameB as HTMLIFrameElement);

        await expect(Promise.all([a, b])).resolves.toEqual([frameA, frameB]);
    });

    test("rejects with the load-error message and removes the frame", async () => {
        const frames = new ReadyFrame();
        const creation = make(frames, "a", {loadErrorMessage: () => "boom load"});
        const frame = document.querySelector("iframe") as HTMLIFrameElement;

        frame.dispatchEvent(new Event("error"));

        await expect(creation).rejects.toThrow("boom load");
        expect(document.querySelector("iframe")).toBeNull();
    });

    test("rejects with the timeout message (carrying the loaded flag) and removes the frame", async () => {
        jest.useFakeTimers();

        const frames = new ReadyFrame();
        const creation = make(frames, "a", {
            readyTimeout: 50,
            readyTimeoutMessage: loaded => `timeout loaded=${loaded}`,
        });
        const assertion = expect(creation).rejects.toThrow("timeout loaded=true");
        const frame = document.querySelector("iframe") as HTMLIFrameElement;

        frame.dispatchEvent(new Event("load"));
        jest.advanceTimersByTime(50);

        await assertion;
        expect(document.querySelector("iframe")).toBeNull();
    });

    test("remove() drops the tracked frame", async () => {
        const frames = new ReadyFrame();
        const creation = make(frames);
        const frame = document.querySelector("iframe") as HTMLIFrameElement;

        ready(frame);
        await creation;

        frames.remove("a");

        expect(document.querySelector("iframe")).toBeNull();
    });

    test("recreates the frame when it was removed from the DOM externally", async () => {
        const frames = new ReadyFrame();
        const first = make(frames);
        const frame = document.querySelector("iframe") as HTMLIFrameElement;

        ready(frame);
        await first;

        frame.remove();

        const second = make(frames);
        const next = document.querySelector("iframe") as HTMLIFrameElement;

        expect(next).not.toBeNull();
        expect(next).not.toBe(frame);

        ready(next);

        await expect(second).resolves.toBe(next);
    });
});
