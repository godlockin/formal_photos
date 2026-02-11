import type { Person, Design, Photo, ReviewResult } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api/gemini';

// --- 图片压缩 ---

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const COMPRESS_QUALITY = 0.85;
const MAX_DIMENSION = 2048;

/**
 * 压缩图片到指定大小以下
 */
export async function compressImage(file: File, maxSizeMB: number = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 计算新的尺寸
        let { width, height } = img;
        const maxDim = MAX_DIMENSION;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        // 创建 canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // 尝试不同的质量等级直到达到目标大小
        let quality = COMPRESS_QUALITY;
        const tryCompress = () => {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const sizeInMB = (dataUrl.length * 3) / 4 / 1024 / 1024;

          if (sizeInMB > maxSizeMB && quality > 0.3) {
            quality -= 0.1;
            tryCompress();
          } else {
            console.log(`[Image] Compressed: ${(file.size / 1024 / 1024).toFixed(1)}MB -> ${sizeInMB.toFixed(1)}MB, quality: ${quality}`);
            resolve(dataUrl);
          }
        };
        tryCompress();
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 处理文件：如果是图片则压缩
 */
export async function processFile(file: File): Promise<string> {
  // 如果文件小于 2MB 且是 JPEG/PNG，直接返回
  if (file.size <= MAX_IMAGE_SIZE && (file.type === 'image/jpeg' || file.type === 'image/png')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  // 否则压缩
  return compressImage(file, 2);
}

// --- 异步任务轮询 ---

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  action: string;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 提交异步任务
 */
export async function submitJob(action: string, image?: string, data?: any): Promise<{ jobId: string; status: string }> {
  return callAPI<{ jobId: string; status: string }>('submitJob', image, { action, image, data });
}

/**
 * 获取任务状态
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return callAPI<JobStatus>('getJobStatus', undefined, { jobId });
}

/**
 * 轮询任务直到完成
 */
export async function pollJobUntilComplete(
  jobId: string,
  onProgress?: (status: JobStatus) => void,
  pollInterval: number = 3000,
  maxAttempts: number = 200 // 最多轮询 200 次 (约 10 分钟)
): Promise<any> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getJobStatus(jobId);

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed') {
      return status.result;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || '任务处理失败');
    }

    // 等待后再次查询
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;
  }

  throw new Error('任务处理超时，请稍后刷新页面查看结果');
}

/**
 * 异步处理单个姿势（提交任务 + 轮询）
 */
export async function processPoseAsync(
  originalImage: string,
  photoType: string,
  person?: Person,
  onProgress?: (status: JobStatus) => void
): Promise<{
  image: string;
  review: ReviewResult;
  promptIterations: number;
  generationIterations: number;
}> {
  // 提交任务
  const { jobId } = await submitJob('processPose', undefined, {
    originalImage,
    photoType,
    person,
  });

  console.log(`[Async] Job submitted: ${jobId}`);

  // 轮询等待结果
  const result = await pollJobUntilComplete(jobId, onProgress);

  return result;
}

function getCode(): string {
  return localStorage.getItem('invite_code') || '';
}

interface APIResponse<T> {
  result: T;
  action: string;
  codeType?: string;
  error?: string;
}

async function callAPI<T>(action: string, image?: string, data?: any, timeoutMs: number = 300000): Promise<T> {
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
  console.log(`[Client] Sending request: ${action}, Image size: ${image?.length || 0}, Body size: ${body.length}`);

  // 创建 AbortController 用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      // 尝试解析错误响应，如果不是 JSON 则使用文本
      let err: any;
      const contentType = res.headers.get('content-type') || '';
      const responseText = await res.text();

      if (contentType.includes('application/json')) {
        try {
          err = JSON.parse(responseText);
        } catch {
          err = { error: responseText || `HTTP ${res.status}` };
        }
      } else {
        // 非 JSON 响应（可能是 Cloudflare 错误页面）
        err = { error: `服务暂时不可用 (HTTP ${res.status})`, details: responseText.slice(0, 200) };
      }

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
      throw new Error(err.error || `请求失败 (HTTP ${res.status})`);
    }

    const bodyJson: APIResponse<T> = await res.json();
    if (bodyJson.error) {
      throw new Error(bodyJson.error);
    }
    return bodyJson.result;
  } catch (e: any) {
    clearTimeout(timeoutId);

    // 处理 AbortController 超时
    if (e.name === 'AbortError') {
      throw new Error(`请求超时，请稍后重试 (${Math.round(timeoutMs / 1000)}秒)`);
    }

    // 处理网络错误（Failed to fetch）
    if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
      console.error('[API] Network error:', e);
      throw new Error('网络连接失败，请检查网络后重试');
    }

    throw e;
  }
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
  // processAll 需要处理多个姿势，使用 300 秒超时
  const result = await callAPI<{
    person: Person;
    photos: Array<{
      type: string;
      url: string;
      review: ReviewResult;
    }>;
  }>('processAll', undefined, { originalImage: image }, 300000);

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
  // processPose 可能需要 60-120 秒，使用 180 秒超时
  return callAPI<{
    image: string;
    review: ReviewResult;
    promptIterations: number;
    generationIterations: number;
  }>('processPose', undefined, {
    originalImage,
    photoType,
    person,
  }, 180000);
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
