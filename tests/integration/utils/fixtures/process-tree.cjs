const {spawn} = require("node:child_process");
const {writeFileSync} = require("node:fs");

const depth = Number(process.argv[2]);
if (depth > 0) {
    const child = spawn(process.execPath, [__filename, String(depth - 1)], {
        stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    child.once("message", descendants => {
        const pids = [process.pid, ...descendants];
        if (process.send) process.send(pids);
        else writeFileSync(process.argv[3], JSON.stringify(pids));
    });
} else {
    process.send([process.pid]);
}

setInterval(() => {}, 1000);
