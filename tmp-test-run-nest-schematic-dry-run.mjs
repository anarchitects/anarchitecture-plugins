import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing.js';
import { runNestSchematic } from './packages/nest/dist/generation-adapter/schematic-runner.js';

const tree = createTreeWithEmptyWorkspace();

const before = tree.listChanges();

const result = await runNestSchematic(tree, {
  schematicName: 'application',
  schematicOptions: {
    name: 'demo-api',
  },
  dryRun: true,
});

const after = tree.listChanges();

console.log('Result:', result);
console.log('Before changes:', before.map((change) => ({
  path: change.path,
  type: change.type,
})));
console.log('After changes:', after.map((change) => ({
  path: change.path,
  type: change.type,
})));

const demoApiChanges = after.filter((change) => change.path.startsWith('demo-api/'));

console.log('Demo API changes after dry run:', demoApiChanges.length);

if (demoApiChanges.length > 0) {
  console.error('Dry run mutated the Nx Tree with demo-api files.');
  process.exit(1);
}
