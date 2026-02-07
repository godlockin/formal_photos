import {
  Env,
  Config,
  parseConfig,
  checkRateLimit,
  validateSignature,
  validateInviteCode,
  incrementCodeUsage,
  validateImage,
  validateAction,
  createGeminiClient,
} from './utils/security';
import {
  buildAnalyzePrompt,
  buildDesignPrompt,
  buildPromptPrompt,
  buildReviewPrompt,
  buildGeneratePrompt,
  buildFinalCheckPrompt,
  parseReviewResult,
} from './services/prompt-builder';

const codeUsage = new Map<string, number>();

async function processGeminiRequest(
  apiKey: string,
  prompt: string,
  imageBase64: string | undefined,
  model: string
): Promise<string> {
  const genAI = createGeminiClient(apiKey);
  const modelInstance = genAI.getGenerativeModel({
    model,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } });
  }

  const result = await modelInstance.generateContent(parts);
  return result.response.text();
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Signature, X-Timestamp',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (!env.GEMINI_API_KEY) {
    console.error('[ERROR] Missing GEMINI_API_KEY configuration');
    return new Response(JSON.stringify({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service configuration error',
    }), { status: 503, headers: cors });
  }

  const config = parseConfig(env);
  const timestamp = request.headers.get('X-Timestamp');
  const signature = request.headers.get('X-Signature');
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    const bodyText = await request.text();
    const now = Date.now();

    if (timestamp) {
      const requestAge = now - parseInt(timestamp);
      if (requestAge > 300000) {
        return new Response(JSON.stringify({ error: 'REQUEST_EXPIRED' }), {
          status: 401,
          headers: cors,
        });
      }
    }

    if (config.apiSecret) {
      const isValid = await validateSignature(bodyText, signature, config.apiSecret);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'INVALID_SIGNATURE' }), {
          status: 401,
          headers: cors,
        });
      }
    }

    const rateLimit = checkRateLimit(clientIP, config, now);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimit.retryAfter,
      }), {
        status: 429,
        headers: { ...cors, 'Retry-After': String(rateLimit.retryAfter || 60) },
      });
    }

    const body = JSON.parse(bodyText);
    const { code, action, image, data } = body;

    const codeValidation = validateInviteCode(code, config, codeUsage);
    if (!codeValidation.valid) {
      return new Response(JSON.stringify({ error: codeValidation.error }), {
        status: 401,
        headers: cors,
      });
    }

    const imageValidation = validateImage(image);
    if (!imageValidation.valid) {
      return new Response(JSON.stringify({ error: imageValidation.error }), {
        status: 400,
        headers: cors,
      });
    }

    const actionValidation = validateAction(action, config, config.featuresEnabled);
    if (!actionValidation.valid) {
      return new Response(JSON.stringify({ error: actionValidation.error }), {
        status: 400,
        headers: cors,
      });
    }

    incrementCodeUsage(code, codeUsage);

    const imageBase64 = image?.split(',')[1] || image;
    let result: any;
    let responseAction = action;

    switch (action) {
      case 'analyze': {
        const prompt = buildAnalyzePrompt();
        const text = await processGeminiRequest(env.GEMINI_API_KEY, prompt, imageBase64, config.analysisModel);
        result = JSON.parse(text);
        break;
      }

      case 'design': {
        const person = data;
        const prompt = buildDesignPrompt(person);
        const text = await processGeminiRequest(env.GEMINI_API_KEY, prompt, undefined, config.analysisModel);
        result = JSON.parse(text);
        break;
      }

      case 'buildPrompt': {
        const { person, design } = data;
        const prompt = buildPromptPrompt(person, design);
        const text = await processGeminiRequest(env.GEMINI_API_KEY, prompt, undefined, config.analysisModel);
        result = JSON.parse(text);
        break;
      }

      case 'review': {
        const prompt = buildReviewPrompt(JSON.stringify(data.content || data), !!data.image);
        const model = config.analysisModel;
        const text = await processGeminiRequest(env.GEMINI_API_KEY, prompt, data.image, model);
        result = parseReviewResult(text);
        break;
      }

      case 'generate': {
        const prompt = buildGeneratePrompt(data);
        const text = await processGeminiRequest(env.GEMINI_API_KEY, prompt, undefined, config.generateModel);
        result = text;
        break;
      }

      case 'finalCheck': {
        const prompt = buildFinalCheckPrompt(data.person, data.prompt, !!image);
        const text = await processGeminiRequest(env.GEMINI_API_KEY, prompt, imageBase64, config.analysisModel);
        result = parseReviewResult(text);
        responseAction = 'finalReview';
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'INVALID_ACTION' }), {
          status: 400,
          headers: cors,
        });
    }

    return new Response(JSON.stringify({
      result,
      action: responseAction,
      codeType: codeValidation.type,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    console.error('[ERROR]', e.message);
    return new Response(JSON.stringify({
      error: 'PROCESSING_ERROR',
      message: e.message,
    }), { status: 500, headers: cors });
  }
}
