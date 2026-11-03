// Static data behind the simulated agents (src/data/{agents,triage,records,scribe,care}), validated once and loaded
// on first use so it never weighs on the first page load.
import { z } from 'zod';
import {
  agentDefinitionSchema,
  careIntentSchema,
  careTemplatesSchema,
  followUpSetSchema,
  intentRulesSchema,
  phraseSchema,
  recordSampleSchema,
  riskConditionSchema,
  safetyRulesSchema,
  scribeScriptSchema,
  synonymSchema,
} from '@/types';

function parse<T extends z.ZodTypeAny>(name: string, schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Agent data ${name} is invalid at ${issue?.path.join('.') ?? '?'}: ${issue?.message ?? 'unknown'}`);
  }
  return result.data as z.infer<T>;
}

async function load() {
  const [
    intents,
    safety,
    definitions,
    synonyms,
    followUps,
    riskConditions,
    samples,
    scripts,
    careIntents,
    careTemplates,
    phrases,
  ] = await Promise.all([
    import('@/data/agents/intents.json'),
    import('@/data/agents/safety.json'),
    import('@/data/agents/agents.json'),
    import('@/data/triage/synonyms.json'),
    import('@/data/triage/followUps.json'),
    import('@/data/triage/riskConditions.json'),
    import('@/data/records/samples.json'),
    import('@/data/scribe/scripts.json'),
    import('@/data/care/intents.json'),
    import('@/data/care/templates.json'),
    import('@/data/care/phrases.json'),
  ]);
  // Sample document images: the "scans" a patient can upload in the demo, matched to pre-defined extractions.
  const images = import.meta.glob<string>('/src/data/records/samples/*.svg', {
    eager: true,
    query: '?url',
    import: 'default',
  });
  const sampleImages: Record<string, string> = {};
  for (const [path, url] of Object.entries(images)) sampleImages[path.slice(path.lastIndexOf('/') + 1)] = url;

  return {
    intents: parse('agents/intents.json', intentRulesSchema, intents.default).intents,
    safety: parse('agents/safety.json', safetyRulesSchema, safety.default),
    definitions: parse('agents/agents.json', z.array(agentDefinitionSchema), definitions.default),
    synonyms: parse('triage/synonyms.json', z.array(synonymSchema), synonyms.default),
    followUps: parse('triage/followUps.json', z.array(followUpSetSchema), followUps.default),
    riskConditions: parse('triage/riskConditions.json', z.array(riskConditionSchema), riskConditions.default),
    samples: parse('records/samples.json', z.array(recordSampleSchema), samples.default.samples),
    genericExtractions: parse(
      'records/samples.json',
      z.array(recordSampleSchema.shape.extraction),
      samples.default.generic,
    ),
    sampleImages,
    scripts: parse('scribe/scripts.json', z.array(scribeScriptSchema), scripts.default),
    careIntents: parse('care/intents.json', z.array(careIntentSchema), careIntents.default),
    careTemplates: parse('care/templates.json', careTemplatesSchema, careTemplates.default),
    phrases: parse('care/phrases.json', z.array(phraseSchema), phrases.default),
  };
}

export type AgentData = Awaited<ReturnType<typeof load>>;

let data: Promise<AgentData> | null = null;

export function agentData(): Promise<AgentData> {
  data ??= load();
  return data;
}
