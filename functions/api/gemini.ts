import { GoogleGenerativeAI } from '@google/generative-ai';

interface Env {
  // 必需配置
  GEMINI_API_KEY: string;
  
  // 可选配置
  INVITE_CODES: string;
  INVITE_CODE_MAX_USES: string;
  ANALYSIS_MODEL: string;
  GENERATE_MODEL: string;
  REVIEW_PASS_THRESHOLD: string;
  PHOTO_APPROVAL_THRESHOLD: string;
  
  // 安全配置
  ENABLE_RATE_LIMIT: string;
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW: string;
  
  // 功能开关
  ENABLE_ANALYZE: string;
  ENABLE_GENERATE: string;
  ENABLE_REVIEW: string;
}

// 默认值
const DEFAULTS = {
  INVITE_CODES: 'PHOTO2026,VIP001,EARLY2026',
  INVITE_CODE_MAX_USES: '100,50,200',
  ANALYSIS_MODEL: 'gemini-3-pro-preview',
  GENERATE_MODEL: 'gemini-3-pro-image-preview',
  REVIEW_PASS_THRESHOLD: '80',
  PHOTO_APPROVAL_THRESHOLD: '80',
  ENABLE_RATE_LIMIT: 'true',
  RATE_LIMIT_REQUESTS: '10',
  RATE_LIMIT_WINDOW: '60000',
  ENABLE_ANALYZE: 'true',
  ENABLE_GENERATE: 'true',
  ENABLE_REVIEW: 'true',
};

interface RequestBody {
  code: string;
  image?: string;
  action: 'analyze' | 'buildPrompt' | 'review' | 'generate';
  data?: any;
}

interface InviteConfig {
  code: string;
  type: string;
  maxUses: number;
  used: number;
}

function parseEnv(env: Env): {
  inviteCodes: InviteConfig[];
  analysisModel: string;
  generateModel: string;
  reviewPassThreshold: number;
  photoApprovalThreshold: number;
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number;
  featuresEnabled: { analyze: boolean; generate: boolean; review: boolean };
} {
  // 解析邀请码配置
  const codes = (env.INVITE_CODES || DEFAULTS.INVITE_CODES).split(',');
  const maxUses = (env.INVITE_CODE_MAX_USES || DEFAULTS.INVITE_CODE_MAX_USES).split(',').map(Number);
  
  const types = ['alpha', 'pro', 'beta'];
  const inviteCodes: InviteConfig[] = codes.map((code, i) => ({
    code: code.trim(),
    type: types[i] || 'beta',
    maxUses: maxUses[i] || 100,
    used: 0,
  }));

  return {
    inviteCodes,
    analysisModel: env.ANALYSIS_MODEL || DEFAULTS.ANALYSIS_MODEL,
    generateModel: env.GENERATE_MODEL || DEFAULTS.GENERATE_MODEL,
    reviewPassThreshold: Number(env.REVIEW_PASS_THRESHOLD || DEFAULTS.REVIEW_PASS_THRESHOLD),
    photoApprovalThreshold: Number(env.PHOTO_APPROVAL_THRESHOLD || DEFAULTS.PHOTO_APPROVAL_THRESHOLD),
    rateLimitEnabled: env.ENABLE_RATE_LIMIT !== 'false',
    rateLimitRequests: Number(env.RATE_LIMIT_REQUESTS || DEFAULTS.RATE_LIMIT_REQUESTS),
    rateLimitWindow: Number(env.RATE_LIMIT_WINDOW || DEFAULTS.RATE_LIMIT_WINDOW),
    featuresEnabled: {
      analyze: env.ENABLE_ANALYZE !== 'false',
      generate: env.ENABLE_GENERATE !== 'false',
      review: env.ENABLE_REVIEW !== 'false',
    },
  };
}

// 专家知识库
const EXPERT_KNOWLEDGE = {
  photography: { systemPrompt: '张艺谋团队首席摄影师，30年经验。精通伦勃朗光/蝴蝶光/环形光；Canon R5/Nikon Z9；85mm镜头；8K画质。' },
  beauty: { systemPrompt: '好莱坞顶级修图师。精通Fitzpatrick分型I-VI；保留皮肤质感；自然美颜。禁忌：过度磨皮、种族特征改变。' },
  director: { systemPrompt: '张艺谋团队摄影指导。精通情绪引导；微表情；LinkedIn/证件照/社交媒体场合匹配。' },
};

// 内存中的邀请码使用记录（Vercel/Cloudflare Functions 中会重置）
const codeUsage = new Map<string, number>();

