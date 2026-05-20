#!/usr/bin/env node

import { runAgovCli } from '../agov.js';

process.exitCode = runAgovCli(process.argv.slice(2));
