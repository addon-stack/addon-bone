type MockLockMode = "exclusive" | "shared";
type LockState = {shared: number; exclusive: boolean};
type MockLockOptions = {mode: MockLockMode};
type MockLockCallback = () => unknown | Promise<unknown>;

type LockTask = {
    mode: MockLockMode;
    callback: MockLockCallback;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
};

/**
 * Models only ProxyOffscreen's Web Locks usage: queued shared/exclusive requests,
 * with release after callback settlement, including rejection. Web Locks are outside the browser test-kit.
 * Does not implement ifAvailable, steal or signal; extend this double if production starts using them.
 */
export default class MockLockManager {
    private readonly queues = new Map<string, LockTask[]>();

    private readonly states = new Map<string, LockState>();

    public request(name: string, options: MockLockOptions, callback: MockLockCallback): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const queue = this.queues.get(name) ?? [];
            queue.push({mode: options.mode, callback, resolve, reject});
            this.queues.set(name, queue);
            this.drain(name);
        });
    }

    public pending(name: string): number {
        return this.queues.get(name)?.length ?? 0;
    }

    private state(name: string): LockState {
        const state = this.states.get(name) ?? {shared: 0, exclusive: false};

        this.states.set(name, state);

        return state;
    }

    private drain(name: string): void {
        const queue = this.queues.get(name);
        const state = this.state(name);

        if (!queue?.length || state.exclusive) {
            return;
        }

        const task = queue[0];

        if (task.mode === "exclusive") {
            if (state.shared > 0) {
                return;
            }

            queue.shift();
            state.exclusive = true;
            this.run(name, task);

            return;
        }

        while (queue[0]?.mode === "shared" && !state.exclusive) {
            const sharedTask = queue.shift()!;

            state.shared++;
            this.run(name, sharedTask);
        }
    }

    private run(name: string, task: LockTask): void {
        Promise.resolve()
            .then(task.callback)
            .then(task.resolve, task.reject)
            .finally(() => {
                const state = this.state(name);

                if (task.mode === "exclusive") {
                    state.exclusive = false;
                } else {
                    state.shared--;
                }

                this.drain(name);
            });
    }
}
