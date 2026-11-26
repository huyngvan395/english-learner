export type NavTab =
  | 'vocab'
  | 'toeic-exam'
  | 'reading'
  | 'listening'
  | 'writing'
  | 'my-vocab'
  | 'notes'
  | 'analytics';

export type VocabTag =
  | '#a1'
  | '#a2'
  | '#b1'
  | '#b2'
  | '#c1'
  | '#common'
  | '#communication'
  | '#oxford'
  | '#toeic'
  | '#ets'
  | '#idioms'
  | '#ielts'
  | '#thpt'
  | '#sat'
  | '#toefl'
  | '#topic';

export type DeckCategory = 'common' | 'oxford' | 'toeic' | 'academic';

export type WordPOS = 'n' | 'v' | 'adj' | 'adv' | 'phrase';

export type MasteryStatus = 'new' | 'forgotten' | 'vague' | 'mastered';

export type SrsRating = 'again' | 'hard' | 'good' | 'easy' | 'permanent';

export interface VocabExample {
  en: string;
  vi: string;
}

export interface WordFamilyItem {
  word: string;
  pos: string;
  meaning: string;
}

export interface CollocationItem {
  phrase: string;
  meaning: string;
}

export interface VocabWord {
  id: string;
  deckId: string;
  topicId?: string;
  word: string;
  pos: WordPOS;
  ipaUK: string;
  ipaUS: string;
  meaning: string;
  definitionEn: string;
  definitionVi: string;
  examples: VocabExample[];
  wordFamily: WordFamilyItem[];
  synonyms: string[];
  antonyms: string[];
  collocations: CollocationItem[];
  audioUrlUS?: string;
  audioUrlUK?: string;
}

export interface VocabTopic {
  id: string;
  name: string;
  icon: string;
  words: VocabWord[];
}

export interface VocabDeckMeta {
  id: string;
  title: string;
  subtitle: string;
  category: DeckCategory;
  levelLabel: string;
  tags: VocabTag[];
  coverTheme: string;
  accentGradient: string;
  badgeText: string;
  topicCount: number;
  wordCount: number;
}

export interface VocabDeck extends VocabDeckMeta {
  topics: VocabTopic[];
  words: VocabWord[];
}

export interface SearchIndexEntry {
  id: string;
  word: string;
  meaningVi: string;
  ipaUS: string;
  partOfSpeech: WordPOS;
  deckId: string;
}

export interface WordProgress {
  wordId: string;
  deckId?: string;
  status: MasteryStatus;
  saved: boolean;
  reviewCount: number;
  lastReviewedAt: number;
  nextReviewAt: number;
  srsLevel?: SrsRating;
  intervalDays?: number;
  permanentlyMastered?: boolean;
}

export type NoteTargetType = 'vocab' | 'reading' | 'listening';

export interface UserNote {
  id: string;
  targetType: NoteTargetType;
  targetId: string;
  title: string;
  subtitle: string;
  content: string;
  updatedAt: number;
}

// ================= READING TYPES =================
export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface ParaphrasePair {
  textInPassage: string;
  textInAnswer: string;
  meaningVi: string;
}

export interface StructureBreakdown {
  subject?: string;
  verb?: string;
  object?: string;
  modifiers?: string;
  fullStructure?: string;
}

export interface ContextBridge {
  beforeCue: string;
  afterCue: string;
  connectorOrRef: string;
  logicVi: string;
}

export interface CrossPassageLogic {
  clue1Label: string;
  clue1Text: string;
  clue2Label: string;
  clue2Text: string;
  clue3Label?: string;
  clue3Text?: string;
  deduction: string;
}

export interface ReadingExplanation {
  classification: {
    category: string;
    signal: string;
  };
  translation: {
    questionVi: string;
    optionsVi: Record<OptionKey, string>;
  };
  proof: {
    explanation: string;
    evidenceQuote?: string;
    evidencePassageIndex?: number;
    evidenceSentenceId?: string;
  };
  wrongOptionsAnalysis: Record<OptionKey, string>;
  keyTakeaways: {
    formula: string;
    commonTrap: string;
    paraphrases: ParaphrasePair[];
  };
  // Deep-learning optional fields (100% backward-compatible with existing data)
  structureBreakdown?: StructureBreakdown | string;
  applyRule?: string;
  contextBridge?: ContextBridge;
  crossPassageLogic?: CrossPassageLogic;
}

export interface ReadingQuestionProgress {
  status: 'correct' | 'wrong';
  selectedAnswer: OptionKey;
  updatedAt: number;
}

export interface ReadingPart5BatchMeta {
  id: string;
  label: string;
  file: string;
  count: number;
}

