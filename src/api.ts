import type { Person, Prompt, Photo } from './types';

// Cloudflare Pages Functions 端点
const API_URL = import.meta.env.VITE_API_URL || '/api/gemini';

// 从本地存储获取邀请码
function getCode(): string {
  return localStorage.getItem('invite_code') || '';
}

async function callAPI(action: string, image?: string, data?: any): Promise<string> {
  const code = getCode();
  
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, action, image, data }),
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
    throw new Error(err.error || '请求失败');
  }

  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

// 1. 分析人物
export async function analyze(image: string): Promise<Person> {
  return JSON.parse(await callAPI('analyze', image));
}

// 2. 构建Prompt
export async function buildPrompt(person: Person): Promise<Prompt> {
  return JSON.parse(await callAPI('buildPrompt', undefined, person));
}

// 3. 专家评审
export async function review(content: string, image?: string) {
  return JSON.parse(await callAPI('review', image, { content }));
}

// 4. 生成照片
export async function generate(prompt: Prompt, type: string): Promise<string> {
  return await callAPI('generate', undefined, { prompt, type });
}

// 5. 完整流程
export async function process(image: string) {
  const person = await analyze(image);
  const prompt = await buildPrompt(person);
  
  const r = await review(`Prompt:${JSON.stringify(prompt)} Person:${JSON.stringify(person)}`);
  if (!r.approved) throw new Error(`评审未通过(${r.overallScore}分)`);

  const types = ['正面头像', '侧面头像', '肖像照', '半身照', '全身照'];
  const photos: Photo[] = [];
  
  for (const t of types) {
    const url = await generate(prompt, t);
    const pr = await review(`类型:${t}`, url);
    photos.push({
      id: `${t}-${Date.now()}`,
      type: t,
      url,
      approved: pr.overallScore >= 80,
      review: { score: pr.overallScore, comments: pr.summary, approved: pr.overallScore >= 80 },
    });
  }
  
  return { person, prompt, photos };
}

// 邀请码管理
export function setInviteCode(code: string) {
  localStorage.setItem('invite_code', code.toUpperCase());
}

export function getInviteCode(): string {
  return localStorage.getItem('invite_code') || '';
}

export function hasInviteCode(): boolean {
  return !!getInviteCode();
}
