import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';

describe('nx-js', () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = createTestProject();

    // The plugin has been built and published to a local registry in the jest globalSetup
    // Install the plugin built with the latest source code into the test repo
    runCommand(`yarn add -D @anarchitects/nx-js@e2e`, projectDirectory);
  });

  afterAll(() => {
    if (projectDirectory) {
      // Cleanup the test project
      rmSync(projectDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it('should be installed', () => {
    // npm ls will fail if the package is not installed properly
    runCommand('yarn info --name-only @anarchitects/nx-js', projectDirectory);
  });

  it('should add secondary entry points to js libraries', () => {
    runCommand(
      [
        'yarn nx g @anarchitects/nx-js:library my-lib',
        '--directory=libs',
        '--bundler=tsc',
        '--unitTestRunner=none',
        '--linter=none',
        '--no-interactive',
      ].join(' '),
      projectDirectory
    );

    const libraryProject = resolveGeneratedLibrary(projectDirectory, 'my-lib');
    const libraryEntryPath = normalizeWorkspacePath(
      join(libraryProject.root, 'src/feature/index.ts')
    );

    runCommand(
      [
        'yarn nx g @anarchitects/nx-js:secondary-entry-point',
        `--project=${libraryProject.name}`,
        '--name=feature',
        '--no-interactive',
      ].join(' '),
      projectDirectory
    );

    const projectJson = JSON.parse(
      readFileSync(
        join(projectDirectory, libraryProject.root, 'project.json'),
        'utf-8'
      )
    );
    expect(projectJson.targets.build.options.additionalEntryPoints).toContain(
      libraryEntryPath
    );
    expect(projectJson.targets.build.options.generateExportsField).toBe(true);

    runCommand(`yarn nx build ${libraryProject.name}`, projectDirectory);

    const builtPackageJson = JSON.parse(
      readFileSync(
        join(
          projectDirectory,
          projectJson.targets.build.options.outputPath ??
            `dist/${libraryProject.root}`,
          'package.json'
        ),
        'utf-8'
      )
    );
    const featureExport = builtPackageJson.exports['./feature'];
    expect(featureExport).toBeDefined();

    if (typeof featureExport === 'string') {
      expect(normalizeWorkspacePath(featureExport)).toMatch(
        /feature\/index\.js$/
      );
    } else {
      expect(featureExport).toMatchObject({});
      if (featureExport.import) {
        expect(normalizeWorkspacePath(featureExport.import)).toMatch(
          /feature\/index\.js$/
        );
      }
      if (featureExport.default) {
        expect(normalizeWorkspacePath(featureExport.default)).toMatch(
          /feature\/index\.js$/
        );
      }
      if (featureExport.types) {
        expect(normalizeWorkspacePath(featureExport.types)).toMatch(
          /feature\/index\.d\.ts$/
        );
      }
    }
  });
});

/**
 * Creates a test project with create-nx-workspace and installs the plugin
 * @returns The directory where the test project was created
 */
function createTestProject() {
  const projectName = 'test-project';
  const projectDirectory = join(process.cwd(), 'tmp', projectName);

  // Ensure projectDirectory is empty
  rmSync(projectDirectory, {
    recursive: true,
    force: true,
  });
  mkdirSync(dirname(projectDirectory), {
    recursive: true,
  });

  runCommand(
    `yarn dlx create-nx-workspace@latest ${projectName} --preset apps --nxCloud=skip --no-interactive`,
    dirname(projectDirectory)
  );
  console.log(`Created test project in "${projectDirectory}"`);

  return projectDirectory;
}

function runCommand(command: string, cwd: string) {
  execSync(command, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      NX_DAEMON: 'false',
    },
  });
}

function resolveGeneratedLibrary(
  projectDirectory: string,
  libraryName: string
) {
  const candidates = buildCandidateRoots(libraryName);
  const projectNames: string[] = JSON.parse(
    runCommandCapture('yarn nx show projects --json', projectDirectory)
  );

  for (const projectName of projectNames) {
    const projectInfo = JSON.parse(
      runCommandCapture(
        `yarn nx show project ${projectName} --json`,
        projectDirectory
      )
    );

    const projectRoot = projectInfo.root as string | undefined;
    if (!projectRoot || !candidates.includes(projectRoot)) {
      continue;
    }

    const projectJsonPath = join(projectDirectory, projectRoot, 'project.json');
    if (!existsSync(projectJsonPath)) {
      throw new Error(
        `Expected project.json to exist for project "${projectName}" at "${projectJsonPath}".`
      );
    }

    return { name: projectName, root: projectRoot };
  }

  throw new Error(
    `Unable to locate generated library project for candidates: ${candidates.join(
      ', '
    )}.`
  );
}

function buildCandidateRoots(libraryName: string): string[] {
  const normalized = libraryName.replace(/\\/g, '/');
  return [`libs/${normalized}`, `packages/${normalized}`, normalized, 'libs'];
}

function normalizeWorkspacePath(pathValue: string): string {
  return pathValue.split('\\').join('/');
}

function runCommandCapture(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      NX_DAEMON: 'false',
    },
  })
    .toString('utf-8')
    .trim();
}
