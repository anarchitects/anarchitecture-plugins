# PR #570 CI stall investigation

## Evidence (2026-10-08)

- [GitHub run #346](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/37767018583)
  started distributed execution at 10:59:29 UTC. Its last reported completions
  were at 11:03:22. At 12:03:29 the coordinator exited with
  `No new completed tasks after 3600 seconds.` GitHub records a failure;
  [Nx Cloud](https://cloud.nx.app/cipes/6ac7776e2b581de46f07969f) records cancellation.
  `fix-ci` reported no failed tasks. These are distinct lifecycle observations.
- The new `nx-library.spec.ts` **passed** in that run: 19.281 seconds for the
  test, 20.764 seconds for Jest. It was one of the 21 completed tasks.
- Comparing the 25-task graph with Cloud's completed-task list leaves
  `nx-nest:test`, `cjs-jest.spec.ts`, `cjs-lint.spec.ts`, and the waiting aggregate
  `nx-nest-e2e:e2e-ci`. The first three have only `nx-nest:build` as a prerequisite;
  that build completed. The aggregate correctly depends on all 18 E2E atoms.
- [Run #345](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/37764375261)
  completed all 24 tasks on three agents in about three minutes. Its Nest unit
  test task was a remote cache hit, so this run does not establish that the unit
  suite executed successfully on those agents.
- Agent logs supplied by the maintainer narrow this further: agent 2 started
  those three executable tasks together. CJS Jest printed a passing summary
  (91.476s), as did CJS lint (120.311s). Neither result reached the coordinator's
  completed-task list. The unit suite only reported application (43.808s), class
  (71.22s), and package (126.129s) suite passes; there was no final unit summary.
  Agent 0 ran the new library scenario successfully; agent 1 completed its work
  and exited. Another log for agent 2 shows a new process exiting with no tasks.
  Without timestamps/restart metadata this is not proof of an OOM restart.
- The failure boundary is agent 2's unit execution/result reporting, not the
  new E2E or unresolved build dependencies. The logs have no explicit OOM or
  subprocess failure. Resource exhaustion, a stuck unit process, and an agent
  reporting problem remain hypotheses. “Not executable” after cancellation is
  not evidence of a dependency cycle.

**The original root cause is not established.** The new E2E is not a demonstrated
hang. No asynchronous conversion, agent sizing change, dependency rewrite,
cache bypass in CI, or Nx Cloud migration is justified by the available evidence.

## Bounded local reproduction

Node 24.21.0, Yarn 4.17.0, Nx 23.2.0 on macOS, followed by a Linux container
using the official Node 24.21.0 image with a two-CPU quota, 4GB RAM, and no swap.
The container is ARM64; Cloud agents are AMD64, so this is not an exact replica.
Each reproduction had an external process-group deadline, independently of
Jest. Temporary instrumentation recorded command start/end timestamps, duration,
status, signal, and error code without logging environment values.

| Reproduction (all with `NX_NO_CLOUD=true NX_DAEMON=false`)                 | Result                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| New atom, `--skipNxCache --outputStyle=static`                             | Passed; 14.6s including build and Nx startup; Jest 10.9s |
| New atom plus CJS Jest and CJS lint, `run-many --parallel=3 --skipNxCache` | All passed; 40.6s total                                  |
| `nx-nest:test --skipNxCache` (overlapped the three consumers)              | 362 tests / 27 suites passed; 68.2s total                |
| Nest and E2E `build,lint,typecheck --skipNxCache`                          | Passed; existing lint warnings only                      |

All packed E2E scenarios also passed: 25 tests / 18 suites in 195.9s, using the
existing two-worker configuration. On Linux, the unit suite and CJS Jest/lint
passed together at Nx parallelism 3 in 4m30s (267.47s Jest unit time). The CPU
quota exposed `availableParallelism() === 2`, so Jest selected one worker.
Repeating with three Jest workers also passed in about three minutes. Neither
Linux run recorded a cgroup OOM kill. Inspection found normal synchronous unit
subprocess work. These runs did not reproduce the original hour-long stall.

The isolated new consumer install took 2.3s; its subsequent Yarn/Nx commands
took 0.4–2.0s each. Expected collision commands returned status 1 and satisfied
the existing assertions. There were no command timeouts or termination signals.
The real-install helper disables dependency lifecycle scripts, strips inherited
`NX_*` variables, disables Cloud/daemon/plugin isolation, and assigns consumer-local
Nx cache/data directories. Every scenario uses its own temporary directory;
Yarn's package cache may be shared, but these runs showed no installation lock
or network stall.

A separate synthetic probe confirmed that a parent 100ms timer ran only after
a 541ms synchronous child returned. A child ignoring SIGTERM did not return
from a 300ms `spawnSync` timeout and was stopped by the external 3s deadline.
This demonstrates a limitation of the timeout mechanism, **not** its involvement
in the original CI stall. See [Node's synchronous subprocess documentation](https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options).

## Safeguards and follow-up

Main CI now has a 15-minute affected-step deadline and a 20-minute job deadline.
These bounds allow substantially more than the observed healthy run and the
longest six-minute E2E test, while reserving time for the existing `fix-ci` step.
They stop the coordinator from waiting an hour without progress; they do not
increase any task or test timeout. Cloud's normal main-job lifecycle monitoring
remains responsible for stopping remote agents. A runner timeout is not proof
that a remote process tree was cleaned up; verify agent termination in Cloud.

Real-install commands now log boundaries in CI (or with `NEST_E2E_TRACE=true`).
An unmatched START record identifies the last entered command; END includes
status, signal, and error code so expected failures differ from timeout errors.
Assertions, real installation, distributed execution, caching, and atomization
are retained.

For recurrence, preserve the agents' last logs and allocation/termination times,
inspect agent 2's memory/OOM events and its last command boundary. A successful
subsequent run alone would
not prove that these safeguards repaired the original cause.

Separate configuration observations:

- `sharedGlobals` currently includes `.github/workflows/ci.yml`, the existing
  Feature CI workflow, but omits `.github/workflows/main.yml` and agent setup.
  Review those cache inputs separately, especially when changing runtime or
  install behavior. This mismatch does not explain a blocked scheduled task.
- `nx-cloud start-ci-run` remains documented. The newer agent configuration
  pattern may be adopted independently; changing orchestration APIs is not
  supported as a stall fix by this evidence. See the
  [Nx Cloud CLI reference](https://nx.dev/docs/reference/nx-cloud-cli).
