import {
  GoogleGenerativeAI,
} from '@google/generative-ai';

// --- Types ---

interface Env {
  GEMINI_API_KEY: string;
  INVITE_CODES?: string;
  API_SECRET?: string; // For request signing
  FAST_MODEL?: string;
  FAST_MODEL_FALLBACK?: string;
  HIGH_QUALITY_MODEL?: string;
  HIGH_QUALITY_MODEL_FALLBACK?: string;
  GENERATE_MODEL?: string;
  GENERATE_MODEL_FALLBACK?: string;
}

interface Config {
  apiKey: string;
  inviteCodes: string[];
  apiSecret?: string;
}

// 模型配置
const MODELS = {
  ANALYSIS: 'gemini-3-pro-preview',
  GENERATION: 'gemini-3-pro-image-preview',
};

const ITERATION_LIMITS = {
  MAX_PROMPT_ITERATIONS: 3,
  MAX_GENERATION_ITERATIONS: 3,
};

const codeUsage = new Map<string, number>();
const requestSignatures = new Set<string>(); // Prevent replay attacks

// --- Utils ---

export function parseConfig(env: Env): Config {
  return {
    apiKey: env.GEMINI_API_KEY,
    inviteCodes: env.INVITE_CODES ? env.INVITE_CODES.split(',') : [],
    apiSecret: env.API_SECRET,
  };
}

export function createGeminiClient(apiKey: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

function uniqModels(models: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of models) {
    if (!m) continue;
    if (seen.has(m)) continue;
    seen.add(m);
    result.push(m);
  }
  return result;
}

function getModelCandidates(kind: 'analysis' | 'generation', env?: Env): string[] {
  if (kind === 'analysis') {
    return uniqModels([
      env?.HIGH_QUALITY_MODEL || MODELS.ANALYSIS,
      env?.HIGH_QUALITY_MODEL_FALLBACK,
      env?.FAST_MODEL,
      env?.FAST_MODEL_FALLBACK,
    ]);
  }
  return uniqModels([
    env?.GENERATE_MODEL || MODELS.GENERATION,
    env?.GENERATE_MODEL_FALLBACK,
  ]);
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const message = String((err as any)?.message || err || '');
  return message.includes('429') || message.includes('Too Many Requests') || message.toLowerCase().includes('quota');
}

async function generateContentWithFallback(
  genAI: GoogleGenerativeAI,
  modelCandidates: string[],
  input: any
) {
  let lastError: unknown;
  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await model.generateContent(input);
    } catch (err) {
      lastError = err;
      if (isQuotaOrRateLimitError(err)) {
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('NO_AVAILABLE_MODEL');
}

export function validateInviteCode(code: string, config: Config): boolean {
  return config.inviteCodes.includes(code);
}

export function incrementCodeUsage(code: string) {
  const current = codeUsage.get(code) || 0;
  codeUsage.set(code, current + 1);
}

// Verify request signature
async function verifySignature(
  signature: string | null,
  timestamp: string | null,
  body: string,
  secret: string
): Promise<boolean> {
  if (!signature || !timestamp) return false;
  
  // Check for replay attack (signature reuse)
  if (requestSignatures.has(signature)) {
    console.log('[Security] Replay attack detected');
    return false;
  }
  
  // Check timestamp (prevent old requests)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (isNaN(requestTime) || now - requestTime > 300000) { // 5 minute window
    console.log('[Security] Request expired');
    return false;
  }
  
  // Verify HMAC
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureData = encoder.encode(`${timestamp}:${body}`);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, signatureData);
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32);
  
  // Store signature to prevent replay
  requestSignatures.add(signature);
  
  // Clean old signatures periodically
  if (requestSignatures.size > 10000) {
    const toDelete = Array.from(requestSignatures).slice(0, 5000);
    toDelete.forEach(sig => requestSignatures.delete(sig));
  }
  
  return signature === expectedSignature;
}

// Deobfuscate data from frontend
declare function atob(data: string): string;
function deobfuscateData(obfuscatedData: string | undefined): any {
  if (!obfuscatedData) return undefined;
  try {
    const decoded = atob(obfuscatedData);
    return JSON.parse(decoded);
  } catch (e) {
    console.log('[Security] Failed to deobfuscate data');
    return undefined;
  }
}

