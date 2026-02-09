import { useState, useEffect, useCallback, useRef } from 'react';
import { analyze, reviewInput, processPose, setOriginalImage, clearInviteCode } from './api';
import { useWorkflowStore } from './store';
import type { Person, Photo, ReviewResult } from './types';

const PHOTO_TYPES = [
  { id: '正面头像', label: '正面头像', desc: '标准证件照视角' },
  { id: '侧面头像', label: '侧面头像', desc: '90度侧面轮廓' },
  { id: '肖像照', label: '肖像照', desc: '胸部以上特写' },
  { id: '半身照', label: '半身照', desc: '腰部以上半身' },
  { id: '全身照', label: '全身照', desc: '全身职业形象' },
];

// 处理步骤
interface ProcessingStep {
  name: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

// 姿势处理状态
interface PoseState {
  type: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  progress: number;
  step: number; // 当前步骤索引
  promptIteration: number; // Prompt重构迭代次数
  generationIteration: number; // 生成迭代次数
  photo?: Photo;
  currentReview?: ReviewResult;
  error?: string;
  steps: ProcessingStep[];
}

// Review Panel Component
function ReviewPanel({ review, title }: { review: ReviewResult | null; title?: string }) {
  if (!review) return <div className="text-gray-400 text-sm">审核中...</div>;
  
  const score = review.overallScore || review.consensusScore || 0;
  const isApproved = review.approved || score >= 70;
  const iterations = review.iteration || 1;
  
  return (
    <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-3 text-sm">
      {title && <div className="font-medium text-[#4a433a] mb-1">{title}</div>}
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${isApproved ? 'text-[#2a6d4f]' : 'text-[#7a5a2e]'}`}>
          {score}分
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isApproved ? 'bg-[#dff1e8] text-[#2a6d4f]' : 'bg-[#f3e7d2] text-[#7a5a2e]'}`}>
          {isApproved ? '通过' : '需优化'}
        </span>
        {iterations > 1 && (
          <span className="text-xs text-[#6b6256]">第{iterations}轮</span>
        )}
      </div>
      {review.summary && (
        <div className="text-xs text-[#6b6256] mt-1 line-clamp-2">{review.summary}</div>
      )}
    </div>
  );
}

function downloadPhoto(photo: Photo) {
  const a = document.createElement('a');
  a.href = photo.url;
  a.download = `formal_${photo.type}_${Date.now()}.jpg`;
  a.click();
}

