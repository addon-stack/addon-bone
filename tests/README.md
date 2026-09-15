# Running tests

Run commands from the repository root. Node.js 22 and 24 are supported.

Use the npm test commands below, or `npm run test:run --` to pass arguments directly to Jest. All Jest invocations from these commands, pre-push and inventory checks use `scripts/test-run.mjs`. On macOS arm64 this wrapper launches Jest with `--no-sparkplug`; Linux and Windows keep Node's default JIT settings.

The observed Node 24 crashes contain `Builtins_BaselineOutOfLinePrologue` and `ClearStaleLeftTrimmedPointerVisitor`, matching the Sparkplug report in [nodejs/node#62393](https://github.com/nodejs/node/issues/62393). The earlier `--no-maglev` workaround did not prevent the crash. Successful repetitions measure observed stability; they do not prove a rare native fault impossible. Keep the workaround scoped to the reproduced environment and reassess it when the upstream fix is verified. Jest workers inherit the flag through `execArgv`; CLI fixture child processes and real browsers keep their normal settings. Tests are never automatically retried or skipped to hide a native crash.

| Command                  | Checks                                                                | Builds the package |
| ------------------------ | --------------------------------------------------------------------- | ------------------ |
| `npm run test:unit`      | Node and DOM unit tests                                               | No                 |
| `npm run test:build`     | Compiler plugins, the built CLI and build integrations                | Once               |
| `npm run test:types`     | All fixture applications and declaration consumer tests               | Once               |
| `npm run test:chrome`    | Real Chrome scenarios                                                 | Once               |
| `npm run test:firefox`   | Real Firefox MV2/MV3 scenarios                                        | Once               |
| `npm test`               | Every Jest project, including both browsers                           | Once               |
| `npm run test:pre-push`  | Framework typecheck, all non-browser tests and all fixture typechecks | Once               |
| `npm run test:inventory` | Every test file belongs to exactly one project                        | No                 |

`npm run typecheck` checks framework and test-runner types. `npm run typecheck:integration` builds the package, prepares every fixture application and checks it with its own `tsconfig.json`. Declaration consumers without an application config belong to the Jest `types` project.

## Groups and workers

`jest.config.ts` defines six projects: `unit-node`, `unit-dom`, `build`, `types`, `chrome` and `firefox`. Put DOM tests in the `unit-dom` patterns. Tests that execute the built CLI, consume package declarations or compile imports from the built package belong to `build` or `types`. Keep unit tests runnable with no `dist` directory. Each browser file contains scenarios for one browser only.

After a package build, direct Jest invocations can reuse that build:

```sh
npm run build
npm run test:run -- --selectProjects build types --maxWorkers=4
npm run test:run -- --selectProjects chrome --maxWorkers=4
```

Jest uses up to eight workers, leaving one CPU available on smaller machines. Override the pool with `-- --maxWorkers=N`, or use `-- --runInBand` for a serial diagnostic run. The limit applies to the whole Jest invocation; do not pass both flags together. CI sets explicit smaller pools for compiler and browser jobs.

The trailing `--verbose=false` in `test:unit` terminates Jest's variadic `--selectProjects` option so an appended test filename is treated as a filename, not another project name.

Preparation and fixture typechecks use a bounded queue of up to four processes. Set `ADNBN_TEST_WORKERS` to a positive integer to override it. Each application keeps its own configuration and TypeScript process. Queued builds and typechecks allow up to 120 seconds per command. Builds inside Jest scenarios retain the 30-second limit so a hung CLI does not outlive its enclosing test deadline. A failure is reported after all running work has finished, with the child process diagnostics preserved.

See [integration/README.md](integration/README.md) for browser requirements and fixture layout. Browser tests use separate profiles, ports and application copies. Tests that edit or watch a fixture must retain their own copy and build; generated outputs must not be shared between mutable scenarios.

## Hooks

Pre-commit checks only formatting of the **staged contents**, without changing the index or unstaged work. Format reported files and stage them before retrying. Tests, typechecking and builds run at pre-push and in CI. During development, run `test:unit` or `test:watch` explicitly for earlier feedback. Tests execute the working tree, so CI remains the full validation of the committed revision.

Pre-push runs `test:pre-push`, without browser launches or coverage. It includes both framework and fixture typechecks, compiler and CLI checks, and declaration consumers. Framework typechecking runs alongside the package build; after the build, Jest runs alongside the fixture queue. Jest inherits the terminal and streams its output live; fixture diagnostics remain buffered per command. Each fixture is typechecked as soon as its own build finishes. All tasks finish before failures are reported. Each task has a five-minute deadline; timeout or interruption terminates its complete process tree, including wrappers, Jest workers and child CLI processes. This uses a separate process group on macOS/Linux and `taskkill /T /F` on Windows. Browser checks run in CI and are also available through the explicit commands above.

## CI and coverage

CI runs units, compiler/build/declaration tests, fixture typechecks, Chrome and Firefox in separate jobs. All non-browser groups retain the Linux/Windows × Node 22/24 matrix; both browsers run on Linux for each Node version. Existing `Test and Build` check names now aggregate the entire matrix, not only the OS/Node named in each check; they fail if any required job fails, is cancelled or is skipped. A full workflow contains 22 jobs including matrix computation and aggregation, with at most 16 test jobs ready together before coverage/aggregation dependencies finish.

Babel coverage is collected in the Ubuntu/Node 22 unit and build jobs, then merged once with `scripts/merge-coverage.mjs`. The other matrix cells run the same tests without coverage instrumentation. The published report is `coverage-ubuntu-latest-node22`; platform-specific coverage reports are no longer produced. Moving compiler tests between groups must not remove their source coverage. Keep both `coverage-final.json` inputs when merging locally:

```sh
npm run test:run -- --selectProjects unit-node unit-dom --coverage --coverageDirectory=coverage/unit
npm run build
npm run test:run -- --selectProjects build types --coverage --coverageDirectory=coverage/build --maxWorkers=4
node scripts/merge-coverage.mjs coverage/unit/coverage-final.json coverage/build/coverage-final.json
```

Real CLI child processes and browser execution provide behavioral assertions; their code execution is not automatically instrumented by the parent Jest process.
