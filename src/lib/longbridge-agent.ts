import 'server-only';
import { isNativeBindingError, longbridgeErrorMessage } from './longbridge-error';
import { configureLongbridgeNative } from './longbridge-native';

export async function getAgentContext() {
  if (!process.env.LONGBRIDGE_APP_KEY || !process.env.LONGBRIDGE_APP_SECRET || !process.env.LONGBRIDGE_ACCESS_TOKEN) {
    throw new Error('服务器未配置长桥 API 密钥');
  }
  configureLongbridgeNative();
  const { AgentContext, Config } = await import('longbridge');
  return AgentContext.new(Config.fromApikeyEnv());
}

export function agentApiError(error: unknown) {
  const message = longbridgeErrorMessage(error);
  console.error('Longbridge Agent error:', message);
  if (message.startsWith('服务器未配置长桥 API 密钥')) return message;
  if (isNativeBindingError(message)) return '服务器未能加载长桥原生模块，请检查 Vercel 部署依赖。';
  if (/401|403|token|permission|auth/i.test(message)) return '长桥 Agent 认证或权限不足，请检查 API 密钥、令牌及 Agent 访问权限。';
  return '长桥 Agent 请求失败，请检查网络与 Agent 可用性后重试。';
}
