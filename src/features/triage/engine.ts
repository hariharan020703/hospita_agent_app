// Symptom routing and red-flag detection: pure functions, no I/O. The engine routes to a department and never
// diagnoses. Order on every message: red flags -> request for a human -> answer the pending question -> routing.
// Tanglish and colloquial words are read through synonyms; complaint-specific follow-up questions come from the
// follow-up sets (src/data/triage/followUps.json) when the rules include them.
import type {
  Channel,
  Department,
  EscalationReason,
  FollowUpSet,
  Lang,
  NewTriageSession,
  RedFlag,
  RiskCondition,
  SymptomRule,
  Synonym,
  TriageAnswers,
  TriageMessage,
} from '@/types';
import { HUMAN_REQUEST, NEGATIONS_AFTER, NEGATIONS_BEFORE, NO_WORDS, SEVERITY_WORDS, YES_WORDS } from './lexicon';

/** Standard questions, plus complaint-specific follow-ups as `fu:<question id>`. */
export type QuestionKey = 'more' | 'duration' | 'severity' | 'age' | 'conditions' | 'safety' | `fu:${string}`;

/** Department-specific safety questions; others use the default one. */
export const SAFETY_DEPARTMENTS = ['cardiology', 'paediatrics', 'neurology', 'obgyn'] as const;

/** Red-flag id used when the patient answers "yes" to the safety question. */
export const SAFETY_SCREEN_FLAG = 'safety_screen';

export interface TriageRules {
  symptomRules: SymptomRule[];
  redFlags: RedFlag[];
  departments: Pick<Department, 'id' | 'active' | 'bookable'>[];
  /** Tanglish and colloquial terms, read as the English word they mean. */
  synonyms?: Synonym[];
  /** Complaint-specific follow-up questions, keyed by symptom rule. */
  followUps?: FollowUpSet[];
  /** Long-term conditions that raise urgency, with the label shown in the reason. */
  riskConditions?: RiskCondition[];
}

export type TriageOutcome = 'ongoing' | 'recommended' | 'emergency' | 'escalated';

export interface TriageState {
  lang: Lang;
  messages: TriageMessage[];
  /** Patient messages used for routing (answers about long-term conditions and safety are left out). */
  symptomText: string[];
  pending: QuestionKey | null;
  asked: QuestionKey[];
  answers: TriageAnswers;
  departmentId: string | null;
  matchedKeywords: string[];
  /** Symptom rules that matched the chosen department, strongest first. */
  ruleIds: string[];
  safetyScreen: 'passed' | 'failed' | 'not_asked';
  outcome: TriageOutcome;
  redFlagId: string | null;
  escalationReason: EscalationReason | null;
}

export type TriageReply =
  | { kind: 'question'; question: QuestionKey; departmentId: string | null; repeat: boolean }
  | { kind: 'recommendation'; departmentId: string }
  | { kind: 'emergency'; redFlagId: string }
  | { kind: 'escalated'; reason: EscalationReason };

export interface TriageTurn {
  state: TriageState;
  reply: TriageReply;
}

const MAX_REPEATS = 2;

/** The follow-up set for the strongest matching complaint, if the rules have one. */
export function followUpSetFor(state: Pick<TriageState, 'ruleIds'>, rules: TriageRules): FollowUpSet | null {
  const ruleId = state.ruleIds[0];
  return (ruleId && rules.followUps?.find((set) => set.ruleIds.includes(ruleId))) || null;
}

/** Questions for this complaint, in order: how long, how bad, complaint-specific, age, long-term conditions. */
function followUpsFor(state: TriageState, rules: TriageRules): QuestionKey[] {
  const specific = followUpSetFor(state, rules)?.questions.map((q): QuestionKey => `fu:${q.id}`) ?? [];
  return ['duration', 'severity', ...specific, 'age', 'conditions'];
}

