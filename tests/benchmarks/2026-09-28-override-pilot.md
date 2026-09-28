# Override in-process pilot — 2026-09-28

This is a historical report for the superseded in-process backend. The current helper and benchmark runner
use [file-owned child sessions](2026-09-28-override-session.md). The project-hashed virtual-directory workaround
described here has been removed; the independent absolute-root fixes remain.

## Decision

Keep CLI builds as the default. The opt-in in-process path is faster at both worker limits, but repeated
builds retain memory after forced GC. Do not extend it to other integration groups yet. No global
`workerIdleMemoryLimit` or worker-count changes are part of this pilot. The separate absolute-root fix is
required by the helper (`67fd974f`) and is included in the final measurement series below.

The prerequisite is `005e8457`: awaited, environment-restoring `buildApp`, with package tests under
`tests/integration/build/cli`. The experimental helper is selected by `ADNBN_OVERRIDE_BUILD_MODE=in-process`.

## Identical work

All 33 unique full scenario names match in every comparison run. The same temporary application copies and
assertions are used. Thirty ordinary page builds switch backend; all three competing-entrypoint cases remain
on CLI. Both backends use production mode and the same browsers/manifest versions. CLI runs from the fixture;
in-process builds receive its absolute root while keeping the worker's working directory unchanged.
There is no shared compilation cache or concurrent test within a file.

Jest substitutes `createRequire` and `process.env`. The adapter uses Node's public `getBuiltinModule` API to
load the built package in the same worker, temporarily sharing the harness environment and restoring it in
`finally`. The diagnostics assert environment values, object identity and unchanged cwd after every test.
Production `buildApp` is unchanged by the pilot.

## Time

Apple M3 Max, 16 logical CPUs, macOS arm64, Node 24.5.0. One package build before the series; no production
changes during measurements. Each worker limit has a warm-up for each backend followed by three alternating
measured pairs. Time includes the complete Jest command and reporting, excludes the package build. Every
run uses `--expose-gc`, the existing macOS `--no-sparkplug`, `--logHeapUsage`, JSON reporting and the same
per-test diagnostic hook (including GC). These are instrumented comparisons, not uninstrumented CI timings.
With four files, the eight-worker setting can use at most four workers.

| Worker limit | CLI median (range)    | In-process median (range) | Ratio |
| ------------ | --------------------- | ------------------------- | ----- |
| 2            | 13.36 s (13.30–13.37) | 3.63 s (2.66–3.68)        | 3.68× |
| 8            | 7.27 s (7.12–7.27)    | 2.81 s (2.56–3.62)        | 2.59× |

The ranges are reported rather than promising the best run; three measured pairs per worker limit are a small sample.
These are local measurements, not evidence of Linux/Windows CI performance.

## Memory and handles

The sequential four-file run reports CLI worker heap of 35/46/47/47 MiB, versus approximately
118/131/139/133 MiB with the pilot. Worker RSS reaches about 180 MiB for CLI and 517 MiB for in-process.
CLI child-process memory is **not** included in those worker numbers; they are not total machine-memory comparisons.

A separate diagnostic repeats the existing thirty page cases three times in one file and one worker. All
90 builds pass, but live heap and RSS keep growing despite an explicit GC after each test:

| Builds completed | Heap after GC | Worker RSS |
| ---------------- | ------------- | ---------- |
| 1                | 98.1 MiB      | 371.1 MiB  |
| 30               | 155.3 MiB     | 529.2 MiB  |
| 60               | 213.5 MiB     | 675.8 MiB  |
| 90               | 271.4 MiB     | 831.4 MiB  |

The earlier series also retained memory after GC (271.3 MiB heap / 830.7 MiB RSS at build 90). A standalone
Rspack reproduction now isolates compiler retention without the framework, config loader or Jest; see below.
This does not exclude additional retention in the complete framework build.

Three additional runs per worker limit with `--workerIdleMemoryLimit=128MB` passed. However, this four-file
workload did not demonstrate mid-run worker replacement: recorded PID counts remain two/four. At two workers
one worker can finish all three in-process files before crossing the threshold at the end. The setting therefore
does not establish that accumulation is controlled, and it cannot recycle a worker midway through the 90-build
file. No memory limit was added to the regular Jest configuration.

Separate `--detectOpenHandles` runs pass all 33 cases for both backends and report zero open handles.
Successful compiler shutdown and a clean handle report do not prove absence of retained JavaScript/native memory.

Every series run leaves zero `fixture-*` copies in `.cache/integration`. Before measurement, 57 pre-existing
copies dated September 14–24 were preserved in `.cache/integration-before-pilot-2026-09-28`, not deleted.

