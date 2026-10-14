import { copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';

if (process.platform === 'linux' && process.arch === 'x64') {
  const require = createRequire(import.meta.url);
  const sdkDirectory = dirname(require.resolve('longbridge/package.json'));
  const nativeName = 'longbridge-linux-x64-gnu';
  let source;

  try {
    source = createRequire(join(sdkDirectory, 'package.json')).resolve(nativeName);
  } catch (error) {
    throw new Error(
      `${nativeName} was not installed. Check that pnpm optional dependencies are enabled on Vercel.`,
      { cause: error },
    );
  }

  const target = join(sdkDirectory, basename(source));
  if (!existsSync(target)) copyFileSync(source, target);
  console.log(`Longbridge native binding ready: ${basename(target)}`);
}
