import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';

if (process.platform === 'linux' && process.arch === 'x64') {
  const require = createRequire(import.meta.url);
  const nativeName = 'longbridge-linux-x64-gnu';
  let source;

  try {
    source = require.resolve(nativeName);
  } catch (error) {
    throw new Error(
      `${nativeName} was not installed. Check that pnpm optional dependencies are enabled on Vercel.`,
      { cause: error },
    );
  }

  require(source);
  const directory = join(process.cwd(), '.native');
  mkdirSync(directory, { recursive: true });
  copyFileSync(source, join(directory, basename(source)));
  console.log(`Longbridge native binding ready: ${basename(source)}`);
}
