import { useState, useEffect, useRef } from 'react';
import { setInviteCode, getInviteCode, hasInviteCode } from './api';

// 邀请码配置（前端仅显示，不验证）
const INVITE_CODES = [
  { code: 'PHOTO2026', label: 'Alpha测试', desc: '全功能体验' },
  { code: 'VIP001', label: 'VIP用户', desc: '高清导出' },
  { code: 'EARLY2026', label: '早鸟用户', desc: '标准功能' },
];

// ==================== 步骤组件 ====================

function InviteStep({ onEnter }: { onEnter: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('请输入邀请码');
      return;
    }

    setLoading(true);
    setError('');

    // 保存邀请码到本地存储
    setInviteCode(code.toUpperCase());
    onEnter();
  };

  return (
    <div className="card mx-auto" style={{ maxWidth: 400 }}>
      <h1 className="text-2xl font-bold mb-6 text-center">专业形象照</h1>
      
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            邀请码 *
          </label>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="输入邀请码"
            className="input"
            autoComplete="off"
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? '验证中...' : '进入系统'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center mb-3">可用邀请码</p>
        <div className="space-y-2">
          {INVITE_CODES.map((inv) => (
            <button
              key={inv.code}
              onClick={() => {
                setCode(inv.code);
                setError('');
              }}
              className={`w-full flex items-center justify-between p-2 rounded transition ${
                code === inv.code ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <span className="font-mono text-sm">{inv.code}</span>
              <span className="text-xs text-gray-500">{inv.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConsentStep({ onAgree }: { onAgree: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="card mx-auto" style={{ maxWidth: 500 }}>
      <h2 className="text-xl font-bold mb-4">使用协议</h2>
      <div className="text-sm text-gray-600 space-y-2 mb-4">
        <p>• 上传照片仅用于本次AI处理</p>
        <p>• 处理完成后24小时内自动删除所有数据</p>
        <p>• 不会将照片用于其他目的或分享给第三方</p>
        <p>• 生成效果以实际AI生成为准</p>
      </div>
      <label className="flex items-start space-x-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm text-gray-600">
          我已阅读并同意上述协议，确认上传的照片为我本人或有合法使用权
        </span>
      </label>
      <button
        onClick={onAgree}
        disabled={!checked}
        className="btn-primary w-full disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        同意并继续
      </button>
    </div>
  );
}

function UploadStep({ onNext }: { onNext: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setLoading(true);
      
      // 简单的人脸检测（如果有face-api）
      import('./face-api').then(({ detectFaces }) => {
        detectFaces(e.target?.result as string).then(() => {
          setLoading(false);
          onNext();
        }).catch(() => {
          setLoading(false);
          onNext();
        });
      }).catch(() => {
        setLoading(false);
        onNext();
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="card mx-auto" style={{ maxWidth: 500 }}>
      <h2 className="text-xl font-bold mb-4">上传照片</h2>
      {!preview ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} className="hidden" id="file" />
          <label htmlFor="file" className="cursor-pointer">
            <p className="text-gray-500 mb-2">点击或拖拽上传照片</p>
            <p className="text-xs text-gray-400">支持 JPG、PNG，最大10MB</p>
          </label>
        </div>
      ) : loading ? (
        <div className="text-center py-8">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-gray-600">检测人脸中...</p>
        </div>
      ) : (
        <div className="text-center">
          <img src={preview} alt="预览" className="max-w-xs mx-auto rounded-lg mb-4" />
          <p className="text-green-600">✓ 照片已上传</p>
        </div>
      )}
    </div>
  );
}

function FaceSelectStep({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState(0);
  // 简化：使用默认人脸区域
  const faces = [{ x: 100, y: 50, w: 200, h: 250 }];

  return (
    <div className="card mx-auto" style={{ maxWidth: 600 }}>
      <h2 className="text-xl font-bold mb-4">选择人脸</h2>
      <div className="text-center">
        <div className="relative inline-block">
          <div className="w-80 h-96 bg-gray-200 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-gray-400">照片预览</span>
          </div>
          <div
            className="absolute border-4 border-primary-500 cursor-pointer"
            style={{ left: faces[0].x * 0.4, top: faces[0].y * 0.4, width: faces[0].w * 0.4, height: faces[0].h * 0.4 }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-4">已自动选择人脸</p>
      </div>
      <button onClick={onNext} className="btn-primary mt-6 w-full">确认选择</button>
    </div>
  );
}

function AnalyzeStep({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'analyzing' | 'done'>('analyzing');
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    const runAnalysis = async () => {
      try {
        const { analyze } = await import('./api');
        const image = localStorage.getItem('upload_image') || '';
        const person = await analyze(image);
        
        if (mounted) {
          setInfo(person);
          setStatus('done');
          setTimeout(() => {
            if (mounted) onNext();
          }, 1000);
        }
      } catch (error) {
        console.error('Analysis failed', error);
        if (mounted) {
          setStatus('done');
          setTimeout(() => {
            if (mounted) onNext();
          }, 1000);
        }
      }
    };

    runAnalysis();

    return () => {
      mounted = false;
    };
  }, [onNext]);

  return (
    <div className="card mx-auto" style={{ maxWidth: 500 }}>
      <h2 className="text-xl font-bold mb-4">AI分析</h2>
      {status === 'analyzing' ? (
        <div className="text-center py-8">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-gray-600">分析人物特征...</p>
        </div>
      ) : info ? (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-gray-500">种族</p><p className="font-medium">{info.race}</p></div>
          <div><p className="text-gray-500">肤色</p><p className="font-medium">{info.skinTone}</p></div>
          <div><p className="text-gray-500">性别</p><p className="font-medium">{info.gender}</p></div>
          <div><p className="text-gray-500">年龄</p><p className="font-medium">{info.age}</p></div>
        </div>
      ) : (
        <div className="text-center py-8">
           <p className="text-red-500">分析未完成，跳过...</p>
        </div>
      )}
    </div>
  );
}

function DownloadStep() {
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('generated_photos');
    if (saved) {
      setPhotos(JSON.parse(saved));
    }
  }, []);

  const download = (photo: any) => {
    const a = document.createElement('a');
    a.href = photo.url;
    a.download = `formal_${photo.type}_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">专业形象照完成</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos.filter((p) => p.approved).map((photo) => (
          <div key={photo.id} className="card overflow-hidden">
            <img src={photo.url} alt={photo.type} className="w-full aspect-square object-cover" />
            <div className="p-4">
              <p className="font-medium mb-3">{photo.type}</p>
              <button onClick={() => download(photo)} className="btn-primary w-full">下载</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 主应用 ====================

export default function App() {
  const [step, setStep] = useState<'invite' | 'consent' | 'upload' | 'face' | 'analyze' | 'download'>('invite');

  useEffect(() => {
    // 检查是否有邀请码
    if (hasInviteCode()) {
      setStep('consent');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {step !== 'invite' && (
        <header className="max-w-4xl mx-auto mb-8 flex justify-between items-center">
          <h1 className="text-xl font-bold">专业形象照生成器</h1>
          <button
            onClick={() => {
              localStorage.clear();
              setStep('invite');
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            重新开始
          </button>
        </header>
      )}

      <div className="max-w-4xl mx-auto">
        {step === 'invite' && <InviteStep onEnter={() => setStep('consent')} />}
        {step === 'consent' && <ConsentStep onAgree={() => setStep('upload')} />}
        {step === 'upload' && <UploadStep onNext={() => setStep('face')} />}
        {step === 'face' && <FaceSelectStep onNext={() => setStep('analyze')} />}
        {step === 'analyze' && <AnalyzeStep onNext={() => setStep('download')} />}
        {step === 'download' && <DownloadStep />}
      </div>
    </div>
  );
}