function validateCode(code: string, config: ReturnType<typeof parseEnv>): { valid: boolean; type?: string; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'INVITE_CODE_REQUIRED' };
  }

  const upperCode = code.toUpperCase().trim();
  const inviteConfig = config.inviteCodes.find(c => c.code === upperCode);

  if (!inviteConfig) {
    return { valid: false, error: 'INVALID_INVITE_CODE' };
  }

  const used = codeUsage.get(upperCode) || 0;
  if (used >= inviteConfig.maxUses) {
    return { valid: false, error: 'INVITE_CODE_EXHAUSTED' };
  }

  return { valid: true, type: inviteConfig.type };
}

function buildPrompt(data: any, action: string): string {
  switch (action) {
    case 'analyze':
      return `${EXPERT_KNOWLEDGE.beauty.systemPrompt}
分析照片，JSON：{"race":"人种","skinTone":"肤色","gender":"性别","age":"年龄","faceShape":"脸型","skinConcerns":["问题"],"uniqueFeatures":["特征"],"preservationPoints":["保留"]}
只返回JSON。`;

    case 'buildPrompt':
      return `${EXPERT_KNOWLEDGE.photography.systemPrompt}
${EXPERT_KNOWLEDGE.beauty.systemPrompt}
人物：${JSON.stringify(data)}
创建方案，JSON：{"base":"摄影描述","lighting":"灯光","camera":"相机","beauty":"美颜","style":"风格","preservation":["保留"]}
只返回JSON。`;

    case 'review':
      return `## 三位专家评审
${EXPERT_KNOWLEDGE.photography.systemPrompt}
${EXPERT_KNOWLEDGE.beauty.systemPrompt}
${EXPERT_KNOWLEDGE.director.systemPrompt}

评审：${data.content}
JSON：{"photographer":{"score":0,"comments":"","approved":false},"beautyEditor":{"score":0,"comments":"","approved":false},"director":{"score":0,"comments":"","approved":false},"overallScore":0,"approved":false,"summary":"","suggestions":[]}`;

    case 'generate':
      return `${EXPERT_KNOWLEDGE.photography.systemPrompt}
${data.prompt}
8K,Canon R5,f/1.8-2.8,85mm,RAW质感,肤色还原准确,眼神光清晰,无AI痕迹
保留：${(data.preservation || []).join(',') || '原有特征'}`;

    default:
      return '';
  }
}

function validate(body: any, config: ReturnType<typeof parseEnv>): { valid: boolean; type?: string; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'INVALID_REQUEST' };
  }

  if (!body.code) {
    return { valid: false, error: 'INVITE_CODE_REQUIRED' };
  }

  const codeResult = validateCode(body.code, config);
  if (!codeResult.valid) {
    return { valid: false, error: codeResult.error };
  }

  const actions = ['analyze', 'buildPrompt', 'review', 'generate'];
  if (!body.action || !actions.includes(body.action)) {
    return { valid: false, error: 'INVALID_ACTION' };
  }

  if (body.action === 'analyze' && !body.image) {
    return { valid: false, error: 'IMAGE_REQUIRED' };
  }

  // 功能开关检查
  if (body.action === 'analyze' && !config.featuresEnabled.analyze) {
    return { valid: false, error: 'FEATURE_DISABLED' };
  }
  if (body.action === 'generate' && !config.featuresEnabled.generate) {
    return { valid: false, error: 'FEATURE_DISABLED' };
  }

  return { valid: true, type: codeResult.type };
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  // 验证必需的环境变量
  if (!env.GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY configuration');
    return new Response(JSON.stringify({ 
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service configuration error'
    }), { status: 503, headers: cors });
  }

  // 解析配置
  const config = parseEnv(env);

  try {
    const body = await request.json();
    const check = validate(body, config);
    if (!check.valid) {
      return new Response(JSON.stringify({ error: check.error }), { status: 401, headers: cors });
    }

    // 增加邀请码使用次数
    const upperCode = body.code.toUpperCase().trim();
    codeUsage.set(upperCode, (codeUsage.get(upperCode) || 0) + 1);

    // 构建 Prompt
    const prompt = buildPrompt(body.data, body.action);

    // 调用 Gemini
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: body.action === 'generate' ? config.generateModel : config.analysisModel,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const parts: any[] = [{ text: prompt }];
    if (body.image) {
      const base64 = body.image.split(',')[1] || body.image;
      parts.push({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();

    return new Response(JSON.stringify({ 
      result: text, 
      action: body.action,
      codeType: check.type,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('Error:', e.message);
    return new Response(JSON.stringify({ error: 'PROCESSING_ERROR' }), { status: 500, headers: cors });
  }
}
