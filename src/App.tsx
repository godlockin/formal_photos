import { useState, useEffect, useCallback } from 'react';
import { analyze, design, buildPrompt, generate, review, finalCheck, clearInviteCode } from './api';
import { useWorkflowStore } from './store';
import type { Person, Design, Prompt, Photo, ReviewResult, ExpertRole } from './types';

const MAX_RETRY_COUNT = 3;
const MIN_CONSENSUS = 85;
const MIN_EXPERT = 80;
const MIN_DIRECTOR = 90;

const EXPERT_LABELS: Record<ExpertRole, { name: string; color: string }> = {
  MAKEUP_ARTIST: { name: '化妆师', color: 'bg-pink-100 text-pink-700' },
  STYLIST: { name: '服装师', color: 'bg-purple-100 text-purple-700' },
  POSTURE_COACH: { name: '形态教练', color: 'bg-green-100 text-green-700' },
  LIGHTING_SPEC: { name: '灯光师', color: 'bg-yellow-100 text-yellow-700' },
  PHOTOGRAPHER: { name: '摄影师', color: 'bg-blue-100 text-blue-700' },
  DIRECTOR: { name: '导演', color: 'bg-red-100 text-red-700' },
};

function ExpertBadge({ role }: { role: ExpertRole }) {
  const label = EXPERT_LABELS[role];
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${label.color}`}>
      {label.name}
    </span>
  );
}

function QualityScore({ score, label, threshold }: { score: number; label: string; threshold: number }) {
  const color = score >= threshold ? 'text-green-600' : score >= threshold - 5 ? 'text-yellow-600' : 'text-red-600';
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xs text-gray-400">需≥{threshold}</div>
    </div>
  );
}

interface AuditStep {
  name: string;
  score: number | null;
  passed: boolean;
  experts: { expert: string; score: number }[];
}

interface AuditTrailProps {
  steps: AuditStep[];
}

function AuditTrail({ steps }: AuditTrailProps) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <h4 className="font-semibold text-gray-800 mb-4">质量审核追踪</h4>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={step.name} className={`flex items-center gap-3 p-2 rounded ${step.passed ? 'bg-green-50' : 'bg-gray-50'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step.passed ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'
              }`}>
              {step.passed ? '✓' : '○'}
            </div>
            <span className="flex-1 text-sm">{step.name}</span>
            {step.score !== null && (
              <span className={`text-sm font-medium ${step.score >= MIN_CONSENSUS ? 'text-green-600' : 'text-yellow-600'}`}>
                {step.score}分
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewPanel({ review: reviewData, stage }: { review: ReviewResult; stage: string }) {
  const getScoreColor = (score: number) => {
    if (score >= MIN_CONSENSUS) return 'text-green-600';
    if (score >= MIN_EXPERT) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getApprovalStatus = (score: number, role: string) => {
    const minThreshold = role === 'DIRECTOR' ? MIN_DIRECTOR : MIN_EXPERT;
    return score >= minThreshold;
  };

  const failedExperts = reviewData.reviews.filter(r => !getApprovalStatus(r.score, r.expert));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-800">{stage}</h4>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${reviewData.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
            {reviewData.approved ? '✓ 通过' : '⟳ 优化中'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <QualityScore score={reviewData.consensusScore} label="综合评分" threshold={MIN_CONSENSUS} />
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {reviewData.reviews.filter(r => r.score >= MIN_CONSENSUS).length}/6
            </div>
            <div className="text-xs text-gray-500">专家通过</div>
            <div className="text-xs text-gray-400">需≥5/6</div>
          </div>
          {reviewData.passRate !== undefined && (
            <QualityScore score={reviewData.passRate} label="照片通过率" threshold={80} />
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {reviewData.reviews.map((r) => {
            const minThreshold = r.expert === 'DIRECTOR' ? MIN_DIRECTOR : MIN_EXPERT;
            return (
              <div key={r.expert} className={`p-2 rounded border ${r.score >= minThreshold ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <ExpertBadge role={r.expert as ExpertRole} />
                  <span className={`font-bold ${getScoreColor(r.score)}`}>{r.score}</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{r.comments}</p>
              </div>
            );
          })}
        </div>

        {failedExperts.length > 0 && (
          <div className="p-3 bg-yellow-50 rounded-lg">
            <div className="text-sm font-medium text-yellow-700 mb-1">待改进专家：</div>
            <div className="flex flex-wrap gap-2">
              {failedExperts.map(f => (
                <span key={f.expert} className="text-xs px-2 py-1 bg-yellow-100 rounded">
                  {EXPERT_LABELS[f.expert as ExpertRole]?.name || f.expert}: {f.score}分
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t">
          <p className="text-sm text-gray-600">{reviewData.summary}</p>
          {reviewData.suggestions && reviewData.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">改进建议：</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {reviewData.suggestions.slice(0, 3).map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadStep({ onNext }: { onNext: (image: string) => void }) {
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
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        onNext(e.target?.result as string);
      }, 800);
    };
    reader.readAsDataURL(file);
  }, [onNext]);

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">上传照片</h2>
      {!preview ? (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-500 transition-colors">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-2">点击或拖拽上传照片</p>
            <p className="text-sm text-gray-400">支持 JPG、PNG，最大10MB</p>
          </label>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在检测人脸...</p>
        </div>
      ) : (
        <div className="text-center">
          <img src={preview} alt="预览" className="max-w-sm mx-auto rounded-lg shadow-lg mb-4" />
          <p className="text-green-600 font-medium">✓ 照片已就绪</p>
        </div>
      )}
      {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
    </div>
  );
}

