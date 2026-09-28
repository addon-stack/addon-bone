const fs = require("node:fs");
const assert = require("node:assert/strict");
const nodeProcess = process.getBuiltinModule("process");
const environment = nodeProcess.env;
const values = {...environment};
const testValues = {...process.env};
const cwd = nodeProcess.cwd();

afterEach(() => {
    // Registered after the harness cleanup: both environment layers must be back to their initial state.
    assert.equal(nodeProcess.env, environment);
    assert.deepEqual({...nodeProcess.env}, values);
    assert.deepEqual({...process.env}, testValues);
    assert.equal(nodeProcess.cwd(), cwd);

    if (global.gc) {
        global.gc();
    }

    fs.appendFileSync(
        process.env.ADNBN_PILOT_METRICS,
        JSON.stringify({
            pid: process.pid,
            worker: process.env.JEST_WORKER_ID,
            file: expect.getState().testPath,
            test: expect.getState().currentTestName,
            gc: typeof global.gc === "function",
            ...process.memoryUsage(),
            maxRssKiB: process.resourceUsage().maxRSS,
        }) + "\n"
    );
});