export interface ReadingPart6BatchMeta {
  id: string;
  label: string;
  file: string;
  passageCount: number;
  questionCount: number;
}

export interface ReadingPart7BatchMeta {
  id: string;
  label: string;
  passageCountType: 'single' | 'double' | 'triple';
  file: string;
  setCount: number;
  questionCount: number;
}

export interface ReadingMeta {
  updatedAt: string;
  part5: {
    totalQuestions: number;
    topics: string[];
    batches: ReadingPart5BatchMeta[];
  };
  part6: {
    totalPassages: number;
    totalQuestions: number;
    batches: ReadingPart6BatchMeta[];
  };
  part7: {
    totalSets: number;
    totalQuestions: number;
    singleCount: number;
    doubleCount: number;
    tripleCount: number;
    batches: ReadingPart7BatchMeta[];
  };
}

export interface ReadingPart5Question {
  id: string;
  part: 5;
  topic: string;
  difficulty: 'Cơ bản' | 'Trung bình' | 'Nâng cao';
  sentence: string;
  options: Record<OptionKey, string>;
  correctAnswer: OptionKey;
  explanation: ReadingExplanation;
}

export interface BilingualSentence {
  id: string;
  en: string;
  vi: string;
}

export interface BilingualParagraph {
  id: string;
  sentences: BilingualSentence[];
}

export interface ReadingPart6Question {
  id: string;
  blankNumber: number;
  questionType: 'Ngữ pháp' | 'Từ vựng' | 'Từ nối' | 'Điền câu (Sentence Insertion)';
  options: Record<OptionKey, string>;
  correctAnswer: OptionKey;
  explanation: ReadingExplanation;
}

export interface ReadingPart6Passage {
  id: string;
  title: string;
  genre: 'Email' | 'Memo' | 'Notice' | 'Advertisement' | 'Article';
  headerMeta?: {
    from?: string;
    to?: string;
    date?: string;
    subject?: string;
  };
  paragraphs: BilingualParagraph[];
  questions: ReadingPart6Question[];
}

export interface ReadingPart7PassageDoc {
  id: string;
  tabLabel: string;
  genre:
    | 'Email'
    | 'Letter'
    | 'Text Message Chain'
    | 'Invoice / Form'
    | 'Article'
    | 'Job Posting'
    | 'Advertisement'
    | 'Web Page'
    | 'Notice'
    | 'Memo'
    | 'Schedule';
  title: string;
  headerMeta?: { label: string; value: string }[];
  chatMessages?: {
    id: string;
    sender: string;
    time: string;
    en: string;
    vi: string;
    align?: 'left' | 'right';
  }[];
  tableData?: {
    headers: string[];
    rows: { id: string; cells: string[]; viNote?: string }[];
  };
  paragraphs: BilingualParagraph[];
}

export interface ReadingPart7Question {
  id: string;
  questionNumber: number;
  questionType:
    | 'Ý chính (Main Idea)'
    | 'Thông tin chi tiết (Detail)'
    | 'Loại trừ (NOT/TRUE)'
    | 'Suy luận (Inference)'
    | 'Từ đồng nghĩa (Vocab in Context)'
    | 'Điền câu [1][2][3][4]';
  prompt: string;
  options: Record<OptionKey, string>;
  correctAnswer: OptionKey;
  explanation: ReadingExplanation;
}

export interface ReadingPart7Set {
  id: string;
  title: string;
  passageCountType: 'single' | 'double' | 'triple';
  topic: string;
  passages: ReadingPart7PassageDoc[];
  questions: ReadingPart7Question[];
}

// ================= LISTENING TYPES =================
export interface TranscriptLine {
  id: string;
  speaker: string;
  voiceGender: 'male' | 'female';
  accent: 'en-US' | 'en-GB';
  en: string;
  vi: string;
  evidenceForQuestionIds?: string[];
  startMs?: number;
  endMs?: number;
}

export interface ListeningVocabItem {
  id: string;
  word: string;
  pos: WordPOS;
  ipaUK: string;
  ipaUS: string;
  meaning: string;
  exampleEn: string;
  exampleVi: string;
}

export interface ListeningParaphrase {
  audioPhrase: string;
  answerPhrase: string;
  meaningVi: string;
}

export interface ListeningExplanation {
  trapType: string;
  trapAnalysis: string;
  paraphrases: ListeningParaphrase[];
  optionAnalysis: Record<string, string>;
  keyVocab: ListeningVocabItem[];
}

