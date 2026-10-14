import 'server-only';

export function longbridgeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return ['LONGBRIDGE_APP_KEY', 'LONGBRIDGE_APP_SECRET', 'LONGBRIDGE_ACCESS_TOKEN']
    .reduce((safeMessage, name) => {
      const secret = process.env[name];
      return secret ? safeMessage.replaceAll(secret, '[redacted]') : safeMessage;
    }, message);
}

export function isNativeBindingError(message: string): boolean {
  return /Cannot find native binding|Cannot find module ['"]longbridge-(?:linux|darwin|win32)|Failed to load external module longbridge-/i.test(message);
}
