import { spawn as nativeSpawn } from 'node:child_process';

export interface SpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function spawn(
  cmd: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const env = { ...process.env, ...options.env };

  return new Promise((resolve) => {
    const child = nativeSpawn(cmd, args, { stdio: 'inherit', cwd, env });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}
