// 配置说明文档

/**
 * Cloudflare Pages 环境变量配置
 * 
 * 所有参数都可以通过 Cloudflare 后台配置
 */

// ==================== 必需配置 ==================== //

interface RequiredConfig {
  GEMINI_API_KEY: string;  // Gemini API Key
}

// ==================== 可选配置 ==================== //

interface OptionalConfig {
  // 邀请码配置
  INVITE_CODES: string;           // 邀请码列表
  INVITE_CODE_MAX_USES: string;    // 最大使用次数
  
  // 模型配置
  ANALYSIS_MODEL: string;          // 分析模型
  GENERATE_MODEL: string;          // 生成模型
  
  // 评审配置
  REVIEW_PASS_THRESHOLD: string;   // Prompt评审阈值
  PHOTO_APPROVAL_THRESHOLD: string; // 照片审核阈值
  
  // 功能开关
  ENABLE_ANALYZE: string;          // 启用分析
  ENABLE_GENERATE: string;         // 启用生成
  ENABLE_REVIEW: string;           // 启用评审
  
  // 速率限制
  ENABLE_RATE_LIMIT: string;       // 启用限流
  RATE_LIMIT_REQUESTS: string;    // 每分钟请求数
  RATE_LIMIT_WINDOW: string;       // 窗口期
}

// ==================== 默认值 ==================== //

const DEFAULTS: OptionalConfig = {
  INVITE_CODES: 'PHOTO2026,VIP001,EARLY2026',
  INVITE_CODE_MAX_USES: '100,50,200',
  ANALYSIS_MODEL: 'gemini-3-pro-preview',
  GENERATE_MODEL: 'gemini-3-pro-image-preview',
  REVIEW_PASS_THRESHOLD: '80',
  PHOTO_APPROVAL_THRESHOLD: '80',
  ENABLE_ANALYZE: 'true',
  ENABLE_GENERATE: 'true',
  ENABLE_REVIEW: 'true',
  ENABLE_RATE_LIMIT: 'true',
  RATE_LIMIT_REQUESTS: '10',
  RATE_LIMIT_WINDOW: '60000',
};

// ==================== 配置验证 ==================== //

type ConfigKey = keyof RequiredConfig | keyof OptionalConfig;

function validateConfig(env: Record<string, string>): {
  valid: boolean;
  errors: string[];
  config: Record<string, string>;
} {
  const errors: string[] = [];
  const config: Record<string, string> = {};
  
  // 检查必需配置
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === DEFAULTS.GEMINI_API_KEY) {
    errors.push('GEMINI_API_KEY 是必需的');
  } else {
    config.GEMINI_API_KEY = '***已配置***';
  }
  
  // 设置默认值
  for (const [key, value] of Object.entries(DEFAULTS)) {
    config[key] = env[key] || value;
  }
  
  return { valid: errors.length === 0, errors, config };
}

// ==================== 导出 ==================== //

export {
  RequiredConfig,
  OptionalConfig,
  DEFAULTS,
  validateConfig,
  type ConfigKey,
};

export default {
  RequiredConfig,
  OptionalConfig,
  DEFAULTS,
  validateConfig,
};
