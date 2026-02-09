import type { Person, Design, Photo, ReviewResult } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api/gemini';

function getCode(): string {
  return localStorage.getItem('invite_code') || '';
}

interface APIResponse<T> {
  result: T;
  action: string;
  codeType?: string;
  error?: string;
}

async function callAPI<T>(action: string, image?: string, data?: any): Promise<T> {
  const code = getCode();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Timestamp': String(Date.now()),
  };

  if (image && image.length === 0) {
    console.error('Image data is empty');
    throw new Error('Image data is missing');
  }

  const body = JSON.stringify({ code, action, image, data });
  console.log(`[Client] Sending request: ${action}, Image size: ${image?.length || 0}`);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.json();
    if (err.error === 'INVITE_CODE_REQUIRED') {
      throw new Error('请输入邀请码');
    }
    if (err.error === 'INVALID_INVITE_CODE') {
      throw new Error('邀请码无效');
    }
    if (err.error === 'INVITE_CODE_EXHAUSTED') {
      throw new Error('邀请码已用完');
    }
    if (err.error === 'RATE_LIMIT_EXCEEDED') {
      const retryAfter = err.retryAfter || 60;
      throw new Error(`请求过于频繁，请${retryAfter}秒后重试`);
    }
    if (err.error === 'INVALID_SIGNATURE') {
      throw new Error('请求验证失败');
    }
    if (err.error === 'REQUEST_EXPIRED') {
      throw new Error('请求已过期，请刷新页面重试');
    }
    if (err.error === 'SERVICE_UNAVAILABLE') {
      const msg = err.message || '服务未就绪，请检查后端环境变量配置';
      throw new Error(msg);
    }
    if (err.details) {
      throw new Error(`${err.error}: ${err.details}`);
    }
    throw new Error(err.error || '请求失败');
  }

  const bodyJson: APIResponse<T> = await res.json();
  if (bodyJson.error) {
    throw new Error(bodyJson.error);
  }
  return bodyJson.result;
}

// 存储原始图片用于后续对比
let cachedOriginalImage: string | null = null;
let cachedPerson: Person | null = null;

export function setOriginalImage(image: string) {
  cachedOriginalImage = image;
}

export function getOriginalImage(): string | null {
  return cachedOriginalImage;
}

export function setCachedPerson(person: Person) {
  cachedPerson = person;
}

export function getCachedPerson(): Person | null {
  return cachedPerson;
}

export async function analyze(image: string): Promise<Person> {
  const person = await callAPI<Person>('analyze', image);
  cachedPerson = person;
  cachedOriginalImage = image;
  return person;
}

export async function reviewInput(image: string): Promise<ReviewResult> {
  return callAPI<ReviewResult>('reviewInput', image);
}

export async function design(person: Person, photoType: string): Promise<Design> {
  return callAPI<Design>('design', undefined, { person, photoType });
}

export async function generate(
  person: Person, 
  design: Design, 
  photoType: string,
  referenceImage: string
): Promise<{ image: string; text?: string }> {
  return callAPI<{ image: string; text?: string }>('generate', undefined, {
    person,
    design,
    photoType,
    referenceImage
  });
}

export async function review(
  person: Person,
  photoType: string,
  originalImage: string,
  generatedImage: string
): Promise<ReviewResult> {
  return callAPI<ReviewResult>('review', undefined, {
    person,
    photoType,
    originalImage,
    generatedImage
  });
}


// 完整的处理流程 - 批量处理所有姿势
export async function processAll(image: string): Promise<{
  person: Person;
  photos: Photo[];
}> {
  // 使用后端批量处理
  const result = await callAPI<{
    person: Person;
    photos: Array<{
      type: string;
      url: string;
      review: ReviewResult;
    }>;
  }>('processAll', undefined, { originalImage: image });
  
  // 转换为Photo格式
  const photos: Photo[] = result.photos.map(p => ({
    id: `${p.type}-${Date.now()}`,
    type: p.type,
    url: p.url,
    approved: p.review?.approved ?? true,
    review: p.review || {
      reviews: [],
      consensusScore: 75,
      approved: true,
      summary: '批量处理完成'
    }
  }));
  
  cachedPerson = result.person;
  cachedOriginalImage = image;
  
  return { person: result.person, photos };
}

// 保留旧API以保持兼容性
export async function processPose(
  originalImage: string,
  photoType: string,
  person?: Person
): Promise<{
  image: string;
  review: ReviewResult;
  promptIterations: number;
  generationIterations: number;
}> {
  return callAPI<{
    image: string;
    review: ReviewResult;
    promptIterations: number;
    generationIterations: number;
  }>('processPose', undefined, {
    originalImage,
    photoType,
    person,
  });
}

export function setInviteCode(code: string): void {
  localStorage.setItem('invite_code', code.toUpperCase());
}

export function getInviteCode(): string {
  return localStorage.getItem('invite_code') || '';
}

export function hasInviteCode(): boolean {
  return !!getInviteCode();
}

export function clearInviteCode(): void {
  localStorage.removeItem('invite_code');
  cachedOriginalImage = null;
  cachedPerson = null;
}