export interface ListeningPart1Question {
  id: string;
  part: 1;
  sceneType: 'single-person' | 'multiple-people' | 'scene-objects';
  title: string;
  illustrationKey: 'office-laptop' | 'meeting-whiteboard' | 'cafe-patio' | 'warehouse-shelves';
  imageUrl?: string;
  audioUrl?: string;
  transcript: TranscriptLine[];
  options: Record<OptionKey, { en: string; vi: string }>;
  correctAnswer: OptionKey;
  explanation: ListeningExplanation;
}

export type Part2OptionKey = 'A' | 'B' | 'C';

export interface ListeningPart2Question {
  id: string;
  part: 2;
  questionType:
    | 'Wh-question'
    | 'Yes/No'
    | 'Câu hỏi lựa chọn (Or)'
    | 'Câu hỏi đuôi (Tag)'
    | 'Câu trần thuật (Statement)'
    | 'Đề nghị / Yêu cầu'
    | 'Trả lời gián tiếp (Indirect)';
  title: string;
  audioUrl?: string;
  questionLine: TranscriptLine;
  options: Record<Part2OptionKey, { en: string; vi: string; speaker: string; voiceGender: 'male' | 'female'; accent: 'en-US' | 'en-GB'; startMs?: number; endMs?: number }>;
  correctAnswer: Part2OptionKey;
  explanation: ListeningExplanation;
}

export interface ListeningGraphicTable {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  footnote?: string;
}

export interface ListeningSubQuestion {
  id: string;
  questionNumber: number;
  questionType: 'Thông tin chi tiết' | 'Ý chính / Chủ đề' | 'Hành động tiếp theo' | 'Câu hỏi bảng biểu (Graphic)' | 'Hàm ý người nói (Implied Meaning)';
  prompt: string;
  promptVi: string;
  options: Record<OptionKey, { en: string; vi: string }>;
  correctAnswer: OptionKey;
  explanation: ListeningExplanation;
}

export interface ListeningPart3Set {
  id: string;
  part: 3;
  title: string;
  scenario: string;
  speakerCount: 2 | 3;
  hasGraphic?: boolean;
  graphic?: ListeningGraphicTable;
  graphicImageUrl?: string;
  audioUrl?: string;
  transcript: TranscriptLine[];
  questions: ListeningSubQuestion[];
  keyVocab: ListeningVocabItem[];
}

export interface ListeningPart4Set {
  id: string;
  part: 4;
  title: string;
  talkType: 'Tin nhắn thoại (Phone Message)' | 'Thông báo (Announcement)' | 'Giới thiệu (Introduction)' | 'Quảng cáo (Advertisement)' | 'Hướng dẫn tham quan (Tour)' | 'Phát biểu cuộc họp (Meeting)';
  hasGraphic?: boolean;
  graphic?: ListeningGraphicTable;
  graphicImageUrl?: string;
  audioUrl?: string;
  transcript: TranscriptLine[];
  questions: ListeningSubQuestion[];
  keyVocab: ListeningVocabItem[];
}

// ================= HISTORY & ANALYTICS =================
export interface AttemptRecord {
  id: string;
  timestamp: number;
  module: 'reading' | 'listening' | 'vocab';
  partLabel: string; // e.g., 'Part 5', 'Part 6', 'Part 7', 'Part 1', ...
  correctCount: number;
  totalCount: number;
  topics: { topic: string; correct: boolean }[];
}

export interface UserProfileStats {
  streak: number;
  xp: number;
  dailyGoal: number;
  todayWordsStudied: number;
  lastActiveDate: string; // YYYY-MM-DD
}

// ================= TOEIC EXAM & 7-PART DRILLS (LAZY-LOADED) =================
export type ToeicPartNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ToeicTestMeta {
  id: string;
  series: string;
  year: number;
  testNumber: number;
  title: string;
  subtitle: string;
  badge: string;
  status: 'ready' | 'planned';
  durationMinutes: number;
  miniDurationMinutes: number;
  questionCount: number;
  listeningCount: number;
  readingCount: number;
  partCounts: Record<ToeicPartNumber, number>;
}

export interface ToeicTestData {
  id: string;
  series: string;
  year: number;
  title: string;
  subtitle: string;
  durationMinutes: number;
  parts: {
    part1: ListeningPart1Question[];
    part2: ListeningPart2Question[];
    part3: ListeningPart3Set[];
    part4: ListeningPart4Set[];
    part5: ReadingPart5Question[];
    part6: ReadingPart6Passage[];
    part7: ReadingPart7Set[];
  };
}

export interface ToeicDrillMeta {
  id: string;
  part: ToeicPartNumber;
  title: string;
  subtitle: string;
  focusTag: string;
  difficulty: 'Cơ bản' | 'Trung bình' | 'Nâng cao' | 'Thực chiến ETS';
  questionCount: number;
  estimatedMinutes: number;
}