export function createTriageState(lang: Lang): TriageState {
  return {
    lang,
    messages: [],
    symptomText: [],
    pending: null,
    asked: [],
    answers: {},
    departmentId: null,
    matchedKeywords: [],
    ruleIds: [],
    safetyScreen: 'not_asked',
    outcome: 'ongoing',
    redFlagId: null,
    escalationReason: null,
  };
}

export function appendAssistantMessage(state: TriageState, text: string): TriageState {
  return { ...state, messages: [...state.messages, { from: 'assistant', text }] };
}

// ------------------------------------------------------------------ text matching

const TAMIL = /[஀-௿]/u;
const VIRAMA_OR_U = /[்ு]$/u;

export const normalizeText = (text: string): string =>
  text.normalize('NFC').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tamil words inflect at the end (நெஞ்சு -> நெஞ்சில், காய்ச்சல் -> காய்ச்சலும்), so a Tamil term is matched by its stem:
 * a trailing virama or "u" vowel sign is dropped, unless that would leave fewer than three code points.
 */
export function tamilStem(term: string): string {
  const stem = term.replace(VIRAMA_OR_U, '');
  return [...stem].length >= 3 ? stem : term;
}

interface Occurrence {
  index: number;
  end: number;
}

const patternCache = new Map<string, RegExp>();