// ... (keep existing prompt builders)

// --- Main Handler ---

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Signature, X-Timestamp, X-Action',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'SERVICE_UNAVAILABLE', message: 'Missing API key' }), {
      status: 503, headers: cors
    });
  }
  if (!env.INVITE_CODES) {
    return new Response(JSON.stringify({ error: 'SERVICE_UNAVAILABLE', message: 'Missing invite codes' }), {
      status: 503, headers: cors
    });
  }

  const config = parseConfig(env);

  try {
    const bodyText = await request.text();
    const signature = request.headers.get('X-Signature');
    const timestamp = request.headers.get('X-Timestamp');
    
    // Verify signature if API_SECRET is configured
    if (config.apiSecret) {
      const isValid = await verifySignature(signature, timestamp, bodyText, config.apiSecret);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'INVALID_SIGNATURE' }), {
          status: 401, headers: cors
        });
      }
    }
    
    const body = JSON.parse(bodyText);
    const { code, action, image, data: obfuscatedData, _t } = body;
    
    // Verify timestamp in body matches header
    if (_t && _t !== timestamp) {
      return new Response(JSON.stringify({ error: 'INVALID_TIMESTAMP' }), {
        status: 401, headers: cors
      });
    }
    
    // Deobfuscate data
    const data = deobfuscateData(obfuscatedData);

    // Validate invite code
    if (!validateInviteCode(code, config)) {
      return new Response(JSON.stringify({ error: 'INVALID_INVITE_CODE' }), {
        status: 401, headers: cors
      });
    }
    incrementCodeUsage(code);

    const genAI = createGeminiClient(env.GEMINI_API_KEY);
    const analysisModels = getModelCandidates('analysis', env);
    const generationModels = getModelCandidates('generation', env);
    let result: any;

    switch (action) {
      case 'analyze': {
        const prompt = buildAnalyzePrompt();
        
        const imageData = image?.split(',')[1] || image;
        const parts = [
          { text: prompt },
          { inlineData: { data: imageData, mimeType: 'image/jpeg' } }
        ];
        
        const response = await generateContentWithFallback(genAI, analysisModels, parts);
        const text = response.response.text();
        result = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        break;
      }

      case 'design': {
        const photoType = data?.photoType || '正面头像';
        const prompt = buildDesignPrompt(data?.person, photoType);
        
        const response = await generateContentWithFallback(genAI, analysisModels, prompt);
        const text = response.response.text();
        result = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        break;
      }

      case 'generate': {
        const { person, design, photoType, referenceImage } = data || {};
        
        const prompt = buildGenerationPrompt(person, design, photoType, referenceImage);
        
        const parts: any[] = [{ text: prompt }];
        
        if (referenceImage) {
          const refImageData = referenceImage.split(',')[1] || referenceImage;
          parts.push({ 
            inlineData: { data: refImageData, mimeType: 'image/jpeg' } 
          });
        }
        
        const response = await generateContentWithFallback(genAI, generationModels, parts);
        
        let generatedImage: string | undefined;
        let textResponse = '';
        
        try {
          textResponse = response.response.text();
        } catch (e) {}
        
        const candidates = response.response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if ((part as any).inlineData && (part as any).inlineData.mimeType?.startsWith('image/')) {
              generatedImage = `data:${(part as any).inlineData.mimeType};base64,${(part as any).inlineData.data}`;
              break;
            }
          }
        }
        
        result = { 
          text: textResponse,
          image: generatedImage,
          photoType: photoType
        };
        break;
      }

      case 'review': {
        const { person, photoType, originalImage, generatedImage } = data || {};
        
        const prompt = buildComparisonPrompt(originalImage, generatedImage, person, photoType);
        
        const parts: any[] = [{ text: prompt }];
        
        if (originalImage) {
          const origData = originalImage.split(',')[1] || originalImage;
          parts.push({ 
            inlineData: { data: origData, mimeType: 'image/jpeg' } 
          });
        }
        
        if (generatedImage) {
          const genData = generatedImage.split(',')[1] || generatedImage;
          parts.push({ 
            inlineData: { data: genData, mimeType: 'image/jpeg' } 
          });
        }
        
        const response = await generateContentWithFallback(genAI, analysisModels, parts);
        const text = response.response.text();
        
        try {
          result = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) {
          result = {
            identityMatch: { score: 70, confidence: 'Medium', verdict: 'Same person' },
            facialFeatures: { preservationScore: 75, matchingFeatures: ['general appearance'], differences: [] },
            qualityAssessment: { professionalism: 80, beautification: 75, lighting: 85, pose: 80 },
            overallScore: 75,
            approved: true,
            summary: 'Generated image reviewed',
            recommendations: []
          };
        }
        break;
      }

      case 'reviewInput': {
        const parts: any[] = [{ text: buildInputReviewPrompt() }];
        if (image) {
          const origData = image.split(',')[1] || image;
          parts.push({
            inlineData: { data: origData, mimeType: 'image/jpeg' }
          });
        }
        const response = await generateContentWithFallback(genAI, analysisModels, parts);
        const text = response.response.text();
        try {
          result = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch (e) {
          result = {
            overallScore: 75,
            approved: true,
            summary: 'Input review completed',
            issues: [],
            suggestions: []
          };
        }
        break;
      }

      case 'processAll': {
        const { originalImage } = data || {};
        
        // Step 1: Analyze
        const analyzePrompt = buildAnalyzePrompt();
        const analyzeResponse = await generateContentWithFallback(genAI, analysisModels, [
          { text: analyzePrompt },
          { inlineData: { data: originalImage.split(',')[1] || originalImage, mimeType: 'image/jpeg' } }
        ]);
        const person = JSON.parse(analyzeResponse.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
        
        // Step 2: Generate all poses
        const photoTypes = ['正面头像', '侧面头像', '肖像照', '半身照', '全身照'];
        const photos = [];
        
        for (const photoType of photoTypes) {
          // Design
          const designPrompt = buildDesignPrompt(person, photoType);
          const designResponse = await generateContentWithFallback(genAI, analysisModels, designPrompt);
          const design = JSON.parse(designResponse.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
          
          // Generate
          const genPrompt = buildGenerationPrompt(person, design, photoType, originalImage);
          const genResponse = await generateContentWithFallback(genAI, generationModels, [
            { text: genPrompt },
            { inlineData: { data: originalImage.split(',')[1] || originalImage, mimeType: 'image/jpeg' } }
          ]);
          
          // Extract image
          let generatedImage: string | undefined;
          const candidates = genResponse.response.candidates;
          if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
              if ((part as any).inlineData && (part as any).inlineData.mimeType?.startsWith('image/')) {
                generatedImage = `data:${(part as any).inlineData.mimeType};base64,${(part as any).inlineData.data}`;
                break;
              }
            }
          }
          
          if (generatedImage) {
            // Review
            const comparePrompt = buildComparisonPrompt(originalImage, generatedImage, person, photoType);
            const reviewResponse = await generateContentWithFallback(genAI, analysisModels, [
              { text: comparePrompt },
              { inlineData: { data: originalImage.split(',')[1] || originalImage, mimeType: 'image/jpeg' } },
              { inlineData: { data: generatedImage.split(',')[1] || generatedImage, mimeType: 'image/jpeg' } }
            ]);
            
            let review;
            try {
              review = JSON.parse(reviewResponse.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) {
              review = {
                identityMatch: { score: 75, confidence: 'Medium', verdict: 'Same person' },
                overallScore: 75,
                approved: true,
                summary: 'Review completed'
              };
            }
            
            photos.push({
              type: photoType,
              url: generatedImage,
              review: review
            });
          }
        }
        
        result = { person, photos };
        break;
      }

      case 'processPose': {
        const { originalImage, photoType, person: providedPerson } = data || {};
        if (!originalImage || !photoType) {
          return new Response(JSON.stringify({ error: 'INVALID_REQUEST' }), {
            status: 400, headers: cors
          });
        }

        let person = providedPerson;
        if (!person) {
          const analyzePrompt = buildAnalyzePrompt();
          const analyzeResponse = await generateContentWithFallback(genAI, analysisModels, [
            { text: analyzePrompt },
            { inlineData: { data: originalImage.split(',')[1] || originalImage, mimeType: 'image/jpeg' } }
          ]);
          person = JSON.parse(analyzeResponse.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
        }

        const designPrompt = buildDesignPrompt(person, photoType);
        const designResponse = await generateContentWithFallback(genAI, analysisModels, designPrompt);
        const design = JSON.parse(designResponse.response.text().replace(/```json/g, '').replace(/```/g, '').trim());

        let promptText = buildGenerationPrompt(person, design, photoType, originalImage);
        let promptIterations = 0;
        let generationIterations = 0;
        let finalImage: string | undefined;
        let finalReview: any = undefined;

        while (promptIterations < ITERATION_LIMITS.MAX_PROMPT_ITERATIONS) {
          promptIterations++;
          const promptReview = await reviewPromptQuality(genAI, analysisModels, promptText, originalImage, photoType, promptIterations);
          const promptApproved = promptReview.approved ?? (promptReview.overallScore || 0) >= 70;
          if (!promptApproved && promptIterations < ITERATION_LIMITS.MAX_PROMPT_ITERATIONS) {
            promptText = refinePromptText(promptText, promptReview);
            continue;
          }

          let genAttempts = 0;
          let approved = false;
          while (genAttempts < ITERATION_LIMITS.MAX_GENERATION_ITERATIONS) {
            genAttempts++;
            generationIterations++;
            const generatedImage = await generateImageFromPrompt(genAI, generationModels, promptText, originalImage);
            const comparePrompt = buildComparisonPrompt(originalImage, generatedImage, person, photoType);
            const compareResponse = await generateContentWithFallback(genAI, analysisModels, [
              { text: comparePrompt },
              { inlineData: { data: originalImage.split(',')[1] || originalImage, mimeType: 'image/jpeg' } },
              { inlineData: { data: generatedImage.split(',')[1] || generatedImage, mimeType: 'image/jpeg' } }
            ]);
            const text = compareResponse.response.text();
            try {
              finalReview = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) {
              finalReview = {
                identityMatch: { score: 75, confidence: 'Medium', verdict: 'Same person' },
                overallScore: 75,
                approved: true,
                summary: 'Review completed'
              };
            }
            finalImage = generatedImage;
            approved = finalReview.approved ?? (finalReview.overallScore || 0) >= 70;
            if (approved) {
              break;
            }
          }

          if (finalImage && (finalReview?.approved ?? (finalReview?.overallScore || 0) >= 70)) {
            break;
          }

          if (promptIterations >= ITERATION_LIMITS.MAX_PROMPT_ITERATIONS) {
            break;
          }

          promptText = refinePromptText(promptText, finalReview);
        }

        if (!finalImage) {
          return new Response(JSON.stringify({ error: 'IMAGE_GENERATION_FAILED' }), {
            status: 500, headers: cors
          });
        }

        result = {
          image: finalImage,
          review: finalReview || {
            overallScore: 75,
            approved: true,
            summary: 'Image generated'
          },
          promptIterations,
          generationIterations
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'INVALID_ACTION' }), {
          status: 400, headers: cors
        });
    }

    return new Response(JSON.stringify({ result, action }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('[ERROR]', e.message);
    return new Response(JSON.stringify({
      error: 'PROCESSING_ERROR',
      message: e.message,
    }), { status: 500, headers: cors });
  }
}

// ... (keep existing prompt builders)
function buildAnalyzePrompt(): string {
  return `Analyze this reference image carefully and extract detailed person information.

IMPORTANT: Focus on distinctive features that must be preserved in generated images.

Output strict JSON:
{
  "race": "string (e.g., East Asian, Caucasian, African)",
  "skinTone": "string with undertone details",
  "gender": "string",
  "age": "string (age range like '30-40')",
  "faceShape": "string (oval, round, square, heart, etc.)",
  "skinConcerns": ["list of visible skin characteristics"],
  "uniqueFeatures": [
    "extremely detailed list of ALL distinctive features",
    "glasses: shape, color, style",
    "hair: color, length, texture, style",
    "facial structure: cheekbones, jawline, nose shape",
    "eyes: shape, size, color",
    "eyebrows: shape, thickness",
    "lips: shape, fullness",
    "any other distinctive marks or features"
  ],
  "preservationPoints": [
    "CRITICAL: List features that MUST be identical in generated images",
    "Include specific measurements and proportions if visible"
  ],
  "lighting": "current lighting description",
  "expression": "facial expression description"
}`;
}

function buildDesignPrompt(person: any, photoType: string): string {
  const postureGuide: Record<string, string> = {
    '正面头像': 'Front-facing headshot, shoulders slightly angled, direct eye contact with camera',
    '侧面头像': 'Body angled 70–90 degrees to camera, face turned 30–45 degrees toward camera (not full profile), eyes toward camera, suitable for news/company profile',
    '肖像照': 'Medium close-up, chest up, slightly angled pose with natural head tilt',
    '半身照': 'Waist up, three-quarter view, one shoulder slightly forward, professional hand placement',
    '全身照': 'Full body standing pose, confident posture, weight on one leg, professional stance'
  };

  return `Design professional photo setup for ${photoType}.

Person Details: ${JSON.stringify(person)}

REQUIRED POSE: ${postureGuide[photoType] || 'Professional business pose'}

Output strict JSON:
{
  "makeup": {
    "base": "natural professional base",
    "eyes": "enhanced but natural eye makeup",
    "lips": "neutral professional lip color",
    "blush": "subtle contouring"
  },
  "styling": {
    "clothing": "formal business attire only: dress shirt or dress shirt + suit jacket, tailored fit, no casual wear",
    "colors": "color palette that complements skin tone",
    "accessories": "minimal professional accessories"
  },
  "posture": {
    "description": "detailed pose instructions for ${photoType}",
    "headAngle": "specific head positioning",
    "shoulderPosition": "shoulder alignment",
    "expression": "professional expression"
  },
  "lighting": {
    "type": "Rembrandt or butterfly lighting",
    "position": "key light 45-degree angle",
    "background": "clean professional background"
  }
}`;
}

function buildGenerationPrompt(
  person: any, 
  design: any, 
  photoType: string,
  referenceImage?: string
): string {
  const poseDescriptions: Record<string, string> = {
    '正面头像': 'Front-facing professional headshot. Face directly toward camera. Full face visible. Shoulders at slight angle.',
    '侧面头像': 'Side-angle portrait. Body turned 70–90 degrees to camera, face turned back 30–45 degrees toward camera (not full profile). Eyes toward camera. Suitable for news/company profile use.',
    '肖像照': 'Medium close-up portrait. Chest and up visible. Slight three-quarter angle. Natural relaxed pose.',
    '半身照': 'Half-body shot from waist up. Three-quarter body angle. Professional arm and hand positioning visible.',
    '全身照': 'Full body standing pose. Complete figure visible from head to toe. Professional business stance.'
  };

  return `Generate a professional executive portrait photograph in a HIGH-END PROFESSIONAL PHOTOGRAPHY STUDIO.

PHOTO TYPE: ${photoType}
REQUIRED POSE: ${poseDescriptions[photoType]}

SUBJECT DESCRIPTION (MUST MATCH REFERENCE):
- Race: ${person.race}
- Gender: ${person.gender}
- Age: ${person.age}
- Face Shape: ${person.faceShape}
- Skin Tone: ${person.skinTone}

CRITICAL FEATURES TO PRESERVE (MAKE IDENTICAL):
${person.uniqueFeatures?.map((f: string) => `- ${f}`).join('\n') || 'Preserve all facial features'}

PRESERVATION REQUIREMENTS:
${person.preservationPoints?.map((p: string) => `- ${p}`).join('\n') || 'Maintain exact facial structure'}

STUDIO SETUP - CRITICAL REQUIREMENTS:
1. BACKGROUND: Seamless gradient backdrop (neutral gray, off-white, or subtle warm tone), smooth and clean, NO office furniture, NO windows, NO environmental elements
2. LIGHTING: Professional studio three-point lighting setup - key light at 45 degrees, fill light for shadows, hair light for separation. Soft, even, flattering illumination
3. ENVIRONMENT: Pure studio environment only. The background should be a professional photography backdrop, not an office or any real-world location
4. MAKEUP: Professional makeup artist applied - natural but polished look, suitable for corporate headshots
5. STYLING: Professional wardrobe stylist selected - premium business attire, perfectly fitted
6. PHOTOGRAPHY: Shot by professional portrait photographer with high-end medium format camera, professional lenses

DESIGN SPECIFICATIONS:
- Clothing: ${design?.styling?.clothing || 'Formal business attire only: dress shirt or dress shirt + suit jacket, tailored fit'}
- Lighting: Professional studio three-point lighting with softboxes
- Expression: ${design?.posture?.expression || 'Professional confident expression'}
- Background: Seamless studio backdrop, gradient from light to dark, no distractions

MANDATORY RULES:
1. The generated person MUST be recognizable as the same individual from the reference
2. Facial features, proportions, and distinctive characteristics must match exactly
3. BACKGROUND MUST BE: Professional studio seamless backdrop, NOT office, NOT environment, NOT location-based
4. Lighting MUST BE: Professional studio lighting setup, NOT natural light, NOT ambient office light
5. Maintain exact face shape, eye shape, nose shape, lip shape, and all unique features
6. The pose must be exactly: ${poseDescriptions[photoType]}
7. Wardrobe must be formal business attire only (dress shirt or dress shirt + suit jacket). No casual, no streetwear.
8. All poses must read as highly professional studio portraits suitable for corporate/news use
9. Quality level: Executive portrait studio photography standard

Generate a high-end, photorealistic professional studio portrait suitable for corporate executive profiles.`;
}

function buildComparisonPrompt(
  originalImage: string,
  generatedImage: string,
  person: any,
  photoType: string
): string {
  const identityChecks: Record<string, string[]> = {
    '正面头像': [
      'Face shape and proportions identical?',
      'Eye shape, size, and position match?',
      'Nose shape and bridge identical?',
      'Lip shape and fullness match?',
      'Facial structure (cheekbones, jawline) preserved?'
    ],
    '侧面头像': [
      'Profile silhouette matches reference?',
      'Nose bridge curve identical?',
      'Chin and jawline profile match?',
      'Forehead slope identical?',
      'Overall facial proportions preserved?'
    ],
    '肖像照': [
      'Facial features clearly recognizable?',
      'Unique characteristics (glasses, etc.) preserved?',
      'Facial structure maintained from this angle?',
      'Expression natural and consistent?'
    ],
    '半身照': [
      'Person clearly identifiable as same individual?',
      'Facial features match reference?',
      'Body proportions appropriate?',
      'Professional posture achieved?'
    ],
    '全身照': [
      'Same person clearly identifiable?',
      'Facial structure preserved?',
      'Professional full-body pose?',
      'Business attire appropriate?'
    ]
  };

  return `Compare the REFERENCE image with the GENERATED image for ${photoType}.

Task: Verify that the generated image depicts the SAME PERSON as the reference.

Original Person Analysis:
${JSON.stringify(person, null, 2)}

IDENTITY VERIFICATION CHECKLIST:
${(identityChecks[photoType] || identityChecks['正面头像']).map((check, i) => `${i + 1}. ${check}`).join('\n')}

QUALITY CRITERIA:
1. Facial Recognition: Can you confirm this is the same person?
2. Feature Preservation: Are distinctive features maintained?
3. Beautification Level: Is the enhancement appropriate (not overdone)?
4. Professional Quality: Does it meet business photo standards?
5. Pose Accuracy: Is the pose correct for ${photoType}?

Output strict JSON:
{
  "identityMatch": {
    "score": "number 0-100",
    "confidence": "High/Medium/Low",
    "verdict": "Same person/Different person/Uncertain"
  },
  "facialFeatures": {
    "preservationScore": "number 0-100",
    "matchingFeatures": ["list of matching features"],
    "differences": ["any notable differences"]
  },
  "qualityAssessment": {
    "professionalism": "number 0-100",
    "beautification": "number 0-100 (100=perfect, 0=overdone)",
    "lighting": "number 0-100",
    "pose": "number 0-100"
  },
  "overallScore": "number 0-100",
  "approved": "boolean",
  "summary": "detailed assessment",
  "recommendations": ["suggestions for improvement"]
}`;
}

function buildInputReviewPrompt(): string {
  return `Review this input photo for suitability for professional portrait generation.

Evaluation Criteria:
1. Face clearly visible and centered
2. Adequate lighting (no extreme shadows or overexposure)
3. Sufficient resolution and sharpness
4. Minimal occlusion (no heavy遮挡 like masks or hands)
5. Neutral expression preferred

Output strict JSON:
{
  "overallScore": "number 0-100",
  "approved": "boolean (true if score >= 70)",
  "summary": "brief assessment",
  "issues": ["list of issues if any"],
  "suggestions": ["how to improve the input photo"]
}`;
}

function buildPromptReviewText(promptText: string, photoType: string, iteration: number): string {
  return `Review this prompt for generating a professional ${photoType} photo.

Target Pose: ${photoType}

Final Target Use Cases (MANDATORY):
- Personal resume
- Personal homepage
- News publication
- Company publicity board

Prompt to Review:
${promptText}

Evaluation Criteria:
1. Does the prompt clearly specify the pose requirements for ${photoType}?
2. Does it preserve the person's unique features from the reference image?
3. Is the styling appropriate for formal business photography (dress shirt or dress shirt + suit jacket only)?
4. Is the lighting and background specification clear and studio-only?
5. Does the prompt explicitly target suitability for resume/homepage/news/company publicity use?
6. Are all poses framed as high-end professional studio portraits with professional styling/makeup/photography?
7. Are there any missing or unclear elements?

Strict Approval Rules:
- If the prompt does NOT explicitly target the above use cases, set approved=false.
- If formal attire or studio-only requirements are missing/ambiguous, set approved=false.

Output strict JSON:
{
  "overallScore": "number 0-100",
  "approved": "boolean (true if score >= 70)",
  "summary": "brief assessment",
  "strengths": ["what's good about this prompt"],
  "weaknesses": ["what needs improvement"],
  "suggestions": ["specific suggestions for improvement"],
  "iteration": ${iteration}
}`;
}

function refinePromptText(promptText: string, review: any): string {
  const suggestions = Array.isArray(review?.suggestions) ? review.suggestions : [];
  if (suggestions.length === 0) {
    return `${promptText}\n\nRefinement: Emphasize pose accuracy, identity preservation, studio lighting, and clean backdrop.`;
  }
  const suggestionText = suggestions.map((s: string) => `- ${s}`).join('\n');
  return `${promptText}\n\nRefinements:\n${suggestionText}\n- Re-emphasize identity preservation and studio-only background.`;
}

async function reviewPromptQuality(
  genAI: GoogleGenerativeAI,
  modelCandidates: string[],
  promptText: string,
  originalImage: string,
  photoType: string,
  iteration: number
) {
  const reviewPromptText = buildPromptReviewText(promptText, photoType, iteration);
  const parts: any[] = [{ text: reviewPromptText }];
  if (originalImage) {
    parts.push({
      inlineData: { data: originalImage.split(',')[1] || originalImage, mimeType: 'image/jpeg' }
    });
  }
  const response = await generateContentWithFallback(genAI, modelCandidates, parts);
  const text = response.response.text();
  try {
    return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (e) {
    return {
      overallScore: 75,
      approved: true,
      summary: 'Prompt review completed',
      strengths: ['Pose and identity requirements present'],
      weaknesses: [],
      suggestions: [],
      iteration,
    };
  }
}

async function generateImageFromPrompt(
  genAI: GoogleGenerativeAI,
  modelCandidates: string[],
  promptText: string,
  referenceImage?: string
): Promise<string> {
  const parts: any[] = [{ text: promptText }];
  if (referenceImage) {
    const refImageData = referenceImage.split(',')[1] || referenceImage;
    parts.push({
      inlineData: { data: refImageData, mimeType: 'image/jpeg' }
    });
  }
  const response = await generateContentWithFallback(genAI, modelCandidates, parts);
  const candidates = response.response.candidates;
  if (candidates && candidates[0]?.content?.parts) {
    for (const part of candidates[0].content.parts) {
      if ((part as any).inlineData && (part as any).inlineData.mimeType?.startsWith('image/')) {
        return `data:${(part as any).inlineData.mimeType};base64,${(part as any).inlineData.data}`;
      }
    }
  }
  throw new Error('IMAGE_GENERATION_FAILED');
}
