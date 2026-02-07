import type { Person, Design, Prompt, Photo, ReviewResult, ExpertRole } from './types';

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

  const body = JSON.stringify({ code, action, image, data });

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
    throw new Error(err.error || '请求失败');
  }

  const bodyJson: APIResponse<T> = await res.json();
  if (bodyJson.error) throw new Error(bodyJson.error);
  return bodyJson.result;
}

export async function analyze(image: string): Promise<Person> {
  return callAPI<Person>('analyze', image);
}

export async function design(person: Person): Promise<Design> {
  return callAPI<Design>('design', undefined, person);
}

export async function buildPrompt(person: Person, design: Design): Promise<Prompt> {
  return callAPI<Prompt>('buildPrompt', undefined, { person, design });
}

export async function review(content: string, image?: string): Promise<ReviewResult> {
  return callAPI<ReviewResult>('review', image, { content });
}

export async function generate(prompt: Prompt, type: string): Promise<string> {
  return callAPI<string>('generate', undefined, { ...prompt, type });
}

export async function finalCheck(image: string, person: Person, prompt: Prompt): Promise<ReviewResult> {
  return callAPI<ReviewResult>('finalCheck', image, { person, prompt });
}

export async function processAll(image: string): Promise<{
  person: Person;
  designResult: Design;
  prompt: Prompt;
  photos: Photo[];
}> {
  const person = await analyze(image);
  const designResult = await design(person);
  const generatedPrompt = await buildPrompt(person, designResult);

  const types = ['正面头像', '侧面头像', '肖像照', '半身照', '全身照'];
  const photos: Photo[] = [];

  for (const type of types) {
    const url = await generate(generatedPrompt, type);
    const photoReview = await review(`类型:${type}`, url);
    photos.push({
      id: `${type}-${Date.now()}`,
      type,
      url,
      approved: photoReview.approved,
      review: photoReview,
    });
  }

  return { person, designResult, prompt: generatedPrompt, photos };
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
}
