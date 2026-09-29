# Override build-session pilot — 2026-09-28

## Decision and scope

Keep CLI as the default and expose the new pilot through `ADNBN_OVERRIDE_BUILD_MODE=session`.
The previous Jest-worker in-process backend is removed. Production `rootDir` fixes remain, but the
project-hashed virtual-directory helper and its entrypoint/offscreen connections are removed.
No native virtual-module migration, new production concurrency contract, or global worker tuning is included.

Each of the three page files owns one child process with a private fixed cwd and ten sequential builds.
The child imports the built package once and receives absolute fixture roots. The parent never changes its
cwd, native environment, or module loader. All three competing-entrypoint scenarios still invoke the CLI.
Each request has a parent-owned deadline; a timeout kills the child and rejects only after `close`, without
retrying. Errors preserve their message, cause chain and compiler diagnostics. Normal disposal sends a close
request and waits for process/stdio closure before removing the session directory. IPC disconnect exits the
child even if a build is pending. A hard owner crash can leave files for later cleanup, but not a cooperative
build process waiting indefinitely for its owner.

The shared-cwd conflict in the external virtual-module plugin remains a documented limitation. Reproduce it
with `node tests/benchmarks/virtual-module-conflict.mjs` after building the package. The diagnostic controls
both compilers with IPC and expects the second to fail after the first removes its shared virtual files.

## Measurements

Apple M3 Max, 16 logical CPUs, macOS arm64, Node 24.5.0, Rspack 1.7.11. Fresh package build before the series;
no other build or test run during timing. Each worker limit has one warm-up per backend and three alternating
measured pairs. Both backends use the same GC-enabled instrumentation and macOS `--no-sparkplug` setting.
Times cover the full Jest process, including session startup/disposal, and exclude building the framework.
These are instrumented local observations, not CI performance evidence.

| Worker limit | CLI median (range)    | Session median (range) | Ratio |
| ------------ | --------------------- | ---------------------- | ----- |
| 2            | 12.94 s (12.86–13.10) | 3.53 s (3.51–3.65)     | 3.67× |
| 8            | 6.87 s (6.82–7.14)    | 2.35 s (2.33–2.37)     | 2.92× |

All 18 runs pass the same 33 unique full scenario names. Those names also match the raw results of the previous
pilot. Each session run records exactly three child PIDs and ten responses per child. With three session-backed
files the eight-worker setting starts at most three session children; it does not model eight concurrent sessions.

## Child memory and cleanup

The figures below are measured in the build child after each build, with forced GC, not in the Jest worker.
Across the measured series, after build ten:

- RSS: 341.36–394.23 MiB per child.
- JavaScript heap: 75.72–79.70 MiB per child.
- Highest reported process peak RSS across the measured samples: 394.36 MiB.

The process exits at the file boundary, so retained compiler memory does not follow a Jest worker into its next
file. This bounds the number of builds per child, not peak bytes, and does not repair Rspack retention. More
simultaneous files would increase aggregate memory. CLI child memory is not instrumented, so these values must
not be read as a total-memory comparison between backends.

Every run verifies zero leftover fixture/session directories and that all reported session PIDs have exited.
Separate `--detectOpenHandles` runs for both backends pass all 33 cases and report zero open handles. Directories
left by deliberately interrupted development diagnostics were removed before the benchmark; they are not part
of the measured cleanup results.

## Validation

- Full `npm run check`: package build, framework typecheck, fixture builds/typechecks, 184 suites / 2008 tests.
  This preceded one additional pending-disposal regression; the final session file passes all eight tests.
- Final Node 24.5.0 session lifecycle tests: 8/8.
- Local Node 22.18.0: all 33 override cases, two absolute-root cases and eight session lifecycle cases pass (43/43).
- Chrome/Firefox: 31 suites / 42 tests pass on two workers.
- Inventory: 215 files, each in exactly one project; no local module mocks.
- The lifecycle cases cover fixed-cwd A → B → A, overlap rejection, config causes, compiler diagnostics,
  recovery, timeout, unexpected exit, disposal while pending, and IPC disconnect both idle and during a build.
- Linux/Windows CI remains unverified; local Node 22/24 checks do not replace that matrix.

## Reproduction

```bash
npm run build
node tests/benchmarks/override-pilot.mjs
```

The runner writes logs, parent/child JSONL and Jest output under `.cache/benchmarks/override-session`. It refuses
to start with unaccounted fixture/session directories. Parent instrumentation also checks that environment values,
object identity and cwd are unchanged after each test. No global memory limit or worker-count change is applied.

[Raw results](2026-09-28-override-session.json) include scenario names and all child samples.
The [previous report](2026-09-28-override-pilot.md) records the superseded backend, not current behavior.