## Other findings and scope

- The separate root-directory regression covers real entrypoints through CLI and `buildApp`, with two
  projects built A → B → A from an unrelated cwd. The fix preserves absolute import roots, resolves source
  aliases and compiler context from `rootDir`, and provides project package lookup for virtual modules.
  Absolute filenames use portable virtual names without embedded Windows drive roots. Parser-relative
  imports and its existing project `tsconfig` injection remain unchanged. The helper no longer changes cwd.
- The first series without cwd switching exposed shared temporary-module directories: closing one worker's
  compiler deleted another project's entry modules. That series failed and is excluded from the final timings.
  Entrypoint and offscreen temporary directories are now keyed by project root. An IPC-controlled regression
  reproduced deletion before the fix and verifies that a pending compiler can run after the other closes.
  Node 22 also exposed the external plugin's check-then-create race on `cwd/node_modules`; the adapter now
  prepares directories recursively. The root regression covers Chrome and Firefox, including Offscreen's
  generated background module resolved through its direct virtual alias.
- Moving internal CLI config fixtures under integrations exposed overly broad application discovery.
  Preparation/typecheck now requires both `adnbn.config.ts` and `package.json`; two tests cover exclusion of
  internal configs and inclusion of the three real override applications.
- All 33 pilot cases and three root-directory regressions also passed with local Node 22.18.0.
  This does not replace the Linux/Windows CI matrix.

## Standalone Rspack retention

`rspack-retention.mjs` uses only Node and the installed `@rspack/core`. Each variant runs in a fresh process,
creates twelve compilers, awaits `run` and `close`, and counts `WeakRef` survivors after GC across event-loop
turns. Temporary sources are generated under the OS temporary directory and removed in `finally`.
It does not retain `Stats`, inspect private bindings or load framework code.

On Rspack 1.7.11, Node 24.5.0, macOS arm64:

| Configuration                                  | Compilers remaining / 12 |
| ---------------------------------------------- | ------------------------ |
| Baseline, RegExp rule test, function include   | 0                        |
| Function rule test, use, resourceQuery         | 12                       |
| RegExp cache-group test                        | 0                        |
| Function cache-group test                      | 12                       |
| HTML file template or string templateContent   | 0                        |
| Function templateContent or templateParameters | 12                       |

The framework uses a functional asset rule and graph-dependent cache-group tests. Its `View.html()` passes
`template`, not `templateContent`. Replacing the asset rule alone would not remove the other triggers.
The installed Rspack adapter wraps functional resource conditions and passes them to the native binding;
the exact native ownership/release defect still needs upstream confirmation. Stable `external` and
`arrayBuffers` do not by themselves attribute all RSS growth to a native leak.

```bash
node tests/benchmarks/rspack-retention.mjs
node --expose-gc tests/benchmarks/rspack-retention.mjs rule-test-function
```

[Raw retention results](2026-09-28-rspack-retention.json) record versions, counts and memory measurements.
The script is a diagnostic, not a GC-sensitive test in the regular suite; rerun it when evaluating a Rspack update.

## Reproduction

Run exclusively, without another integration run or a concurrent package build:

```bash
npm run build
node tests/benchmarks/override-pilot.mjs
```

The runner writes logs, per-test worker metrics and Jest JSON under `.cache/benchmarks/override-pilot`.
It checks scenario identity and fixture cleanup. The 90-build diagnostic temporarily creates a test beside
existing override tests, reusing their matrices, and removes it in `finally`. `--stress-only` repeats that probe;
`--limits-only` appends memory-limit comparisons to an existing results file. Existing unrelated fixture copies
must be accounted for separately before a run: the runner never deletes them to satisfy its cleanup assertion.

[Raw results](2026-09-28-override-pilot.json) include all timings, full scenario names, worker PID/heap/RSS samples,
Jest heap output, handle counts and the 90-build diagnostic.

## Validation

- Final `npm run check` with the default CLI backend: 183 suites / 2002 tests, package build, framework typecheck,
  and fixture builds/typechecks passed.
- Chrome + Firefox on eight workers: 30 suites / 41 tests passed; one Chrome startup timed out at 30 seconds
  with ECONNREFUSED before the scenario ran. The timeout was not increased. The isolated retry passed
  in 4.3 s; all 31 suites / 42 tests passed on two workers; the final repeat took 63.2 s. This does not prove absence of rare
  startup failures under heavier concurrency.
- Inventory: 214 files, each in exactly one project; zero local module mocks.
- Unit coverage: 139 suites / 1685 tests passed with localhost access.
- CI for these unpushed changes remains unverified; no push or workflow dispatch was performed.