function termPattern(term: string): RegExp {
  let pattern = patternCache.get(term);
  if (!pattern) {
    const normalized = normalizeText(term);
    if (TAMIL.test(normalized)) {
      const stem = escapeRegExp(tamilStem(normalized)).replace(/ /g, '\\s*');
      pattern = new RegExp(`(?<=^|[\\s.,;:!?()"'/-])${stem}`, 'gu');
    } else {
      const body = escapeRegExp(normalized).replace(/ /g, '\\s+');
      pattern = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?:s|es|ing|ed|ness|y)?(?![\\p{L}\\p{N}])`, 'gu');
    }
    patternCache.set(term, pattern);
  }
  pattern.lastIndex = 0;
  return pattern;
}

function occurrences(text: string, term: string): Occurrence[] {
  const pattern = termPattern(term);
  const found: Occurrence[] = [];
  for (const match of text.matchAll(pattern)) {
    found.push({ index: match.index, end: match.index + match[0].length });
  }
  return found;
}

function isNegated(text: string, occ: Occurrence, tamil: boolean): boolean {
  if (tamil) {
    const after = text.slice(occ.end).split(/[.;!?,]/)[0] ?? '';
    const restOfWord = /^\S*/u.exec(after)?.[0] ?? '';
    if (NEGATIONS_AFTER.some((n) => restOfWord.endsWith(n))) return true;
    const nextWords = after
      .trim()
      .split(' ')
      .slice(restOfWord ? 1 : 0, restOfWord ? 3 : 2);
    return nextWords.some((w) => NEGATIONS_AFTER.some((n) => w.startsWith(n)));
  }
  const clause =
    text
      .slice(0, occ.index)
      .split(/[.;!?,]|\bbut\b/)
      .pop() ?? '';
  const previous = clause.trim().split(' ').slice(-3);
  return previous.some((w) => NEGATIONS_BEFORE.includes(w.replace(/[^a-z']/g, '')));
}

/** True when the term appears in the text and is not negated ("no sweating" does not count as sweating). */
export function mentions(text: string, term: string): boolean {
  const normalized = normalizeText(text);
  const tamil = TAMIL.test(term);
  return occurrences(normalized, term).some((occ) => !isNegated(normalized, occ, tamil));
}

const containsAny = (text: string, words: readonly string[]) => {
  const normalized = normalizeText(text);
  return words.some((w) => occurrences(normalized, w).length > 0);
};

/** True when any of the words is mentioned (not negated). */
export const mentionsAny = (text: string, words: readonly string[]): boolean => words.some((w) => mentions(text, w));

/**
 * Adds the English meaning of every Tanglish or colloquial term the patient used ("nenju vali" -> "chest pain"),
 * as separate sentences so the original words and their negations stay as they were.
 */
export function expandSynonyms(text: string, synonyms: readonly Synonym[] | undefined): string {
  if (!synonyms?.length) return text;
  const meanings = synonyms.filter((s) => mentionsAny(text, s.terms)).map((s) => s.means);
  return meanings.length ? `${text}. ${[...new Set(meanings)].join('. ')}` : text;
}

// ------------------------------------------------------------------ detectors and parsers

/** First active red flag whose term group (all terms) is mentioned, checking English and Tamil groups. */
export function detectRedFlag(text: string, redFlags: readonly RedFlag[]): RedFlag | null {
  for (const flag of redFlags) {
    if (!flag.active) continue;
    const groups = [...flag.groups.en, ...flag.groups.ta];
    if (groups.some((group) => group.every((term) => mentions(text, term)))) return flag;
  }
  return null;
}

export interface DepartmentScore {
  departmentId: string;
  score: number;
  keywords: string[];
  /** Matching symptom rules, strongest first. */
  ruleIds: string[];
}

/** Scores routable departments by matched symptom keywords; highest first. */
export function scoreDepartments(text: string, rules: TriageRules): DepartmentScore[] {
  const routable = new Set(rules.departments.filter((d) => d.active && d.bookable).map((d) => d.id));
  const scores = new Map<string, DepartmentScore>();
  const ruleScores = new Map<string, number>();
  for (const rule of rules.symptomRules) {
    if (!routable.has(rule.departmentId)) continue;
    const matched = [...rule.keywords.en, ...rule.keywords.ta].filter((k) => mentions(text, k));
    if (matched.length === 0) continue;
    const entry = scores.get(rule.departmentId) ?? {
      departmentId: rule.departmentId,
      score: 0,
      keywords: [],
      ruleIds: [],
    };
    const ruleScore = rule.weight * (1 + 0.25 * (Math.min(matched.length, 3) - 1));
    entry.score += ruleScore;
    entry.keywords.push(...matched.filter((k) => !entry.keywords.includes(k)));
    entry.ruleIds.push(rule.id);
    ruleScores.set(rule.id, ruleScore);
    scores.set(rule.departmentId, entry);
  }
  for (const entry of scores.values()) {
    entry.ruleIds.sort((a, b) => (ruleScores.get(b) ?? 0) - (ruleScores.get(a) ?? 0));
  }
  return [...scores.values()].sort(
    (a, b) => b.score - a.score || Number(b.departmentId === 'general') - Number(a.departmentId === 'general'),
  );
}

export function parseYesNo(text: string): 'yes' | 'no' | null {
  // "Yes" wins over "no": for a safety question, any yes must be taken seriously.
  if (containsAny(text, YES_WORDS)) return 'yes';
  if (containsAny(text, NO_WORDS)) return 'no';
  return null;
}

export function wantsHuman(text: string): boolean {
  return containsAny(text, HUMAN_REQUEST);
}

const DURATION_PATTERNS = [
  /\b(\d+|a|an|one|two|three|four|five|six|seven|ten|few|couple of|several)\s+(hours?|days?|weeks?|months?|years?)\b/u,
  /\b(since|from)\s+(yesterday|today|morning|last night|last week|last month)\b/u,
  /\b(yesterday|today|this morning|last night|since morning)\b/u,
  /(\d+|ஒரு|இரண்டு|ரெண்டு|மூன்று|மூணு|நான்கு|நாலு|ஐந்து|அஞ்சு|ஆறு|ஏழு|பத்து|சில|பல)\s*(மணி|நாள|நாட்கள|வார|மாத|வருட)\S*/u,
  /\b(\d+|oru|rendu|moonu|naalu|anju|aaru|pathu)\s*(naal|naala|naalaa|naatkal|naatkala|vaaram|vaarama|maasam|maasama|varusham)\b/u,
  /(நேற்று|நேத்து|இன்று|இன்னைக்கு|காலை)\S*/u,
];

export function parseDuration(text: string): string | null {
  const normalized = normalizeText(text);
  for (const pattern of DURATION_PATTERNS) {
    const match = pattern.exec(normalized);
    if (match) return match[0].trim();
  }
  return null;
}

export function parseSeverity(text: string): number | null {
  const normalized = normalizeText(text);
  const number = /(?<![\d.])(10|[1-9])(?![\d.])/.exec(normalized);
  if (number) return Number(number[1]);
  for (const [word, value] of SEVERITY_WORDS) {
    if (occurrences(normalized, word).length > 0) return value;
  }
  return null;
}

export function parseAge(text: string, expectingAge: boolean): number | null {
  const normalized = normalizeText(text);
  const explicit =
    /(\d{1,3})\s*(?:years?\s*old|yrs?\b|year-old|வயது|வயசு|vayasu|vayadhu)/u.exec(normalized) ??
    /(?:age|வயது|வயசு|vayasu)\s*:?\s*(\d{1,3})/u.exec(normalized);
  const loose = expectingAge ? /(?<!\d)(\d{1,3})(?!\d)/.exec(normalized) : null;
  const value = Number((explicit ?? loose)?.[1] ?? NaN);
  return Number.isInteger(value) && value >= 0 && value <= 120 ? value : null;
}

// ------------------------------------------------------------------ conversation

function chooseDepartment(ranked: DepartmentScore[], answers: TriageAnswers, rules: TriageRules): string | null {
  const top = ranked[0]?.departmentId ?? null;
  const paediatrics = rules.departments.find((d) => d.id === 'paediatrics' && d.active && d.bookable);
  if (top && paediatrics && answers.age !== undefined && answers.age < 14 && top !== 'obgyn') return paediatrics.id;
  return top;
}

const timesAsked = (state: TriageState, q: QuestionKey) => state.asked.filter((a) => a === q).length;

function isAnswered(state: TriageState, q: QuestionKey): boolean {
  switch (q) {
    case 'duration':
      return state.answers.duration !== undefined;
    case 'severity':
      return state.answers.severity !== undefined || timesAsked(state, q) >= MAX_REPEATS;
    case 'age':
      return state.answers.age !== undefined || timesAsked(state, q) >= MAX_REPEATS;
    case 'conditions':
      return state.answers.conditions !== undefined;
    default:
      return q.startsWith('fu:') && state.answers.extra?.[q.slice(3)] !== undefined;
  }
}

function ask(state: TriageState, question: QuestionKey, repeat = false): TriageTurn {
  return {
    state: { ...state, pending: question, asked: [...state.asked, question] },
    reply: { kind: 'question', question, departmentId: state.departmentId, repeat },
  };
}

function emergency(state: TriageState, redFlagId: string): TriageTurn {
  return {
    state: { ...state, pending: null, outcome: 'emergency', redFlagId },
    reply: { kind: 'emergency', redFlagId },
  };
}

function escalate(state: TriageState, reason: EscalationReason): TriageTurn {
  return {
    state: { ...state, pending: null, outcome: 'escalated', escalationReason: reason },
    reply: { kind: 'escalated', reason },
  };
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Processes one patient message and returns the next state and what the assistant should say. */
export function triageStep(previous: TriageState, input: string, rules: TriageRules, voice = false): TriageTurn | null {
  const text = input.trim();
  if (!text || previous.outcome !== 'ongoing') return null;

  const describesSymptoms = previous.pending !== 'conditions' && previous.pending !== 'safety';
  let state: TriageState = {
    ...previous,
    answers: { ...previous.answers },
    messages: [...previous.messages, { from: 'patient', text, ...(voice ? { voice: true } : {}) }],
    symptomText: describesSymptoms ? [...previous.symptomText, text] : previous.symptomText,
  };
  // Red flags are checked against everything the patient has said, including safety answers.
  const everything = expandSynonyms(
    state.messages
      .filter((m) => m.from === 'patient')
      .map((m) => m.text)
      .join('. '),
    rules.synonyms,
  );

  const flag = detectRedFlag(everything, rules.redFlags);
  if (flag) return emergency(state, flag.id);
  if (wantsHuman(text)) return escalate(state, 'asked_for_human');

  switch (state.pending) {
    case 'duration':
      state.answers.duration = parseDuration(text) ?? clip(text, 60);
      break;
    case 'severity': {
      const value = parseSeverity(text);
      if (value !== null) state.answers.severity = value;
      else if (timesAsked(state, 'severity') < MAX_REPEATS) return ask(state, 'severity', true);
      break;
    }
    case 'age': {
      const value = parseAge(text, true);
      if (value !== null) state.answers.age = value;
      else if (timesAsked(state, 'age') < MAX_REPEATS) return ask(state, 'age', true);
      break;
    }
    case 'conditions':
      state.answers.conditions = parseYesNo(text) === 'no' ? 'none' : clip(text, 120);
      break;
    case 'safety': {
      const answer = parseYesNo(text);
      if (answer === 'yes') return emergency({ ...state, safetyScreen: 'failed' }, SAFETY_SCREEN_FLAG);
      if (answer === 'no') {
        state = { ...state, safetyScreen: 'passed', pending: null, outcome: 'recommended' };
        return { state, reply: { kind: 'recommendation', departmentId: state.departmentId ?? 'general' } };
      }
      if (timesAsked(state, 'safety') >= MAX_REPEATS) return escalate(state, 'safety_unclear');
      return ask(state, 'safety', true);
    }
    default:
      if (state.pending?.startsWith('fu:')) {
        state.answers.extra = { ...state.answers.extra, [state.pending.slice(3)]: clip(text, 120) };
      }
      break;
  }

  // Details volunteered in any message ("for 3 days", "I am 52 years old") count as answers.
  if (state.answers.duration === undefined) {
    const duration = parseDuration(expandSynonyms(text, rules.synonyms));
    if (duration) state.answers.duration = duration;
  }
  if (state.answers.age === undefined) {
    const age = parseAge(text, false);
    if (age !== null) state.answers.age = age;
  }

  const ranked = scoreDepartments(expandSynonyms(state.symptomText.join('. '), rules.synonyms), rules);
  const departmentId = chooseDepartment(ranked, state.answers, rules);
  const chosen = ranked.find((r) => r.departmentId === departmentId);
  state = {
    ...state,
    departmentId,
    matchedKeywords: chosen?.keywords ?? [],
    ruleIds: chosen?.ruleIds ?? [],
  };

  if (!departmentId) {
    return state.asked.includes('more') ? escalate(state, 'unclear_routing') : ask(state, 'more');
  }
  const next = followUpsFor(state, rules).find((q) => !isAnswered(state, q));
  return ask(state, next ?? 'safety');
}

/** The finished conversation as a record to save; null while it is still ongoing. */
export function toTriageSession(
  state: TriageState,
  context: { channel: Channel; patientId?: string },
): NewTriageSession | null {
  if (state.outcome === 'ongoing') return null;
  return {
    lang: state.lang,
    channel: context.channel,
    ...(context.patientId ? { patientId: context.patientId } : {}),
    messages: state.messages,
    answers: state.answers,
    ...(state.departmentId ? { departmentId: state.departmentId } : {}),
    matchedKeywords: state.matchedKeywords,
    ...(state.redFlagId ? { redFlagId: state.redFlagId } : {}),
    safetyScreen: state.safetyScreen,
    outcome: state.outcome,
    ...(state.escalationReason ? { escalationReason: state.escalationReason } : {}),
  };
}

/** Department-specific safety question key suffix. */
export const safetyQuestionFor = (departmentId: string | null): (typeof SAFETY_DEPARTMENTS)[number] | 'default' =>
  SAFETY_DEPARTMENTS.find((d) => d === departmentId) ?? 'default';
