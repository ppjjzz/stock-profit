import 'server-only';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function configureLongbridgeNative() {
  if (process.platform !== 'linux' || process.arch !== 'x64') return;
  const nativePath = join(process.cwd(), '.native', 'longbridge.linux-x64-gnu.node');
  if (!existsSync(nativePath)) {
    if (process.env.NODE_ENV !== 'production') return;
    throw new Error(`Longbridge native binding is missing from the function bundle: ${nativePath}`);
  }
  process.env.NAPI_RS_NATIVE_LIBRARY_PATH = nativePath;
}
