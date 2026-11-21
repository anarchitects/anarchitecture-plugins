// SPDX-License-Identifier: MIT
const { relative } = require('node:path');

/** Report from Jest's parent even when a worker is in a synchronous child call. */
module.exports = class ProgressReporter {
  active = new Map();

  onRunStart() {
    this.timer = setInterval(() => {
      for (const [path, started] of this.active) {
        this.log('RUNNING', path, `elapsedMs=${Date.now() - started}`);
      }
    }, 60_000);
    this.timer.unref();
  }

  onTestStart(test) {
    this.active.set(test.path, Date.now());
    this.log('START', test.path);
  }

  onTestResult(test, result) {
    const started = this.active.get(test.path);
    this.active.delete(test.path);
    this.log(
      'END',
      test.path,
      `elapsedMs=${
        started === undefined ? 'unknown' : Date.now() - started
      } failed=${result.numFailingTests} executionError=${Boolean(
        result.testExecError
      )}`
    );
  }

  onRunComplete() {
    clearInterval(this.timer);
  }

  log(event, path, detail = '') {
    process.stderr.write(
      `[nest-e2e] ${new Date().toISOString()} ${event} ${relative(
        __dirname,
        path
      )} ${detail}\n`
    );
  }
};
