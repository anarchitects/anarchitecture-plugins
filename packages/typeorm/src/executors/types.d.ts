export type ModuleSystem = 'auto' | 'commonjs' | 'esm';

export interface ModuleSystemOption {
  moduleSystem?: ModuleSystem;
}

export interface ArgsOption {
  args?: string[];
}

export interface ProjectRootOption {
  projectRoot?: string;
}

export interface DataSourceOption {
  dataSource?: string;
}

export interface CliBaseOptions
  extends ProjectRootOption,
    DataSourceOption,
    ModuleSystemOption,
    ArgsOption {}

export type ProjectRootOnlyOptions = ProjectRootOption

export interface ProjectRootDataSourceOptions
  extends ProjectRootOption,
    DataSourceOption {}
