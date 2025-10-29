import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';

describe('nx-typeorm', () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = createTestProject();

    // The plugin has been built and published to a local registry in the jest globalSetup
    // Install the plugin built with the latest source code into the test repo
    execSync(`yarn add -D @anarchitects/nx-typeorm@e2e`, {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: process.env,
    });
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
    execSync('yarn info --name-only @anarchitects/nx-typeorm', {
      cwd: projectDirectory,
      stdio: 'inherit',
    });
  });

  it('bootstraps a library project', () => {
    execSync(
      'yarn nx generate @nx/js:library typeorm-lib --bundler=tsc --unitTestRunner=none --no-interactive',
      {
        cwd: projectDirectory,
        stdio: 'inherit',
        env: {
          ...process.env,
          NX_DAEMON: 'false',
        },
      }
    );

    execSync(
      'yarn nx generate @anarchitects/nx-typeorm:bootstrap --project=typeorm-lib --domain=Customer --skipInstall --no-interactive',
      {
        cwd: projectDirectory,
        stdio: 'inherit',
        env: {
          ...process.env,
          NX_DAEMON: 'false',
        },
      }
    );

    const libraryRoot = resolveLibraryRoot(projectDirectory, 'typeorm-lib');
    const schemaPath = join(
      projectDirectory,
      libraryRoot,
      'src/infrastructure-persistence/schema.ts'
    );
    expect(existsSync(schemaPath)).toBe(true);
    const schemaContents = readFileSync(schemaPath, 'utf-8');
    expect(schemaContents).toContain(
      "export const Customer_SCHEMA = 'customer';"
    );

    const migrationPath = join(
      projectDirectory,
      libraryRoot,
      'src/infrastructure-persistence/migrations/1700000000000_init_schema.ts'
    );
    expect(existsSync(migrationPath)).toBe(true);

    const projectJson = JSON.parse(
      readFileSync(join(projectDirectory, libraryRoot, 'project.json'), {
        encoding: 'utf-8',
      })
    );

    expect(projectJson.metadata?.typeorm).toEqual({
      schema: 'customer',
      domain: 'Customer',
    });
  });
});

/**
 * Creates a test project with create-nx-workspace and installs the plugin
 * @returns The directory where the test project was created
 */
function createTestProject(projectName = 'test-project') {
  const projectDirectory = join(process.cwd(), 'tmp', projectName);

  // Ensure projectDirectory is empty
  rmSync(projectDirectory, {
    recursive: true,
    force: true,
  });
  mkdirSync(dirname(projectDirectory), {
    recursive: true,
  });

  execSync(
    `yarn dlx create-nx-workspace@latest ${projectName} --preset apps --nxCloud=skip --no-interactive`,
    {
      cwd: dirname(projectDirectory),
      stdio: 'inherit',
      env: process.env,
    }
  );
  console.log(`Created test project in "${projectDirectory}"`);

  return projectDirectory;
}

function resolveLibraryRoot(projectDirectory: string, libraryName: string) {
  const candidates = [
    join('libs', libraryName),
    join('packages', libraryName),
    libraryName,
  ];

  for (const candidate of candidates) {
    if (existsSync(join(projectDirectory, candidate))) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate generated library root for "${libraryName}".`
  );
}
