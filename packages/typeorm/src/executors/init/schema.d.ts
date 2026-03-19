export interface InitExecutorOptions {
  name?: string;
  database?: string;
  express?: boolean;
  docker?: boolean;
  manager?: 'npm' | 'yarn';
  module?: 'commonjs' | 'esm';
  args?: string[];
}
