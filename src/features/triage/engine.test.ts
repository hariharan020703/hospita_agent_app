import { describe, expect, it } from 'vitest';
import symptomRules from '@/data/symptomRules.json';
import redFlags from '@/data/redFlags.json';
import departments from '@/data/departments.json';
import { redFlagSchema, symptomRuleSchema } from '@/types';
import {
  createTriageState,
  detectRedFlag,
  mentions,
  parseAge,
  parseDuration,
  parseSeverity,
  parseYesNo,
  scoreDepartments,
  toTriageSession,
  triageStep,
  type TriageReply,
  type TriageRules,
  type TriageState,
} from './engine';

const rules: TriageRules = {
  symptomRules: symptomRules.map((r) => symptomRuleSchema.parse(r)),
  redFlags: redFlags.map((r) => redFlagSchema.parse(r)),
  departments: departments.map(({ id, active, bookable }) => ({ id, active, bookable })),
};

/** Feeds messages in order; returns the final state and every reply. */
function converse(messages: string[], lang: 'en' | 'ta' = 'en') {
  let state: TriageState = createTriageState(lang);
  const replies: TriageReply[] = [];
  for (const message of messages) {
    const turn = triageStep(state, message, rules);
    if (!turn) break;
    state = turn.state;
    replies.push(turn.reply);
  }
  return { state, replies, last: replies[replies.length - 1] };
}

describe('department routing', () => {
  it('routes chest discomfort to Cardiology and asks follow-ups in order, skipping what was already said', () => {
    const { replies, state } = converse([
      'I have chest discomfort and tiredness for 3 days',
      '5',
      '52',
      'High blood pressure',
      'No',
    ]);
    expect(replies.map((r) => (r.kind === 'question' ? r.question : r.kind))).toEqual([
      'severity',
      'age',
      'conditions',
      'safety',
      'recommendation',
    ]);
    expect(state.departmentId).toBe('cardiology');
    expect(state.answers).toMatchObject({
      duration: '3 days',
      severity: 5,
      age: 52,
      conditions: 'High blood pressure',
    });
    expect(state.safetyScreen).toBe('passed');
  });

  it('understands Tamil', () => {
    const { state, last } = converse(
      ['மூன்று நாளாக நெஞ்சு அசௌகரியமாகவும் சோர்வாகவும் இருக்கிறது', '5', '52', 'இல்லை', 'இல்லை'],
      'ta',
    );
    expect(state.departmentId).toBe('cardiology');
    expect(state.answers.duration).toContain('மூன்று');
    expect(state.answers.conditions).toBe('none');
    expect(last).toEqual({ kind: 'recommendation', departmentId: 'cardiology' });
  });

  it('understands Tanglish', () => {
    expect(scoreDepartments('nenju vali iruku', rules)[0]?.departmentId).toBe('cardiology');
  });

  it.each([
    ['My knee hurts when I climb stairs', 'orthopaedics'],
    ['I have an itchy rash on my arms', 'dermatology'],
    ['My throat is sore', 'ent'],
    ['My vision has become blurry', 'ophthalmology'],
    ['My periods are irregular', 'obgyn'],
    ['fever and headache since yesterday', 'general'],
    ['I get headaches and dizziness often', 'neurology'],
    ['கண்கள் சிவந்து நீர் வடிகிறது', 'ophthalmology'],
    ['படி ஏறும்போது முழங்கால் வலிக்கிறது', 'orthopaedics'],
    ['நேற்றிலிருந்து காய்ச்சலும் உடல் வலியும் இருக்கிறது', 'general'],
  ])('"%s" -> %s', (text, department) => {
    expect(scoreDepartments(text, rules)[0]?.departmentId).toBe(department);
  });

  it('matches whole words: "heart" and "early" never mean ENT ("ear")', () => {
    const ranked = scoreDepartments('my heart races early in the morning', rules).map((r) => r.departmentId);
    expect(ranked).not.toContain('ent');
    expect(ranked[0]).toBe('cardiology');
  });

  it('does not let long-term conditions change the department', () => {
    const { state } = converse([
      'I have an itchy rash on my arms',
      'a week',
      '4',
      '40',
      'diabetes and high blood pressure',
    ]);
    expect(state.departmentId).toBe('dermatology');
  });

  it('sends children under 14 to Paediatrics', () => {
    const { state } = converse(['fever and cough since yesterday', '5', '6']);
    expect(state.departmentId).toBe('paediatrics');
  });

  it('asks for more detail once, then hands vague complaints to the front desk', () => {
    const { replies, state } = converse(['I feel unwell', 'just not right']);
    expect(replies[0]).toMatchObject({ kind: 'question', question: 'more' });
    expect(replies[1]).toEqual({ kind: 'escalated', reason: 'unclear_routing' });
    expect(state.outcome).toBe('escalated');
  });

  it('escalates when the patient asks for a person', () => {
    expect(converse(['I want to talk to a person']).last).toEqual({ kind: 'escalated', reason: 'asked_for_human' });
  });
});

