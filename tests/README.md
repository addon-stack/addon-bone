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
| `npm run test:inventory` | Test ownership, migration exceptions and framework reset inventory    | No                 |

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

## Browser harness migration

`tests/jest.setup.ts` selects one setup per file before importing the test module. The harness is the default for
unit, build and types projects. Only the 11 files in `browser-harness/migration.json` use `jest-legacy.setup.ts`.
Remove exceptions as their tests migrate; new tests use the harness without registration or per-file `jest.unmock`.
Real Chrome/Firefox integrations load neither setup.

The same inventory records local `jest.mock`, `jest.doMock`, `jest.setMock` and `jest.unstable_mockModule` calls for
`@addon-core/*` and `@main/env`. Eight additional files still use these local mocks, making 19 files to review in total.
Passing under harness setup does not prove that a locally mocked dependency was exercised. For each remaining mock,
decide whether to replace it with Browser/Storage controls or retain an explicit dependency boundary.
`npm run test:inventory` rejects missing files, duplicate legacy entries and unrecorded or removed module mocks.
Update the inventory alongside each migration so stale exceptions cannot remain unnoticed.

The harness setup creates a fresh `BrowserTestSession` before every test. Use `getBrowserTest()` from
`@tests/browser-harness/session` inside tests and hooks, not at module scope. The `@tests/*` alias maps to the root `tests/`
directory in TypeScript and Jest. Browser and Storage imports are real unless the file declares a recorded local mock;
build-time virtual modules can still supply explicit test fixtures. `NativeLocale.test.ts` demonstrates API controls
and call history instead of function mocks.

```ts
import {getBrowserTest} from "@tests/browser-harness/session";

const session = getBrowserTest();
session.harness.configurable.chrome.i18n.getMessage.setResult("en");
session.addCleanup(unsubscribe);
```

The default messaging context is an extension page with the Chrome profile. The session sets `BROWSER=chrome`,
`APP=test` and `MANIFEST_VERSION` from its manifest. Constructor options `profile`, `app` and `manifest` select alternatives.
Teardown restores the previous environment values, including previously absent variables. Framework environment
getters read these values when called.

Create other contexts through `session.harness.contexts.create()` and install them with `session.useContext(context)`.
Use `session.useContext(context, "firefox")` to switch both browser globals and `BROWSER`; configure the reported browser
version through `harness.runtime.getBrowserInfo.setResult()`. The returned restore function and nested installations
follow reverse order; teardown restores remaining installations automatically. Use context-bound facades from
`harness.messaging.forContext()` for the other endpoints of a conversation. Global context changes are not async-local:
do not use `test.concurrent` or assume that global Browser wrappers remember the context of an earlier callback.
`environment: "preserve"` retains jsdom's window, document, location and navigator; it does not simulate a background DOM.

`session.createScriptRuntime({clock: true})` binds a persistent guest runtime to the session's document registry and
registers disposal. Create the target tabs/documents first. Advance the guest clock explicitly; host timers and
consumer deadlines remain separate. Runtime and tab message delivery continue under Jest host fake timers without
advancing them. `harness.delays.downloadValidation` uses a host timer: advance it explicitly in tests using fake timers.
Shared teardown restores real host timers even when cleanup fails. Guest-clock checks use real timers inside the guest;
Jest fake timers affect only the host.

Register consumer subscriptions, observers and other resources with `session.addCleanup()`. Async cleanup is awaited
in reverse order, and a failure does not prevent remaining cleanup, harness reset or global/environment restoration.
Teardown clears Message/Relay/Offscreen/Service/Sandbox managers and Relay permission registration. It resets
NativeLocale, Message, ObservableLocale (default, memory and driver caches), and OffscreenBridge singleton references,
and disposes cached SandboxMessage hosts. Clearing a cache does not dispose every previously returned provider or DOM
bridge: subscriptions, pending DOM work and manually created instances still need explicit cleanup callbacks.
Do not reset the harness underneath a live session; that invalidates contexts and detaches the scripting executor.
Jest mock history and spies are reset centrally.

`framework-state-inventory.json` records source classes with static fields or `getInstance`, including retained constants
and the CLI TypeScript resolver cache. `test:inventory` compares the source fields with that inventory, checks registration
of the 11 runtime reset owners, and checks all six exported `*GlobalKey` declarations against the reset implementation.
New fields or owners require a reviewed reset policy. After runtime cleanup, any remaining own global property starting
with `adnbn` fails teardown rather than being silently deleted. This source inventory detects missing policies; it does
not prove that every reset implementation is correct, so session lifecycle tests verify the actual behavior too.

### Remaining test-kit boundaries

- `hasListeners` is not modeled. Check subscriptions through the context event's `listenerCount()`.
- VM scenarios require uninstrumented injected code. During Relay migration, isolate the injected function and exclude
  only that module from Babel coverage; retain coverage for its host adapter and real-browser checks for the guest code.
- The session does not emulate Web Locks, DOM inside the guest, or extension HTML execution. Keep explicit external
  adapters where needed and real-browser checks for DOM, execution worlds, browser lifecycle and vendor behavior.
- Consult the kit's `RAW_CAPABILITY_COVERAGE` before using another browser API. Extend the kit when a required capability
  is missing; an existing modeled capability needs no new global mock.

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
