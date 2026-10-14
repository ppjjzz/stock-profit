import 'server-only';

export function longbridgeErrorMessage(error: unknown): string {
  const causes: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 8; depth++) {
    if (!(current instanceof Error)) {
      causes.push(String(current));
      break;
    }
    const code = 'code' in current ? ` (${String(current.code)})` : '';
    causes.push(`${current.name}${code}: ${current.message}`);
    current = current.cause;
  }
  const message = causes.join(' <- ');
  return ['LONGBRIDGE_APP_KEY', 'LONGBRIDGE_APP_SECRET', 'LONGBRIDGE_ACCESS_TOKEN']
    .reduce((safeMessage, name) => {
      const secret = process.env[name];
      return secret ? safeMessage.replaceAll(secret, '[redacted]') : safeMessage;
    }, message);
}

export function isNativeBindingError(message: string): boolean {
  return /Cannot find native binding|Cannot find module ['"]longbridge-(?:linux|darwin|win32)|Failed to load external module longbridge-/i.test(message);
}
