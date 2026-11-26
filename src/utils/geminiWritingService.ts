import {
  GeminiModelId,
  WordPOS,
  WritingChecklistEvaluation,
  WritingEvaluationResult,
  WritingInlineCorrection,
  WritingMode,
  WritingVocabTakeaway,
} from '../types';

const GEMINI_KEY_STORAGE = 'tmh_gemini_api_key_v1';
const GEMINI_MODEL_STORAGE = 'tmh_gemini_model_v1';

export const GEMINI_MODELS: { id: GeminiModelId; label: string; note: string }[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'gemini-2.5-flash (Mặc định)',
    note: 'Chấm điểm sâu sắc, sửa lỗi tự nhiên & ổn định nhất',
  },
  {
    id: 'gemini-2.0-flash',
    label: 'gemini-2.0-flash (Dự phòng quota)',
    note: 'Tốc độ cực nhanh, dùng thay thế khi model chính chạm giới hạn 429',
  },
];

export function getSavedLocalGeminiKey(): string {
  try {
    return (localStorage.getItem(GEMINI_KEY_STORAGE) || '').trim();
  } catch {
    return '';
  }
}

export function saveLocalGeminiKey(apiKey: string): void {
  try {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getEnvGeminiKey(): string {
  const envVal = (import.meta.env?.VITE_GEMINI_API_KEY as string | undefined) || '';
  return envVal.trim();
}

export function getEffectiveGeminiKey(): {
  key: string;
  source: 'local' | 'env' | 'none';
} {
  const localKey = getSavedLocalGeminiKey();
  if (localKey) return { key: localKey, source: 'local' };
  const envKey = getEnvGeminiKey();
  if (envKey) return { key: envKey, source: 'env' };
  return { key: '', source: 'none' };
}

export function getSavedGeminiModel(): GeminiModelId {
  try {
    const val = localStorage.getItem(GEMINI_MODEL_STORAGE);
    if (val === 'gemini-2.0-flash' || val === 'gemini-2.5-flash') {
      return val;
    }
  } catch {
    // Ignore
  }
  return 'gemini-2.5-flash';
}

export function saveGeminiModel(model: GeminiModelId): void {
  try {
    localStorage.setItem(GEMINI_MODEL_STORAGE, model);
  } catch {
    // Ignore
  }
}

function extractCleanJson(rawText: string): unknown {
  let cleaned = rawText.trim();
  // Remove markdown fences if model wrapped output despite responseMimeType
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const sliced = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced);
    }
    throw new Error('Phản hồi từ Gemini không đúng định dạng JSON chuẩn. Vui lòng thử chấm lại.');
  }
}

function parseFriendlyHttpError(status: number, bodyText: string, model: GeminiModelId): string {
  const lower = bodyText.toLowerCase();
  if (status === 400 && (lower.includes('api key') || lower.includes('api_key_invalid'))) {
    return 'Gemini API Key không hợp lệ. Vui lòng mở "⚙ Cài đặt Gemini API" để kiểm tra lại khóa.';
  }
  if (status === 401 || status === 403) {
    return 'API Key bị từ chối quyền truy cập (401/403). Hãy kiểm tra lại khóa hoặc tạo khóa mới tại Google AI Studio.';
  }
  if (status === 429) {
    const altModel = model === 'gemini-2.5-flash' ? 'gemini-2.0-flash' : 'gemini-2.5-flash';
    return `Đã chạm giới hạn tốc độ/quota miễn phí của ${model} (Lỗi 429). Bạn có thể đợi 30–60 giây hoặc mở Cài đặt chuyển sang model dự phòng "${altModel}".`;
  }
  if (status === 404) {
    return `Model "${model}" hiện không khả dụng trên tài khoản này (404). Hãy chuyển sang model dự phòng trong Cài đặt Gemini API.`;
  }
  if (status >= 500) {
    return `Máy chủ Google Gemini đang quá tải tạm thời (HTTP ${status}). Vui lòng thử lại sau vài giây.`;
  }
  return `Lỗi gọi Gemini API (HTTP ${status}): ${bodyText.slice(0, 180)}`;
}

function clampScore(val: unknown, max: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(max, Math.round(num * 10) / 10));
}

function normalizePos(val: unknown): WordPOS {
  const s = String(val || '').toLowerCase().trim();
  if (s === 'n' || s === 'noun') return 'n';
  if (s === 'v' || s === 'verb') return 'v';
  if (s === 'adj' || s === 'adjective') return 'adj';
  if (s === 'adv' || s === 'adverb') return 'adv';
  return 'phrase';
}

