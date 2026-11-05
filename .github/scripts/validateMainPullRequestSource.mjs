import {readFileSync} from "node:fs";

try {
    const event = JSON.parse(readFileSync(0, "utf8"));
    const pullRequest = event?.pull_request;
    const headBranch = pullRequest?.head?.ref;
    const allowedBranch =
        headBranch === "develop" || (typeof headBranch === "string" && /^hotfix\/[^/]+$/.test(headBranch));
    const headRepositoryId = pullRequest?.head?.repo?.id;
    const baseRepositoryId = pullRequest?.base?.repo?.id;
    const allowed =
        pullRequest?.base?.ref === "main" &&
        allowedBranch &&
        Number.isSafeInteger(headRepositoryId) &&
        headRepositoryId > 0 &&
        Number.isSafeInteger(baseRepositoryId) &&
        baseRepositoryId > 0 &&
        headRepositoryId === baseRepositoryId;

    if (allowed) {
        console.log(`Source policy passed: ${headBranch} -> main in the same repository.`);
    } else {
        console.error("Only pull requests from this repository's develop or hotfix/* branches may target main.");
        process.exitCode = 1;
    }
} catch {
    console.error("Unable to read valid pull request event JSON.");
    process.exitCode = 1;
}
