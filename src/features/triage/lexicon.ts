// Word lists the triage engine uses to read answers in English, Tamil and Tanglish (Tamil typed in Latin letters).

export const YES_WORDS = [
  'yes',
  'yeah',
  'yep',
  'yup',
  'y',
  'aama',
  'aamaa',
  'amam',
  'ஆமாம்',
  'ஆமா',
  'ஆம்',
  'இருக்கு',
  'இருக்கிறது',
  'உண்டு',
];

export const NO_WORDS = [
  'no',
  'nope',
  'nah',
  'n',
  'none',
  'nothing',
  'never',
  'not really',
  'not at all',
  "don't have",
  'do not have',
  'illa',
  'illai',
  'இல்லை',
  'இல்ல',
  'கிடையாது',
  'ஒன்றுமில்லை',
  'எதுவும் இல்லை',
];

/** English negations that cancel a symptom term appearing shortly after them ("no chest pain"). */
export const NEGATIONS_BEFORE = [
  'no',
  'not',
  'without',
  'never',
  "don't",
  'dont',
  "doesn't",
  "didn't",
  'nil',
  'denies',
];

/** Tamil negations that cancel a symptom term appearing just before them ("வியர்வை இல்லை"). */
export const NEGATIONS_AFTER = ['இல்லை', 'இல்ல', 'இல்லாமல்', 'கிடையாது', 'illa', 'illai'];

export const HUMAN_REQUEST = [
  'talk to a person',
  'speak to a person',
  'talk to someone',
  'speak to someone',
  'talk to a human',
  'real person',
  'receptionist',
  'call me back',
  'please call me',
  'மனிதரிடம்',
  'ஆளிடம் பேச',
  'யாரிடமாவது பேச',
  'வரவேற்பாளர்',
  'என்னை அழைக்கவும்',
  'கூப்பிடுங்க',
];

export const SEVERITY_WORDS: ReadonlyArray<readonly [string, number]> = [
  ['unbearable', 9],
  ['terrible', 9],
  ['worst', 10],
  ['very bad', 8],
  ['severe', 8],
  ['bad', 7],
  ['moderate', 5],
  ['medium', 5],
  ['mild', 3],
  ['slight', 2],
  ['little', 2],
  ['தாங்க முடியல', 9],
  ['தாங்க முடியவில்லை', 9],
  ['கடுமையா', 8],
  ['ரொம்ப', 7],
  ['அதிகமா', 7],
  ['மிதமா', 5],
  ['லேசா', 3],
  ['கொஞ்சம்', 3],
];

export const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  ten: 10,
  ஒரு: 1,
  இரண்டு: 2,
  மூன்று: 3,
  நான்கு: 4,
  ஐந்து: 5,
  ஆறு: 6,
  ஏழு: 7,
  பத்து: 10,
};