export interface ToeicDrillData {
  id: string;
  part: ToeicPartNumber;
  title: string;
  subtitle: string;
  focusTag: string;
  part1?: ListeningPart1Question[];
  part2?: ListeningPart2Question[];
  part3?: ListeningPart3Set[];
  part4?: ListeningPart4Set[];
  part5?: ReadingPart5Question[];
  part6?: ReadingPart6Passage[];
  part7?: ReadingPart7Set[];
}

export interface WrongQuestionRecord {
  id: string; // unique question id
  part: ToeicPartNumber;
  sourceTitle: string;
  topicLabel: string;
  userWrongAnswer: string;
  correctAnswer: string;
  wrongCount: number;
  lastWrongAt: number;
  // Self-contained payload for instant retry + full 5-layer / Interactive Transcript review
  payload:
    | { kind: 'part1'; item: ListeningPart1Question }
    | { kind: 'part2'; item: ListeningPart2Question }
    | { kind: 'part3'; set: ListeningPart3Set; questionId: string }
    | { kind: 'part4'; set: ListeningPart4Set; questionId: string }
    | { kind: 'part5'; item: ReadingPart5Question }
    | { kind: 'part6'; passage: ReadingPart6Passage; questionId: string }
    | { kind: 'part7'; set: ReadingPart7Set; questionId: string };
}

export interface ToeicExamHistoryItem {
  id: string;
  testId: string;
  testTitle: string;
  mode: 'full' | 'mini' | 'custom';
  selectedParts: ToeicPartNumber[];
  timestamp: number;
  elapsedSeconds: number;
  listeningCorrect: number;
  listeningTotal: number;
  readingCorrect: number;
  readingTotal: number;
  listeningScore: number | null;
  readingScore: number | null;
  totalScore: number | null;
  partBreakdown: { part: ToeicPartNumber; correct: number; total: number }[];
}

// ================= AI WRITING STUDIO TYPES =================
export type WritingMode = 'translation' | 'toeic-email' | 'opinion' | 'custom';
export type WritingDifficulty = 'Cơ bản' | 'Trung bình' | 'Nâng cao';
export type GeminiModelId = 'gemini-2.5-flash' | 'gemini-2.0-flash';

export interface WritingVocabHint {
  phrase: string;
  ipa?: string;
  pos?: string;
  meaningVi: string;
}

export interface WritingPromptItem {
  id: string;
  mode: Exclude<WritingMode, 'custom'>;
  difficulty: WritingDifficulty;
  title: string;
  category: string;
  sourceLanguage: 'vi' | 'en';
  passage: string;
  emailMeta?: {
    from: string;
    to: string;
    subject: string;
    date?: string;
  };
  instructions: string;
  checklist: string[];
  vocabHints: WritingVocabHint[];
  recommendedWords: {
    min: number;
    max: number;
  };
  recommendedMinutes: number;
}

export interface WritingBatchMeta {
  id: string;
  mode: Exclude<WritingMode, 'custom'>;
  difficulty?: WritingDifficulty;
  label: string;
  file: string;
  count: number;
}

export interface WritingMeta {
  updatedAt: string;
  totalPrompts: number;
  countsByMode: {
    translation: number;
    'toeic-email': number;
    opinion: number;
  };
  batches: WritingBatchMeta[];
}

export interface WritingInlineCorrection {
  original: string;
  corrected: string;
  errorType: string;
  explanationVi: string;
}

export interface WritingChecklistEvaluation {
  requirement: string;
  status: 'met' | 'partial' | 'missed';
  noteVi: string;
}

export interface WritingVocabTakeaway {
  word: string;
  pos: WordPOS;
  ipa: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
}

export interface WritingEvaluationResult {
  overallScore: number;
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  toeicWritingEstimate: number;
  verdictLabel: 'Chưa đạt' | 'Khá ổn' | 'Tốt' | 'Xuất sắc';
  summaryFeedbackVi: string;
  criteriaScores: {
    grammar: number;
    vocabulary: number;
    coherenceNaturalness: number;
    taskAccuracy: number;
  };
  inlineCorrections: WritingInlineCorrection[];
  checklistEvaluation: WritingChecklistEvaluation[];
  faithfulnessSummaryVi: string;
  smoothRevision: string;
  upgradedVersion: string;
  vocabTakeaways: WritingVocabTakeaway[];
}

export interface WritingSubmissionRecord {
  id: string;
  promptId: string;
  promptTitle: string;
  mode: WritingMode;
  attemptNumber: number;
  userText: string;
  wordCount: number;
  modelUsed: GeminiModelId;
  evaluation: WritingEvaluationResult;
  timestamp: number;
}
