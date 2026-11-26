import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { GeminiModelId } from '../../types';
import {
  GEMINI_MODELS,
  getEnvGeminiKey,
  getSavedLocalGeminiKey,
  saveGeminiModel,
  saveLocalGeminiKey,
  testGeminiConnection,
} from '../../utils/geminiWritingService';

interface GeminiSettingsModalProps {
  open: boolean;
  onClose: () => void;
  currentModel: GeminiModelId;
  onConfigUpdated: (model: GeminiModelId) => void;
}

export const GeminiSettingsModal: React.FC<GeminiSettingsModalProps> = ({
  open,
  onClose,
  currentModel,
  onConfigUpdated,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getSavedLocalGeminiKey());
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(currentModel);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const hasEnvFallback = Boolean(getEnvGeminiKey());

  if (!open) return null;

  const handleSave = () => {
    saveLocalGeminiKey(apiKeyInput);
    saveGeminiModel(selectedModel);
    onConfigUpdated(selectedModel);
    onClose();
  };

  const handleClearKey = () => {
    setApiKeyInput('');
    saveLocalGeminiKey('');
    setTestResult(null);
    onConfigUpdated(selectedModel);
  };

  const handleTest = async () => {
    const keyToTest = apiKeyInput.trim() || getEnvGeminiKey();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiConnection(keyToTest, selectedModel);
      setTestResult({ ok: res.ok, message: res.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-700/80 bg-[#0F172A] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Cài đặt Google Gemini API (BYOK)</h3>
              <p className="text-xs text-slate-400">
                Khóa cá nhân chỉ lưu cục bộ trên trình duyệt (localStorage), không gửi đi đâu khác
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Quick link to AI Studio */}
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-cyan-100 leading-relaxed">
              <p className="font-bold text-cyan-300">Chưa có khóa Gemini miễn phí?</p>
              <p className="text-slate-300 mt-0.5">
                Tạo Free API Key chỉ mất 30 giây tại Google AI Studio (không cần thẻ tín dụng).
              </p>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-200 transition shrink-0"
            >
              Lấy Free API Key
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* API Key input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Gemini API Key cá nhân
            </label>
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIzaSy..."
                autoComplete="off"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-4 pr-20 py-3 text-sm font-mono text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  title={showKey ? 'Ẩn khóa' : 'Hiện khóa'}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {apiKeyInput && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    title="Xóa khóa đã lưu"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {hasEnvFallback && !apiKeyInput.trim() && (
              <p className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Đang phát hiện biến môi trường <code className="font-mono">VITE_GEMINI_API_KEY</code> làm khóa dự phòng.
              </p>
            )}
          </div>

          {/* Model selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Chọn Model Gemini chấm bài
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {GEMINI_MODELS.map((m) => {
                const active = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m.id);
                      setTestResult(null);
                    }}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500/40'
                        : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white font-mono">{m.label}</span>
                      <span
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          active ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                        }`}
                      >
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{m.note}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <div
              className={`rounded-2xl border p-3.5 flex items-start gap-2.5 text-xs leading-relaxed ${
                testResult.ok
                  ? 'border-emerald-500/40 bg-emerald-950/35 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-950/35 text-rose-200'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950/60 px-6 py-4">
          <button
            type="button"
            disabled={testing || (!apiKeyInput.trim() && !hasEnvFallback)}
            onClick={handleTest}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-2.5 text-xs font-bold text-slate-100 transition"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            )}
            Kiểm tra kết nối (Test Key)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