function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: Photo | null;
  onClose: () => void;
}) {
  if (!photo?.url) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-5xl items-center justify-center p-4">
        <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efe8dd] bg-[#fbf8f2] p-3">
            <button onClick={onClose} className="btn-ghost">
              返回
            </button>
            <div className="text-sm font-medium text-[#2c2620]">{photo.type}</div>
            <button onClick={() => downloadPhoto(photo)} className="btn-primary">
              下载
            </button>
          </div>
          <div className="bg-[#f2ede5]">
            <img
              src={photo.url}
              alt={photo.type}
              className="max-h-[80vh] w-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// 邀请码步骤
function InviteStep({ onEnter }: { onEnter: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { 
      setError('请输入邀请码'); 
      return; 
    }
    localStorage.setItem('invite_code', code.toUpperCase());
    onEnter();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="panel p-8 md:p-10">
        <div className="tag">Invitation Only</div>
        <h1 className="hero-title mt-4">专业形象照工作台</h1>
        <p className="hero-subtitle mt-3">
          从审核到生成，再到多轮质检，全流程自动化的专业人像方案。
        </p>
        <div className="mt-8 grid gap-4 text-sm text-[#6b6256] md:grid-cols-2">
          <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-4">
            <div className="text-[#1f1b17] font-semibold">身份一致性</div>
            <p className="mt-2">多维度验证人脸特征，确保同一人像输出。</p>
          </div>
          <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-4">
            <div className="text-[#1f1b17] font-semibold">专业布光</div>
            <p className="mt-2">标准化摄影棚光效，统一质感与背景。</p>
          </div>
          <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-4">
            <div className="text-[#1f1b17] font-semibold">多姿势并行</div>
            <p className="mt-2">每个姿势独立优化，完成即展示。</p>
          </div>
          <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-4">
            <div className="text-[#1f1b17] font-semibold">安全链路</div>
            <p className="mt-2">敏感信息仅在后端处理，前端不保留。</p>
          </div>
        </div>
      </div>

      <div className="panel-strong p-8 md:p-10">
        <h2 className="text-xl font-semibold text-[#1f1b17]">输入邀请码</h2>
        <p className="mt-2 text-sm text-[#6b6256]">输入可用邀请码以启动流程。</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#8a8173] mb-2">邀请码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="如：VIP001"
              className="input"
            />
            {error && <p className="mt-2 text-sm text-[#b05c3c]">{error}</p>}
          </div>
          <button type="submit" className="btn-primary w-full">
            开始进入
          </button>
          <p className="text-xs text-[#9a8f81]">
            访问即表示同意平台的隐私与数据处理条款。
          </p>
        </form>
      </div>
    </div>
  );
}

// 使用协议步骤
function ConsentStep({ onAgree }: { onAgree: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="panel-strong mx-auto max-w-2xl p-8 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#1f1b17]">使用协议</h2>
          <p className="mt-2 text-sm text-[#6b6256]">请确认以下条款后继续。</p>
        </div>
        <div className="tag">Step 1/4</div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-4">
          <div className="font-semibold text-[#1f1b17]">用途限制</div>
          <p className="mt-2 text-sm text-[#6b6256]">上传照片仅用于本次 AI 处理与生成。</p>
        </div>
        <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-4">
          <div className="font-semibold text-[#1f1b17]">数据留存</div>
          <p className="mt-2 text-sm text-[#6b6256]">处理完成后 24 小时内自动删除。</p>
        </div>
        <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-4">
          <div className="font-semibold text-[#1f1b17]">隐私保护</div>
          <p className="mt-2 text-sm text-[#6b6256]">不会用于其他目的或对外分享。</p>
        </div>
        <div className="rounded-xl border border-[#e7e1d8] bg-white/85 p-4">
          <div className="font-semibold text-[#1f1b17]">安全链路</div>
          <p className="mt-2 text-sm text-[#6b6256]">敏感信息仅在后端处理。</p>
        </div>
      </div>
      <label className="mt-6 flex items-start gap-3 rounded-xl border border-[#e7e1d8] bg-white/85 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-[#d6c9b8] text-[#0e402e]"
        />
        <span className="text-sm text-[#4a433a]">我已阅读并同意上述协议</span>
      </label>
      <button
        onClick={onAgree}
        disabled={!checked}
        className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        同意并继续
      </button>
    </div>
  );
}

// 上传步骤
function UploadStep({ onNext }: { onNext: (image: string) => Promise<void> }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setPreview(imageData);
      setLoading(true);
      try {
        setOriginalImage(imageData);
        await onNext(imageData);
      } catch (err: any) {
        setError(err?.message || '照片审核失败');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [onNext]);

  return (
    <div className="panel-strong mx-auto max-w-3xl p-8 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#1f1b17]">上传照片</h2>
          <p className="mt-2 text-sm text-[#6b6256]">请上传清晰正脸照片，系统将先进行审核。</p>
        </div>
        <div className="tag">Step 2/4</div>
      </div>
      {!preview ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-[#e2dacd] bg-white/75 p-12 text-center transition hover:border-[#bda982]">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[#4a433a] font-medium mb-2">点击或拖拽上传照片</p>
            <p className="text-sm text-[#9a8f81]">支持 JPG、PNG，最大 10MB</p>
          </label>
        </div>
      ) : loading ? (
        <div className="mt-6 text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0e402e] mx-auto mb-4"></div>
          <p className="text-[#6b6256]">正在审核照片...</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr] items-center">
          <img src={preview} alt="预览" className="w-full rounded-2xl shadow-xl" />
          <div className="rounded-2xl border border-[#e7e1d8] bg-white/85 p-5">
            <div className="text-sm font-semibold text-[#1f1b17]">照片已就绪</div>
            <p className="mt-2 text-sm text-[#6b6256]">请继续选择需要生成的姿势。</p>
          </div>
        </div>
      )}
      {error && <div className="mt-4 rounded-xl border border-[#e8c7b5] bg-[#fbeee6] px-4 py-3 text-sm text-[#b05c3c]">{error}</div>}
    </div>
  );
}

