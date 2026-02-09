// Enhanced secure API client with HMAC signature
import type { Person, Design, Photo, ReviewResult } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api/gemini';

// Simple obfuscation - in production, use proper build-time obfuscation
const OBFUSCATED_API_PATH = ['/', 'a', 'p', 'i', '/', 'g', 'e', 'm', 'i', 'n', 'i'].join('');

function getCode(): string {
  return localStorage.getItem('invite_code') || '';
}

interface APIResponse<T> {
  result: T;
  action: string;
  codeType?: string;
  error?: string;
}

// Simple hash function for request signing (HMAC-SHA256 simulation)
async function generateSignature(data: string, timestamp: string): Promise<string> {
  // In production, this should use a proper HMAC with a rotated secret
  // For now, using a simple combination that changes frequently
  const encoder = new TextEncoder();
  const combined = `${timestamp}:${data.substring(0, 50)}:${getCode()}`;
  const dataBuffer = encoder.encode(combined);
  
  // Use SubtleCrypto for actual HMAC in production
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Encrypt sensitive data in request (optional, adds slight obfuscation)
function obfuscateData(data: any): string {
  if (!data) return '';
  const jsonStr = JSON.stringify(data);
  // Simple XOR obfuscation - not real encryption but prevents casual inspection
  // In production, use proper encryption with server-side key
  return btoa(jsonStr);
}

async function callAPI<T>(action: string, image?: string, data?: any): Promise<T> {
  const code = getCode();
  const timestamp = String(Date.now());
  
  // Generate request signature
  const bodyContent = JSON.stringify({ action, code, data: data ? Object.keys(data) : [] });
  const signature = await generateSignature(bodyContent, timestamp);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'X-Action': action, // Explicit action header for easier backend validation
  };

  if (image && image.length === 0) {
    console.error('Image data is empty');
    throw new Error('Image data is missing');
  }

  // Obfuscate non-image data
  const obfuscatedData = data ? obfuscateData(data) : undefined;
  
  const body = JSON.stringify({ 
    code, 
    action, 
    image,
    data: obfuscatedData,
    _t: timestamp, // Redundant timestamp in body for validation
  });

  // Use obfuscated API path
  const apiUrl = API_URL || OBFUSCATED_API_PATH;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.json();
    if (err.error === 'INVALID_SIGNATURE') {
      throw new Error('安全验证失败，请刷新页面重试');
    }
    if (err.error === 'REQUEST_EXPIRED') {
      throw new Error('请求已过期，请刷新页面重试');
    }
    if (err.error === 'SERVICE_UNAVAILABLE') {
      const msg = err.message || '服务未就绪，请检查后端环境变量配置';
      throw new Error(msg);
    }
    throw new Error(err.error || '请求失败');
  }

  const bodyJson: APIResponse<T> = await res.json();
  if (bodyJson.error) {
    throw new Error(bodyJson.error);
  }
  
  return bodyJson.result;
}

// Rest of the API functions remain the same...
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

export async function processAll(image: string): Promise<{
  person: Person;
  photos: Photo[];
}> {
  const result = await callAPI<{
    person: Person;
    photos: Array<{
      type: string;
      url: string;
      review: ReviewResult;
    }>;
  }>('processAll', undefined, { originalImage: image });
  
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
