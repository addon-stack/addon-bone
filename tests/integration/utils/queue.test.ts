import {runQueue} from "./queue";

test("bounds concurrency and finishes every fixture even when one fails", async () => {
    const releases: (() => void)[] = [];
    const started: number[] = [];
    const finished: number[] = [];
    const error = new Error("Invalid fixture");
    const running = runQueue([0, 1, 2, 3], 2, async item => {
        started.push(item);
        await new Promise<void>(resolve => releases.push(resolve));
        finished.push(item);
        if (item === 0) throw error;
    });
    const outcome = running.catch(error => error as AggregateError);
    expect(started).toEqual([0, 1]);
    releases.shift()!();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(started).toEqual([0, 1, 2]);
    releases.shift()!();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(started).toEqual([0, 1, 2, 3]);
    expect(finished).toEqual([0, 1]);
    releases.splice(0).forEach(release => release());
    const result = await outcome;
    expect(result).toBeInstanceOf(AggregateError);
    expect((result as AggregateError).errors).toEqual([error]);
    expect(finished).toEqual([0, 1, 2, 3]);
});