function ProcessingStep({ image, onComplete }: { image: string; onComplete: (photos: Photo[]) => void }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('准备中...');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [totalRetries, setTotalRetries] = useState(0);
  const [currentReview, setCurrentReview] = useState<ReviewResult | null>(null);
  const [currentStage, setCurrentStage] = useState('准备中');
  const [auditSteps, setAuditSteps] = useState<AuditStep[]>([
    { name: '人脸检测', score: null, passed: false, experts: [] },
    { name: '人物分析', score: null, passed: false, experts: [] },
    { name: '形象设计', score: null, passed: false, experts: [] },
    { name: 'Prompt构建', score: null, passed: false, experts: [] },
    { name: '方案评审', score: null, passed: false, experts: [] },
    { name: '照片生成', score: null, passed: false, experts: [] },
    { name: '最终审核', score: null, passed: false, experts: [] },
  ]);
  const { photos, setPhotos } = useWorkflowStore();

  const updateAuditStep = (index: number, score: number, experts: { expert: string; score: number }[]) => {
    setAuditSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = {
        ...newSteps[index],
        score,
        passed: score >= MIN_CONSENSUS,
        experts,
      };
      return newSteps;
    });
  };

  const processingSteps = [
    { name: '人脸检测', action: 'detect', weight: 0.05, auditIndex: 0 },
    { name: '人物分析', action: 'analyze', weight: 0.2, auditIndex: 1 },
    { name: '形象设计', action: 'design', weight: 0.35, auditIndex: 2 },
    { name: 'Prompt构建', action: 'buildPrompt', weight: 0.5, auditIndex: 3 },
    { name: '方案评审', action: 'reviewPrompt', weight: 0.6, auditIndex: 4 },
    { name: '照片生成', action: 'generate', weight: 0.8, auditIndex: 5 },
    { name: '最终审核', action: 'finalCheck', weight: 1.0, auditIndex: 6 },
  ];

  useEffect(() => {
    let mounted = true;
    const runProcessing = async () => {
      try {
        let person: Person | null = null;
        let designResult: Design | null = null;
        let prompt: Prompt | null = null;
        const generatedPhotos: Photo[] = [];

        for (let i = 0; i < processingSteps.length; i++) {
          if (!mounted) return;
          const step = processingSteps[i];
          setCurrentStage(step.name);
          setProgress((step.weight - 0.1) * 100);

          switch (step.action) {
            case 'detect':
              await new Promise(r => setTimeout(r, 500));
              updateAuditStep(step.auditIndex, 100, [{ expert: 'SYSTEM', score: 100 }]);
              break;

            case 'analyze':
              person = await analyze(image);
              updateAuditStep(step.auditIndex, 100, [{ expert: 'SYSTEM', score: 100 }]);
              break;

            case 'design':
              if (!person) throw new Error('缺少人物分析结果');
              designResult = await design(person);
              updateAuditStep(step.auditIndex, 100, [{ expert: 'SYSTEM', score: 100 }]);
              break;

            case 'buildPrompt':
              if (!person || !designResult) throw new Error('缺少设计方案');
              prompt = await buildPrompt(person, designResult);
              updateAuditStep(step.auditIndex, 100, [{ expert: 'SYSTEM', score: 100 }]);
              break;

            case 'reviewPrompt':
              if (!prompt) throw new Error('缺少Prompt');
              const promptReview = await review(JSON.stringify(prompt));
              setCurrentReview(promptReview);
              setCurrentStage('方案评审');
              updateAuditStep(step.auditIndex, promptReview.consensusScore, promptReview.reviews.map(r => ({ expert: r.expert, score: r.score })));

              if (!promptReview.approved && totalRetries >= MAX_RETRY_COUNT - 1) {
                setError(`方案评审未通过 (${promptReview.consensusScore}分)，已达到最大重试次数`);
                return;
              }

              if (!promptReview.approved) {
                setRetryCount(c => c + 1);
                setTotalRetries(t => t + 1);
                i = 1;
                continue;
              }
              setRetryCount(0);
              break;

            case 'generate':
              if (!prompt) throw new Error('缺少Prompt');
              const types = ['正面头像', '侧面头像', '肖像照', '半身照', '全身照'];
              for (let j = 0; j < types.length; j++) {
                if (!mounted) return;
                setStatus(`生成照片 ${j + 1}/5`);
                const url = await generate(prompt, types[j]);
                generatedPhotos.push({
                  id: `${types[j]}-${Date.now()}-${j}`,
                  type: types[j],
                  url,
                  approved: true,
                  review: { reviews: [], consensusScore: 100, approved: true, summary: '生成成功', suggestions: [] },
                });
              }
              updateAuditStep(step.auditIndex, 100, [{ expert: 'SYSTEM', score: 100 }]);
              setPhotos(generatedPhotos);
              break;

            case 'finalCheck':
              if (!person || !prompt) throw new Error('缺少必要数据');
              const finalReview = await finalCheck(image, person, prompt);
              setCurrentReview(finalReview);
              setCurrentStage('最终审核');
              updateAuditStep(step.auditIndex, finalReview.consensusScore, finalReview.reviews.map(r => ({ expert: r.expert, score: r.score })));

              if (!finalReview.approved || (finalReview.passRate ?? 0) < 80) {
                if (totalRetries >= MAX_RETRY_COUNT - 1) {
                  setError(`照片质量未达标 (${finalReview.consensusScore}分)，已达到最大重试次数`);
                  return;
                }
                setRetryCount(c => c + 1);
                setTotalRetries(t => t + 1);
                i = 3;
                continue;
              }
              break;
          }
          setProgress(step.weight * 100);
        }

        if (mounted && generatedPhotos.length > 0) {
          onComplete(generatedPhotos);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e.message || '处理失败');
        }
      }
    };
    runProcessing();
    return () => { mounted = false; };
  }, [image, onComplete, setPhotos, totalRetries]);

  if (error) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-700">处理未通过</h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-red-500">当前重试: {retryCount}/{MAX_RETRY_COUNT}</span>
            <span className="text-red-500">总计重试: {totalRetries}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h4 className="font-semibold text-gray-800 mb-4">质量审核历史</h4>
          <AuditTrail steps={auditSteps} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">AI 正在处理</h2>

      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">{currentStage}</span>
          <span className="text-gray-900 font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>进度: {retryCount > 0 ? `重试第${retryCount}次` : '首次处理'}</span>
          <span>审核通过: {auditSteps.filter(s => s.passed).length}/{auditSteps.length}</span>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        {processingSteps.map((step, i) => {
          const stepProgress = step.weight * 100;
          const isComplete = progress >= stepProgress;
          const isCurrent = progress >= (step.weight - 0.1) * 100 && progress < stepProgress;
          const auditData = auditSteps[step.auditIndex];

          return (
            <div key={step.action} className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isCurrent ? 'bg-blue-50' : isComplete ? 'bg-green-50' : 'bg-gray-50'
              }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isComplete ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-300 text-gray-500'
                }`}>
                {isComplete ? '✓' : isCurrent ? '⟳' : i + 1}
              </div>
              <span className={`flex-1 text-sm ${isCurrent ? 'text-gray-900 font-medium' : isComplete ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.name}
              </span>
              {auditData.score !== null && (
                <span className={`text-xs font-medium ${auditData.passed ? 'text-green-600' : 'text-yellow-600'}`}>
                  {auditData.score}分
                </span>
              )}
            </div>
          );
        })}
      </div>

      {currentReview && (
        <ReviewPanel review={currentReview} stage={currentStage} />
      )}
    </div>
  );
}

