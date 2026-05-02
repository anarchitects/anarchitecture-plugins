export interface InitGeneratorSchema {
  packageManager?: 'yarn' | 'npm' | 'pnpm';
  skipPackageJson?: boolean;
  skipFormat?: boolean;
  forceVersions?: boolean;
}
