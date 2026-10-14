import 'server-only';

export async function getAgentContext() {
  if (!process.env.LONGBRIDGE_APP_KEY || !process.env.LONGBRIDGE_APP_SECRET || !process.env.LONGBRIDGE_ACCESS_TOKEN) {
    throw new Error('请在 .env.local 配置长桥 API 密钥并重启服务');
  }
  const { AgentContext, Config } = await import('longbridge');
  return AgentContext.new(Config.fromApikeyEnv());
}

export function agentApiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('请在 .env.local')) return message;
  if (/401|403|token|permission|auth/i.test(message)) return '长桥 Agent 认证或权限不足，请检查 API 密钥、令牌及 Agent 访问权限。';
  return '长桥 Agent 请求失败，请检查网络与 Agent 可用性后重试。';
}