describe('red flags', () => {
  it('raises an emergency for chest pain with sweating, even across messages', () => {
    const { last, state } = converse(['I have chest pain', "and now I'm sweating a lot"]);
    expect(last).toEqual({ kind: 'emergency', redFlagId: 'rf_chest' });
    expect(state.outcome).toBe('emergency');
  });

  it('ignores negated symptoms', () => {
    expect(detectRedFlag('chest discomfort, no sweating and no left arm pain', rules.redFlags)).toBeNull();
    expect(detectRedFlag('நெஞ்சு வலி இருக்கு, வியர்வை இல்லை', rules.redFlags)).toBeNull();
  });

  it('detects Tamil red flags', () => {
    expect(detectRedFlag('நெஞ்சு வலி, வியர்வை அதிகமா இருக்கு', rules.redFlags)?.id).toBe('rf_chest');
    expect(detectRedFlag('அப்பாவுக்கு வாய் கோணலாக இருக்கிறது', rules.redFlags)?.id).toBe('rf_stroke');
  });

  it.each([
    ["I can't breathe properly", 'rf_breathing'],
    ['my father fainted', 'rf_unconscious'],
    ['she is vomiting blood', 'rf_bleeding'],
    ['my son swallowed pesticide', 'rf_poison'],
  ])('"%s" -> %s', (text, id) => {
    expect(detectRedFlag(text, rules.redFlags)?.id).toBe(id);
  });

  it('treats "yes" to the safety question as an emergency, and yes wins over no', () => {
    const { last } = converse(['chest discomfort for 2 days', '4', '60', 'none', 'no... actually yes']);
    expect(last).toEqual({ kind: 'emergency', redFlagId: 'safety_screen' });
  });

  it('re-asks an unclear safety answer, then escalates', () => {
    const { replies } = converse(['knee pain for a week', '4', '45', 'none', 'maybe', 'not sure']);
    expect(replies.at(-2)).toMatchObject({ kind: 'question', question: 'safety', repeat: true });
    expect(replies.at(-1)).toEqual({ kind: 'escalated', reason: 'safety_unclear' });
  });

  it('skips inactive flags', () => {
    const inactive = rules.redFlags.map((f) => ({ ...f, active: false }));
    expect(detectRedFlag('chest pain and sweating', inactive)).toBeNull();
  });
});

describe('parsers', () => {
  it('reads severity, age, duration and yes/no', () => {
    expect(parseSeverity('about 5/10')).toBe(5);
    expect(parseSeverity('severe')).toBe(8);
    expect(parseSeverity('கடுமையா இருக்கு')).toBe(8);
    expect(parseSeverity('I am 52')).toBeNull();
    expect(parseAge('I am 52 years old', false)).toBe(52);
    expect(parseAge('வயது 67', false)).toBe(67);
    expect(parseAge('pain for 3 days', false)).toBeNull();
    expect(parseDuration('since yesterday')).toBe('since yesterday');
    expect(parseDuration('இரண்டு வாரமாக வலி')).toBe('இரண்டு வாரமாக');
    expect(parseYesNo('ஆமாம்')).toBe('yes');
    expect(parseYesNo('இல்லை')).toBe('no');
    expect(parseYesNo("I'm not sure")).toBeNull();
    expect(mentions('no chest pain', 'chest')).toBe(false);
  });
});

describe('session record', () => {
  it('is only produced once the conversation has an outcome', () => {
    const ongoing = converse(['knee pain']);
    expect(toTriageSession(ongoing.state, { channel: 'app' })).toBeNull();
    const done = converse(['knee pain for a week', '4', '45', 'none', 'no']);
    expect(toTriageSession(done.state, { channel: 'kiosk', patientId: 'pat_001' })).toMatchObject({
      channel: 'kiosk',
      patientId: 'pat_001',
      outcome: 'recommended',
      departmentId: 'orthopaedics',
      safetyScreen: 'passed',
    });
  });
});