// 姿势选择步骤
function PoseSelectStep({ onNext }: { onNext: (selectedPoses: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(PHOTO_TYPES.map(p => p.id));

  const togglePose = (poseId: string) => {
    setSelected(prev => 
      prev.includes(poseId) 
        ? prev.filter(p => p !== poseId)
        : [...prev, poseId]
    );
  };

  const handleSubmit = () => {
    if (selected.length === 0) {
      alert('请至少选择一种姿势');
      return;
    }
    onNext(selected);
  };

  return (
    <div className="panel-strong mx-auto max-w-4xl p-8 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#1f1b17]">选择姿势</h2>
          <p className="mt-2 text-sm text-[#6b6256]">请选择需要生成的照片姿势（可多选）。</p>
        </div>
        <div className="tag">Step 3/4</div>
      </div>
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {PHOTO_TYPES.map((pose) => (
          <label 
            key={pose.id}
            className={`relative flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${
              selected.includes(pose.id) 
                ? 'border-[#0e402e] bg-[#0e402e] text-white'
                : 'border-[#e7e1d8] bg-white hover:border-[#d6c9b8]'
            }`}
          >
            <input 
              type="checkbox"
              checked={selected.includes(pose.id)}
              onChange={() => togglePose(pose.id)}
              className="mt-1 w-5 h-5 rounded border-[#d6c9b8] text-[#0e402e]"
            />
            <div className="flex-1">
              <div className={`font-semibold ${selected.includes(pose.id) ? 'text-white' : 'text-[#1f1b17]'}`}>{pose.label}</div>
              <div className={`text-sm ${selected.includes(pose.id) ? 'text-[#efe8dd]' : 'text-[#6b6256]'}`}>{pose.desc}</div>
            </div>
            {selected.includes(pose.id) && (
              <div className="absolute top-3 right-3 text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </label>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-[#6b6256]">
          已选择 {selected.length} 种姿势
        </div>
        <button 
          onClick={handleSubmit}
          disabled={selected.length === 0}
          className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          开始生成
        </button>
      </div>
    </div>
  );
}

// 复杂处理步骤 - 每个姿势独立评审迭代
function ProcessingStep({ 
  image, 
  selectedPoses,
  onPhotoComplete 
}: { 
  image: string; 
  selectedPoses: string[];
  onPhotoComplete: (photo: Photo) => void;
}) {
  const [person, setPerson] = useState<Person | null>(null);
  const [poseStates, setPoseStates] = useState<Map<string, PoseState>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // 初始化姿势状态
  useEffect(() => {
    const initialStates = new Map<string, PoseState>();
    selectedPoses.forEach(type => {
      initialStates.set(type, {
        type,
        status: 'pending',
        progress: 0,
        step: 0,
        promptIteration: 0,
        generationIteration: 0,
        steps: [
          { name: '构建Prompt', status: 'pending' },
          { name: '评审Prompt', status: 'pending' },
          { name: '生成图像', status: 'pending' },
          { name: '评审结果', status: 'pending' },
        ]
      });
    });
    setPoseStates(initialStates);
  }, [selectedPoses]);

  // 分析人脸（共享步骤）
  useEffect(() => {
    abortController.current = new AbortController();
    const signal = abortController.current.signal;

    const runAnalysis = async () => {
      try {
        setIsAnalyzing(true);
        const personData = await analyze(image);
        if (signal.aborted) return;
        setPerson(personData);
        setIsAnalyzing(false);
        
        // 人脸分析完成后，开始并行处理每个姿势
        selectedPoses.forEach(type => {
          runPose(type, personData);
        });
      } catch (e: any) {
        setError(e.message);
        setIsAnalyzing(false);
      }
    };

    runAnalysis();

    return () => {
      abortController.current?.abort();
    };
  }, [image, selectedPoses]);

  // 处理单个姿势的完整流程
  const runPose = async (poseType: string, personData: Person) => {
    try {
      updatePoseState(poseType, { 
        status: 'generating',
        progress: 60,
        steps: updateSteps(poseType, 2, 'active')
      });

      const result = await processPose(image, poseType, personData);

      const generatedPhoto: Photo = {
        id: `${poseType}-${Date.now()}`,
        type: poseType,
        url: result.image,
        approved: result.review.approved ?? (result.review.overallScore || 0) >= 70,
        review: { ...result.review, iteration: result.generationIterations },
      };

      updatePoseState(poseType, { 
        status: 'completed', 
        progress: 100,
        promptIteration: result.promptIterations,
        generationIteration: result.generationIterations,
        currentReview: generatedPhoto.review,
        photo: generatedPhoto,
        steps: updateSteps(poseType, 3, 'completed')
      });

      onPhotoComplete(generatedPhoto);
    } catch (e: any) {
      updatePoseState(poseType, { 
        status: 'error', 
        error: e.message,
      });
    }
  };

  // 更新姿势状态
  const updatePoseState = (type: string, updates: Partial<PoseState>) => {
    setPoseStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(type);
      if (current) {
        newStates.set(type, { ...current, ...updates });
      }
      return newStates;
    });
  };

  // 更新步骤状态
  const updateSteps = (type: string, activeIndex: number, status: 'active' | 'completed' | 'error'): ProcessingStep[] => {
    const state = poseStates.get(type);
    if (!state) return [];
    
    return state.steps.map((step, index) => ({
      ...step,
      status: index < activeIndex ? 'completed' : 
              index === activeIndex ? status : 
              'pending'
    }));
  };

  // 获取状态显示
  const getStatusDisplay = (state: PoseState) => {
    const statusMap: Record<string, { text: string; color: string; bg: string }> = {
      pending: { text: '等待中', color: 'text-[#8c7f70]', bg: 'bg-[#d8cbb7]' },
      generating: { text: '生成与评审中', color: 'text-[#7a5a2e]', bg: 'bg-[#cbb89a]' },
      completed: { text: '✓ 已完成', color: 'text-[#2a6d4f]', bg: 'bg-[#2a6d4f]' },
      error: { text: '✗ 失败', color: 'text-[#b05c3c]', bg: 'bg-[#b05c3c]' },
    };
    return statusMap[state.status] || statusMap.pending;
  };

  if (isAnalyzing) {
    return (
      <div className="panel-strong mx-auto max-w-2xl p-10 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0e402e] mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-[#1f1b17] mb-2">AI 正在分析</h2>
        <p className="text-sm text-[#6b6256]">分析人脸特征中，请稍候...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-strong mx-auto max-w-2xl p-8">
        <div className="rounded-xl border border-[#e8c7b5] bg-[#fbeee6] p-6">
          <h3 className="font-semibold text-[#b05c3c] mb-2">处理出错</h3>
          <p className="text-[#b05c3c]">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-ghost mt-4 w-full">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-strong mx-auto max-w-6xl p-8 md:p-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#1f1b17]">AI 正在生成</h2>
          <p className="text-sm text-[#6b6256]">每个姿势独立评审和迭代优化。</p>
        </div>
        <div className="tag">Step 4/4</div>
      </div>
      
      {/* 人物分析结果 */}
      {person && (
        <div className="mt-6 rounded-2xl border border-[#e7e1d8] bg-white/85 p-4">
          <h4 className="font-medium text-[#1f1b17] mb-2">人脸分析完成</h4>
          <p className="text-sm text-[#6b6256]">
            {person.race} {person.gender}, {person.age} · {person.faceShape}脸型
          </p>
        </div>
      )}

      {/* 并行处理的姿势列表 */}
      <div className="mt-6 space-y-4">
        {Array.from(poseStates.values()).map((state) => {
          const status = getStatusDisplay(state);
          return (
            <div key={state.type} className="rounded-2xl border border-[#e7e1d8] bg-white/90 p-5 shadow-sm">
              {/* 头部信息 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${status.bg} ${state.status === 'generating' ? 'animate-pulse' : ''}`} />
                  <span className="font-medium text-[#1f1b17]">{state.type}</span>
                </div>
                <span className={`text-sm font-medium ${status.color}`}>{status.text}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div>
                  <div className="aspect-square overflow-hidden rounded-xl border border-[#e7e1d8] bg-[#f2ede5]">
                    {state.photo?.url ? (
                      <img src={state.photo.url} alt={state.type} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0e402e]" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => state.photo && setLightboxPhoto(state.photo)}
                      className="btn-ghost flex-1"
                      disabled={!state.photo?.url}
                    >
                      放大
                    </button>
                    <button
                      onClick={() => state.photo && downloadPhoto(state.photo)}
                      className="btn-primary flex-1"
                      disabled={!state.photo?.url}
                    >
                      下载
                    </button>
                  </div>
                </div>

                <div>
                  {/* 进度条 */}
                  <div className="h-2 bg-[#efe8dd] rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${status.bg}`}
                      style={{ width: `${state.progress}%` }}
                    />
                  </div>

                  {/* 处理步骤时间轴 */}
                  <div className="timeline mb-3">
                    {state.steps.map((step, idx) => (
                      <div key={idx} className="timeline-item">
                        {idx !== state.steps.length - 1 && <div className="timeline-line" />}
                        <div className={`timeline-dot ${step.status}`} />
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-[#2c2620]">{step.name}</div>
                          <span className="status-pill">
                            {step.status === 'completed' && '完成'}
                            {step.status === 'active' && '进行中'}
                            {step.status === 'error' && '待优化'}
                            {step.status === 'pending' && '等待'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 评审结果 */}
                  {state.currentReview && (
                    <div className="border-t pt-3">
                      <ReviewPanel review={state.currentReview} />
                    </div>
                  )}

                  {/* 错误信息 */}
                  {state.error && (
                    <div className="mt-2 text-sm text-rose-600">
                      错误: {state.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
    </div>
  );
}

// 结果步骤
function ResultStep({ photos, onReset }: { photos: Photo[]; onReset: () => void }) {
  const completedCount = photos.filter(p => p.url).length;
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  return (
    <div className="panel-strong mx-auto max-w-6xl p-8 md:p-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-[#1f1b17] mb-1">专业形象照</h2>
          <p className="text-sm text-[#6b6256]">
          已完成 {completedCount} 张照片
          {completedCount < photos.length && `（${photos.length - completedCount} 张生成中...）`}
          </p>
        </div>
        <button onClick={onReset} className="btn-ghost">重新开始</button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {photos.map((photo) => (
          <div key={photo.id} className="rounded-2xl border border-[#e7e1d8] bg-white shadow-sm">
            <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
              <div>
                <div className="aspect-square overflow-hidden rounded-xl border border-[#e7e1d8] bg-[#f2ede5]">
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.type}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0e402e]" />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => photo.url && setLightboxPhoto(photo)}
                    className="btn-ghost flex-1"
                    disabled={!photo.url}
                  >
                    放大
                  </button>
                  <button
                    onClick={() => photo.url && downloadPhoto(photo)}
                    className="btn-primary flex-1"
                    disabled={!photo.url}
                  >
                    下载
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-base font-medium text-[#2c2620]">{photo.type}</div>
                  <span className="text-xs rounded-full bg-[#dff1e8] px-2 py-1 text-[#2a6d4f]">
                    已完成
                  </span>
                </div>
                {photo.review ? (
                  <ReviewPanel review={photo.review} title="评审结果" />
                ) : (
                  <div className="text-sm text-[#6b6256]">评审结果生成中...</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
    </div>
  );
}

// Main App
export default function App() {
  const { step, setStep, image, setImage, photos, setPhotos, reset } = useWorkflowStore();
  const [hasInvite, setHasInvite] = useState(false);
  const [selectedPoses, setSelectedPoses] = useState<string[]>([]);

  useEffect(() => {
    const code = localStorage.getItem('invite_code');
    if (code) {
      setHasInvite(true);
      setStep('consent');
    }
  }, [setStep]);

  const resetApp = useCallback(() => {
    clearInviteCode();
    setHasInvite(false);
    setSelectedPoses([]);
    reset();
  }, [reset]);

  const handlePhotoComplete = (photo: Photo) => {
    setPhotos((prev: Photo[]) => {
      const exists = prev.find((p: Photo) => p.type === photo.type);
      if (exists) {
        return prev.map((p: Photo) => p.type === photo.type ? photo : p);
      }
      return [...prev, photo];
    });
  };

  return (
    <div className="page">
      {hasInvite && (
        <header className="shell mb-8 flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/75 px-6 py-5 shadow-[0_24px_60px_rgba(20,20,20,0.10)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="tag">Formal Photos</div>
            <h1 className="mt-2 text-2xl font-semibold text-[#1f1b17]">专业形象照生成器</h1>
            <p className="text-sm text-[#6b6256]">AI 驱动的专业人像生成与质检</p>
          </div>
          <button onClick={resetApp} className="btn-ghost">重新开始</button>
        </header>
      )}
      <main className="shell">
        {!hasInvite && <InviteStep onEnter={() => { setHasInvite(true); setStep('consent'); }} />}
        {hasInvite && step === 'consent' && <ConsentStep onAgree={() => setStep('upload')} />}
        {hasInvite && step === 'upload' && (
          <UploadStep onNext={async (img) => {
            const review = await reviewInput(img);
            const approved = review.approved ?? (review.overallScore || 0) >= 70;
            if (!approved) {
              throw new Error(review.summary || '照片审核未通过，请更换更清晰的照片');
            }
            setImage(img);
            setStep('pose_select');
          }} />
        )}
        {hasInvite && step === 'pose_select' && (
          <PoseSelectStep onNext={(poses) => { setSelectedPoses(poses); setStep('processing'); }} />
        )}
        {hasInvite && step === 'processing' && image && (
          <ProcessingStep 
            image={image} 
            selectedPoses={selectedPoses}
            onPhotoComplete={handlePhotoComplete}
          />
        )}
        {hasInvite && step === 'result' && photos.length > 0 && (
          <ResultStep photos={photos} onReset={resetApp} />
        )}
      </main>
    </div>
  );
}
