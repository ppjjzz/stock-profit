import { copyFileSync, existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const sdkCommit = 'b2f749a3c68cc4f05642b37fc790fb711d2dfb13';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

if (process.platform === 'linux' && process.arch === 'x64') {
  const require = createRequire(import.meta.url);
  const nativeName = 'longbridge-linux-x64-gnu';
  const directory = join(process.cwd(), '.native');
  const target = join(directory, 'longbridge.linux-x64-gnu.node');
  let source;

  try {
    source = require.resolve(nativeName);
    require(source);
  } catch (error) {
    if (!source) {
      throw new Error(`${nativeName} was not installed. Check that pnpm optional dependencies are enabled on Vercel.`, { cause: error });
    }
    if (!/GLIBC_[0-9.]+.*not found/.test(String(error))) throw error;
    console.log(`${nativeName} is incompatible with this Linux image; building the SDK from source.`);
    const temporary = mkdtempSync(join(tmpdir(), 'longbridge-sdk-'));
    try {
      const installer = join(temporary, 'rustup.sh');
      const sourceDirectory = join(temporary, 'openapi');
      const cargoHome = process.env.CARGO_HOME || join(homedir(), '.cargo');
      let cargo = 'cargo';
      if (spawnSync(cargo, ['--version'], { stdio: 'ignore' }).status !== 0) {
        run('curl', ['--proto', '=https', '--tlsv1.2', '-fsSL', 'https://sh.rustup.rs', '-o', installer]);
        run('sh', [installer, '-y', '--profile', 'minimal', '--default-toolchain', 'stable']);
        cargo = join(cargoHome, 'bin', 'cargo');
      }
      run('git', ['clone', '--depth', '1', '--recurse-submodules', '--shallow-submodules', '--branch', 'v5.2.0', 'https://github.com/longbridge/openapi.git', sourceDirectory]);
      const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: sourceDirectory, encoding: 'utf8' });
      if (revision.status !== 0 || revision.stdout.trim() !== sdkCommit) {
        throw new Error('Longbridge source revision did not match the pinned 5.2.0 commit.');
      }
      run(cargo, ['build', '--release', '-p', 'longbridge-nodejs'], {
        cwd: sourceDirectory,
        env: { ...process.env, CARGO_PROFILE_RELEASE_DEBUG: '0', CARGO_PROFILE_RELEASE_LTO: 'false', CARGO_BUILD_JOBS: '2' },
      });
      source = join(sourceDirectory, 'target', 'release', 'liblongbridge_nodejs.so');
      if (!existsSync(source)) throw new Error(`Longbridge build did not produce ${source}`);
      mkdirSync(directory, { recursive: true });
      copyFileSync(source, target);
      run('strip', ['--strip-unneeded', target]);
      require(target);
      source = target;
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }

  if (source !== target) {
    mkdirSync(directory, { recursive: true });
    copyFileSync(source, target);
  }
  console.log(`Longbridge native binding ready: ${basename(target)}`);
}