function normalizeEvaluation(raw: Record<string, unknown>, fallbackChecklist: string[]): WritingEvaluationResult {
  const overallScore = clampScore(raw.overallScore, 10);
  const rawCefr = String(raw.cefrLevel || 'B1').toUpperCase();
  const cefrLevel: WritingEvaluationResult['cefrLevel'] =
    rawCefr === 'A2' || rawCefr === 'B1' || rawCefr === 'B2' || rawCefr === 'C1' || rawCefr === 'C2'
      ? rawCefr
      : overallScore >= 8.5
      ? 'C1'
      : overallScore >= 7
      ? 'B2'
      : overallScore >= 5
      ? 'B1'
      : 'A2';

  const toeicWritingEstimate = Math.round(
    Math.max(0, Math.min(200, Number(raw.toeicWritingEstimate) || overallScore * 20))
  );

  const rawVerdict = String(raw.verdictLabel || '').trim();
  const verdictLabel: WritingEvaluationResult['verdictLabel'] =
    rawVerdict === 'Chưa đạt' || rawVerdict === 'Khá ổn' || rawVerdict === 'Tốt' || rawVerdict === 'Xuất sắc'
      ? rawVerdict
      : overallScore >= 8.5
      ? 'Xuất sắc'
      : overallScore >= 7
      ? 'Tốt'
      : overallScore >= 5
      ? 'Khá ổn'
      : 'Chưa đạt';

  const cs = (raw.criteriaScores && typeof raw.criteriaScores === 'object'
    ? (raw.criteriaScores as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const criteriaScores = {
    grammar: clampScore(cs.grammar ?? overallScore, 10),
    vocabulary: clampScore(cs.vocabulary ?? overallScore, 10),
    coherenceNaturalness: clampScore(cs.coherenceNaturalness ?? overallScore, 10),
    taskAccuracy: clampScore(cs.taskAccuracy ?? overallScore, 10),
  };

  const inlineCorrections: WritingInlineCorrection[] = Array.isArray(raw.inlineCorrections)
    ? raw.inlineCorrections
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
        .map((c) => ({
          original: String(c.original || '').trim(),
          corrected: String(c.corrected || '').trim(),
          errorType: String(c.errorType || 'Ngữ pháp').trim(),
          explanationVi: String(c.explanationVi || '').trim(),
        }))
        .filter((c) => c.original && c.corrected)
    : [];

  const checklistEvaluation: WritingChecklistEvaluation[] = Array.isArray(raw.checklistEvaluation)
    ? raw.checklistEvaluation
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
        .map((item) => {
          const st = String(item.status || 'partial').toLowerCase();
          return {
            requirement: String(item.requirement || '').trim(),
            status: (st === 'met' || st === 'missed' ? st : 'partial') as 'met' | 'partial' | 'missed',
            noteVi: String(item.noteVi || '').trim(),
          };
        })
        .filter((item) => item.requirement)
    : fallbackChecklist.map((req) => ({
        requirement: req,
        status: 'partial' as const,
        noteVi: 'Đã xem xét trong đánh giá tổng quan.',
      }));

  const vocabTakeaways: WritingVocabTakeaway[] = Array.isArray(raw.vocabTakeaways)
    ? raw.vocabTakeaways
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
        .map((v) => ({
          word: String(v.word || '').trim(),
          pos: normalizePos(v.pos),
          ipa: String(v.ipa || '').trim() || '/.../',
          meaningVi: String(v.meaningVi || '').trim(),
          exampleEn: String(v.exampleEn || '').trim(),
          exampleVi: String(v.exampleVi || '').trim(),
        }))
        .filter((v) => v.word && v.meaningVi)
        .slice(0, 6)
    : [];

  return {
    overallScore,
    cefrLevel,
    toeicWritingEstimate,
    verdictLabel,
    summaryFeedbackVi:
      String(raw.summaryFeedbackVi || '').trim() ||
      'Bài viết đã thể hiện được ý chính. Hãy xem chi tiết sửa lỗi từng câu và bản nâng cấp bên dưới để cải thiện điểm số.',
    criteriaScores,
    inlineCorrections,
    checklistEvaluation,
    faithfulnessSummaryVi:
      String(raw.faithfulnessSummaryVi || '').trim() ||
      'Mức độ bám sát yêu cầu đề bài đã được phân tích theo từng hạng mục checklist.',
    smoothRevision: String(raw.smoothRevision || '').trim(),
    upgradedVersion: String(raw.upgradedVersion || '').trim(),
    vocabTakeaways,
  };
}

export async function testGeminiConnection(
  apiKey: string,
  model: GeminiModelId
): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const key = apiKey.trim();
  if (!key) {
    return { ok: false, message: 'Vui lòng nhập Gemini API Key trước khi kiểm tra.' };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key
  )}`;
  const t0 = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with JSON {"status":"ok"}' }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
          maxOutputTokens: 32,
        },
      }),
    });

    const latencyMs = Math.round(performance.now() - t0);
    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, message: parseFriendlyHttpError(res.status, errBody, model) };
    }
    return {
      ok: true,
      latencyMs,
      message: `Kết nối thành công tới ${model} (${latencyMs}ms). Bạn đã sẵn sàng chấm bài Writing!`,
    };
  } catch {
    return {
      ok: false,
      message: 'Không thể kết nối tới máy chủ Google Gemini. Vui lòng kiểm tra kết nối mạng.',
    };
  }
}

export interface EvaluateWritingParams {
  apiKey: string;
  model: GeminiModelId;
  mode: WritingMode;
  promptTitle: string;
  sourcePassage: string;
  sourceLanguage: 'vi' | 'en';
  instructions: string;
  checklist: string[];
  userText: string;
}

export async function evaluateWritingWithGemini(
  params: EvaluateWritingParams
): Promise<WritingEvaluationResult> {
  const key = params.apiKey.trim();
  if (!key) {
    throw new Error('Chưa cấu hình Gemini API Key. Hãy bấm "⚙ Cài đặt Gemini API" ở góc trên phải để nhập khóa miễn phí.');
  }

  const modeDescription =
    params.mode === 'translation'
      ? 'Bài tập DỊCH & VIẾT ĐOẠN VĂN (Việt → Anh): đánh giá chặt độ sát nghĩa so với đoạn tiếng Việt gốc, phát hiện lỗi dịch word-by-word (Vietlish), sai thì, thiếu mạo từ/giới từ và lỗi collocation.'
      : params.mode === 'toeic-email'
      ? 'Bài thi TOEIC WRITING Questions 6–7 (Respond to a Written Request): đánh giá phong cách email công sở chuyên nghiệp, mức độ hoàn thành đủ các yêu cầu trong đề, ngữ pháp và độ tự nhiên.'
      : params.mode === 'opinion'
      ? 'Bài thi TOEIC WRITING Question 8 / Paraphrase & Summary: đánh giá lập luận rõ ràng, cấu trúc câu linh hoạt, từ nối học thuật/công sở và khả năng diễn đạt ý không chép nguyên văn đoạn gốc.'
      : 'Bài tập TỰ TẠO (Custom Passage): đánh giá bài viết tiếng Anh của người học dựa trên đoạn văn gốc và yêu cầu cụ thể do người học nhập.';

  const checklistBlock =
    params.checklist.length > 0
      ? params.checklist.map((c, idx) => `${idx + 1}. ${c}`).join('\n')
      : '1. Truyền tải đầy đủ, chính xác ý chính của đề bài.\n2. Ngữ pháp chuẩn xác và diễn đạt tiếng Anh tự nhiên.';

  const systemPrompt = `Bạn là Giám khảo chấm thi TOEIC Writing (ETS) & Chuyên gia giảng dạy Tiếng Anh Thương mại cao cấp cho người Việt.
Hãy chấm bài viết tiếng Anh của học viên một cách trung thực, thẳng thắn, sâu sắc và dễ hiểu bằng tiếng Việt.

LOẠI BÀI TẬP: ${modeDescription}
TIÊU ĐỀ BÀI: ${params.promptTitle}
NGÔN NGỮ ĐỀ GỐC: ${params.sourceLanguage === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}

ĐOẠN VĂN / TÌNH HUỐNG GỐC:
"""
${params.sourcePassage}
"""

YÊU CẦU BÀI VIẾT:
${params.instructions}

CHECKLIST YÊU CẦU CẦN ĐÁP ỨNG:
${checklistBlock}

BÀI VIẾT CỦA HỌC VIÊN:
"""
${params.userText}
"""

HÃY TRẢ VỀ DUY NHẤT MỘT JSON OBJECT HỢP LỆ THEO ĐÚNG CẤU TRÚC SAU (không thêm bất kỳ chữ hay markdown nào ngoài JSON):
{
  "overallScore": 7.5,
  "cefrLevel": "B2",
  "toeicWritingEstimate": 150,
  "verdictLabel": "Tốt",
  "summaryFeedbackVi": "2-3 câu nhận xét thẳng thắn bằng tiếng Việt: chỉ rõ điểm mạnh nổi bật nhất và 1-2 điểm yếu cốt lõi cần sửa ngay để tăng điểm.",
  "criteriaScores": {
    "grammar": 7.5,
    "vocabulary": 7.0,
    "coherenceNaturalness": 7.5,
    "taskAccuracy": 8.0
  },
  "inlineCorrections": [
    {
      "original": "trích chính xác cụm từ/vế câu bị lỗi hoặc kém tự nhiên từ bài của học viên",
      "corrected": "cụm từ/vế câu đã sửa chuẩn tự nhiên",
      "errorType": "Chọn 1 trong: Ngữ pháp | Sai từ loại | Diễn đạt Word-by-word | Thiếu giới từ | Chính tả | Từ vựng / Collocation | Dấu câu / Phong cách",
      "explanationVi": "Giải thích ngắn gọn bản chất vì sao sai để học viên nhớ và tránh lặp lại."
    }
  ],
  "checklistEvaluation": [
    {
      "requirement": "nhắc lại đúng từng mục trong checklist",
      "status": "met | partial | missed",
      "noteVi": "Nhận xét ngắn gọn học viên đã truyền tải tốt chỗ nào hoặc thiếu/lệch nghĩa ở đâu."
    }
  ],
  "faithfulnessSummaryVi": "1-2 câu tổng kết mức độ bám sát đoạn gốc / yêu cầu đề bài (có sót ý, dịch lệch hay lạc đề không).",
  "smoothRevision": "Bản sửa mượt (Band B1/B2): giữ nguyên khung ý của học viên, chỉ sửa tối thiểu lỗi ngữ pháp và câu chữ lủng củng cho tự nhiên.",
  "upgradedVersion": "Bản nâng cấp chuyên nghiệp (Band C1 / TOEIC 180-200): viết lại sắc bén, văn phong thương mại chuẩn bản xứ với collocations đắt giá.",
  "vocabTakeaways": [
    {
      "word": "từ hoặc cụm collocation đắt giá trích từ bài sửa/nâng cấp",
      "pos": "n | v | adj | adv | phrase",
      "ipa": "/phiên âm IPA chuẩn/",
      "meaningVi": "nghĩa tiếng Việt ngắn gọn, sát ngữ cảnh",
      "exampleEn": "1 câu ví dụ tiếng Anh thương mại ngắn gọn dễ áp dụng.",
      "exampleVi": "Dịch tiếng Việt câu ví dụ."
    }
  ]
}

QUY TẮC CHẤM BẮT BUỘC:
- Nếu bài viết quá ngắn, lạc đề hoàn toàn hoặc viết bằng tiếng Việt, phải chấm điểm thấp trung thực (0–3.5, verdictLabel: "Chưa đạt").
- overallScore & 4 criteriaScores trên thang 0.0–10.0 (làm tròn 1 chữ số thập phân); verdictLabel chỉ chọn 1 trong 4 nhãn: "Chưa đạt" (<5.0), "Khá ổn" (5.0–6.9), "Tốt" (7.0–8.4), "Xuất sắc" (>=8.5).
- inlineCorrections: liệt kê tối đa 10 lỗi quan trọng nhất (nếu bài gần như hoàn hảo, vẫn gợi ý 1–2 chỗ nâng cấp diễn đạt tự nhiên hơn).
- vocabTakeaways: trích xuất từ 3 đến 6 từ/collocations đắt giá nhất có trong smoothRevision / upgradedVersion.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${encodeURIComponent(
    key
  )}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(parseFriendlyHttpError(res.status, errBody, params.model));
  }

  const payload = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
  };

  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text.trim()) {
    throw new Error('Gemini không trả về nội dung đánh giá. Vui lòng thử lại hoặc rút gọn bài viết.');
  }

  const parsed = extractCleanJson(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Dữ liệu chấm bài từ Gemini không hợp lệ. Vui lòng thử chấm lại.');
  }

  return normalizeEvaluation(parsed as Record<string, unknown>, params.checklist);
}