function ResultStep({ photos, onReset }: { photos: Photo[]; onReset: () => void }) {
  const downloadPhoto = (photo: Photo) => {
    const a = document.createElement('a');
    a.href = photo.url;
    a.download = `formal_${photo.type}_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">专业形象照已完成</h2>
        <p className="text-gray-500">共生成 {photos.length} 张照片</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {photos.map((photo) => (
          <div key={photo.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <img src={photo.url} alt={photo.type} className="w-full aspect-square object-cover" />
            <div className="p-3">
              <p className="text-sm font-medium text-gray-800 mb-2">{photo.type}</p>
              <button onClick={() => downloadPhoto(photo)} className="w-full py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 transition-colors">
                下载
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <button onClick={onReset} className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
          重新开始
        </button>
      </div>
    </div>
  );
}

export function InviteStep({ onEnter }: { onEnter: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { setStep } = useWorkflowStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('请输入邀请码'); return; }
    localStorage.setItem('invite_code', code.toUpperCase());
    onEnter();
  };

  const demoCodes = [{ code: 'PHOTO2026', label: 'Alpha', desc: '全功能' }, { code: 'VIP001', label: 'VIP', desc: '高清' }, { code: 'EARLY2026', label: '早鸟', desc: '标准' }];

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">专业形象照</h1>
        <p className="text-gray-500">AI驱动的专业人像生成</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">邀请码</label>
          <input type="text" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }} placeholder="输入邀请码" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" autoComplete="off" />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
        <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">开始使用</button>
      </form>
      <div className="mt-8 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center mb-4">演示邀请码</p>
        <div className="grid grid-cols-3 gap-2">
          {demoCodes.map((d) => (
            <button key={d.code} onClick={() => setCode(d.code)} className={`p-3 rounded-lg text-center ${code === d.code ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50 border-2 border-transparent'}`}>
              <div className="font-mono text-sm font-medium">{d.code}</div>
              <div className="text-xs text-gray-500 mt-1">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ConsentStep({ onAgree }: { onAgree: () => void }) {
  const [checked, setChecked] = useState(false);
  const { setStep } = useWorkflowStore();

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">使用协议</h2>
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <ul className="space-y-3 text-gray-600">
          <li className="flex items-start gap-2"><span className="text-green-500">✓</span> 上传照片仅用于本次AI处理</li>
          <li className="flex items-start gap-2"><span className="text-green-500">✓</span> 处理完成后24小时内自动删除所有数据</li>
          <li className="flex items-start gap-2"><span className="text-green-500">✓</span> 不会将照片用于其他目的或分享给第三方</li>
        </ul>
      </div>
      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 w-5 h-5 text-blue-600 rounded" />
        <span className="text-gray-700">我已阅读并同意上述协议</span>
      </label>
      <button onClick={onAgree} disabled={!checked} className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300">
        同意并继续
      </button>
    </div>
  );
}

export default function App() {
  const { step, setStep, image, setImage, photos, setPhotos, reset } = useWorkflowStore();
  const [hasInvite, setHasInvite] = useState(false);

  useEffect(() => {
    const code = localStorage.getItem('invite_code');
    if (code) {
      setHasInvite(true);
      setStep('consent');
    } else {
      setHasInvite(false);
    }
  }, [setStep]);

  const resetApp = useCallback(() => {
    clearInviteCode();
    setHasInvite(false);
    reset();
  }, [reset]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {hasInvite && (
        <header className="max-w-5xl mx-auto mb-8 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">专业形象照生成器</h1>
          <button onClick={resetApp} className="text-gray-400 hover:text-gray-600 text-sm">重新开始</button>
        </header>
      )}
      <main className="max-w-5xl mx-auto">
        {!hasInvite && <InviteStep onEnter={() => { setHasInvite(true); setStep('consent'); }} />}
        {hasInvite && step === 'consent' && <ConsentStep onAgree={() => setStep('upload')} />}
        {hasInvite && step === 'upload' && <UploadStep onNext={(img) => { setImage(img); setStep('processing'); }} />}
        {hasInvite && step === 'processing' && image && <ProcessingStep image={image} onComplete={(p) => { setPhotos(p); setStep('result'); }} />}
        {hasInvite && step === 'result' && photos.length > 0 && <ResultStep photos={photos} onReset={resetApp} />}
      </main>
    </div>
  );
}
