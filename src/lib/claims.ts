export type ClaimCategory = 'Raw energy' | 'Discipline' | 'Breakup' | 'Brotherhood';

export type ClaimLine = {
  text: string;
  accent?: boolean;
};

export type Claim = {
  id: string;
  lines: ClaimLine[];
  category: ClaimCategory;
};

export const CLAIMS: Claim[] = [
  {
    id: '01',
    lines: [{ text: 'EAT.' }, { text: 'SLEEP.' }, { text: 'PUSHUP.', accent: true }, { text: 'REPEAT.' }],
    category: 'Raw energy',
  },
  {
    id: '02',
    lines: [{ text: 'REPS BUILD MUSCLE.' }, { text: 'REPS BUILD MEN.', accent: true }],
    category: 'Discipline',
  },
  {
    id: '03',
    lines: [{ text: 'SHE LEFT.' }, { text: "THE BAR DIDN'T." }, { text: 'PUSH.', accent: true }],
    category: 'Breakup',
  },
  {
    id: '04',
    lines: [{ text: 'HEARTBREAK IS JUST FUEL.' }, { text: 'BURN IT.', accent: true }],
    category: 'Breakup',
  },
  {
    id: '05',
    lines: [{ text: "THE ONLY THING SHE COULDN'T TAKE." }, { text: 'YOUR GRIND.', accent: true }],
    category: 'Breakup',
  },
  {
    id: '06',
    lines: [{ text: 'FLOOR NEVER GHOSTED YOU.' }, { text: 'PUSH.', accent: true }],
    category: 'Breakup',
  },
  {
    id: '07',
    lines: [{ text: 'ALONE YOU SKIP.' }, { text: "TOGETHER YOU DON'T.", accent: true }],
    category: 'Brotherhood',
  },
  {
    id: '08',
    lines: [{ text: 'YOUR BOYS ARE WATCHING.' }, { text: 'GET DOWN.', accent: true }],
    category: 'Brotherhood',
  },
  {
    id: '09',
    lines: [{ text: 'NO THERAPY.' }, { text: 'JUST THE CREW & THE FLOOR.', accent: true }],
    category: 'Brotherhood',
  },
  {
    id: '11',
    lines: [{ text: 'DISCIPLINE IS JUST' }, { text: 'SELF-LOVE WITH REPS.', accent: true }],
    category: 'Discipline',
  },
  {
    id: '12',
    lines: [{ text: "YOU CAN'T CONTROL HER." }, { text: 'YOU CAN CONTROL THIS.', accent: true }],
    category: 'Discipline',
  },
  {
    id: '13',
    lines: [{ text: 'EVERY REP' }, { text: 'A VOTE FOR' }, { text: "THE MAN" }, { text: "YOU'RE", accent: true }, { text: "BECOMING", accent: true }],
    category: 'Discipline',
  },
  {
    id: '14',
    lines: [{ text: 'SOFT IS A CHOICE.' }, { text: 'SO IS THIS.', accent: true }],
    category: 'Discipline',
  },
  {
    id: '15',
    lines: [{ text: "THE FLOOR DOESN'T CARE" }, { text: 'HOW YOU FEEL. GOOD.', accent: true }],
    category: 'Raw energy',
  },
  {
    id: '16',
    lines: [{ text: 'PAIN TODAY.' }, { text: 'RESPECT TOMORROW.', accent: true }],
    category: 'Raw energy',
  },
  {
    id: '17',
    lines: [{ text: "NOBODY'S COMING TO SAVE YOU." }, { text: 'START PUSHING.', accent: true }],
    category: 'Raw energy',
  },
  {
    id: '18',
    lines: [
      { text: 'WEAK MEN REST.' },
      { text: 'AVERAGE MEN TRY.' },
      { text: 'YOUR CREW SHOWS UP.', accent: true },
    ],
    category: 'Brotherhood',
  },
];

/** Scale headline size down for longer lines so they stay on screen. */
export function claimFontSize(lines: ClaimLine[]): number {
  const maxLen = Math.max(...lines.map((line) => line.text.length));
  if (maxLen <= 14) return 60;
  if (maxLen <= 20) return 60;
  if (maxLen <= 26) return 60;
  if (maxLen <= 32) return 60;
  return 60;
}

export function pickRandomClaimIndex(): number {
  return Math.floor(Math.random() * CLAIMS.length);
}

export function pickRandomClaim(): Claim {
  return CLAIMS[pickRandomClaimIndex()];
}
