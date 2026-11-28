/**
 * Lightweight English morphological lemmatizer for instant internal dictionary lookup
 * (e.g. enterprises -> enterprise, companies -> company, signed -> sign, running -> run, studied -> study).
 */

const IRREGULAR_LEMMAS: Record<string, string> = {
  arose: 'arise',
  arisen: 'arise',
  became: 'become',
  began: 'begin',
  begun: 'begin',
  bent: 'bend',
  bound: 'bind',
  bought: 'buy',
  brought: 'bring',
  built: 'build',
  caught: 'catch',
  chose: 'choose',
  chosen: 'choose',
  came: 'come',
  dealt: 'deal',
  did: 'do',
  done: 'do',
  drew: 'draw',
  drawn: 'draw',
  drove: 'drive',
  driven: 'drive',
  ate: 'eat',
  eaten: 'eat',
  fell: 'fall',
  fallen: 'fall',
  fed: 'feed',
  felt: 'feel',
  fought: 'fight',
  found: 'find',
  flew: 'fly',
  flown: 'fly',
  forgot: 'forget',
  forgotten: 'forget',
  forgave: 'forgive',
  forgiven: 'forgive',
  froze: 'freeze',
  frozen: 'freeze',
  got: 'get',
  gotten: 'get',
  gave: 'give',
  given: 'give',
  went: 'go',
  gone: 'go',
  grew: 'grow',
  grown: 'grow',
  had: 'have',
  heard: 'hear',
  held: 'hold',
  kept: 'keep',
  knew: 'know',
  known: 'know',
  laid: 'lay',
  led: 'lead',
  left: 'leave',
  lent: 'lend',
  lost: 'lose',
  made: 'make',
  meant: 'mean',
  met: 'meet',
  overcame: 'overcome',
  paid: 'pay',
  proven: 'prove',
  ran: 'run',
  rose: 'rise',
  risen: 'rise',
  said: 'say',
  saw: 'see',
  seen: 'see',
  sought: 'seek',
  sold: 'sell',
  sent: 'send',
  shook: 'shake',
  shaken: 'shake',
  shown: 'show',
  sang: 'sing',
  sung: 'sing',
  sat: 'sit',
  slept: 'sleep',
  spoke: 'speak',
  spoken: 'speak',
  spent: 'spend',
  stood: 'stand',
  stole: 'steal',
  stolen: 'steal',
  stuck: 'stick',
  struck: 'strike',
  swore: 'swear',
  sworn: 'swear',
  swept: 'sweep',
  took: 'take',
  taken: 'take',
  taught: 'teach',
  tore: 'tear',
  torn: 'tear',
  told: 'tell',
  thought: 'think',
  threw: 'throw',
  thrown: 'throw',
  underwent: 'undergo',
  undergone: 'undergo',
  understood: 'understand',
  undertook: 'undertake',
  undertaken: 'undertake',
  withdrew: 'withdraw',
  withdrawn: 'withdraw',
  withheld: 'withhold',
  woke: 'wake',
  woken: 'wake',
  wore: 'wear',
  worn: 'wear',
  won: 'win',
  wrote: 'write',
  written: 'write',
  // Irregular plurals & comparatives
  children: 'child',
  men: 'man',
  women: 'woman',
  people: 'person',
  feet: 'foot',
  teeth: 'tooth',
  analyses: 'analysis',
  criteria: 'criterion',
  phenomena: 'phenomenon',
  indices: 'index',
  appendices: 'appendix',
  better: 'good',
  best: 'good',
  worse: 'bad',
  worst: 'bad',
  further: 'far',
  furthest: 'far',
};

/**
 * Return ordered unique candidate lemmas for a cleaned lowercase word/phrase.
 * Exact string is always first, followed by irregular & regular inflection candidates.
 */
export function buildLemmaCandidates(rawInput: string): string[] {
  const clean = rawInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!clean) return [];

  const candidates: string[] = [clean];
  const push = (w: string) => {
    if (w && w.length >= 2 && !candidates.includes(w)) {
      candidates.push(w);
    }
  };

  // Multi-word phrase: also try lemmatizing the first verb token (e.g., "abided by" -> "abide by", "taking over" -> "take over")
  if (clean.includes(' ')) {
    const parts = clean.split(' ');
    const headCands = buildLemmaCandidates(parts[0]);
    for (const hc of headCands.slice(1)) {
      push([hc, ...parts.slice(1)].join(' '));
    }
    return candidates;
  }

  // Strip possessive 's / s'
  const w = clean.replace(/'s$|’s$|s'$|s’$/, '');
  if (w !== clean) push(w);

  if (IRREGULAR_LEMMAS[w]) {
    push(IRREGULAR_LEMMAS[w]);
  }

  // -ies -> -y (companies -> company, applies -> apply)
  if (w.endsWith('ies') && w.length > 4) {
    push(`${w.slice(0, -3)}y`);
  }

  // -ied -> -y (studied -> study, applied -> apply)
  if (w.endsWith('ied') && w.length > 4) {
    push(`${w.slice(0, -3)}y`);
  }

  // -ves -> -f / -fe (leaves -> leaf, knives -> knife)
  if (w.endsWith('ves') && w.length > 4) {
    push(`${w.slice(0, -3)}f`);
    push(`${w.slice(0, -3)}fe`);
  }

  // -es -> base (enterprises -> enterprise, boxes -> box, watches -> watch)
  if (w.endsWith('es') && w.length > 3) {
    push(w.slice(0, -1)); // enterprises -> enterprise
    push(w.slice(0, -2)); // boxes -> box, processes -> process
  }

  // -s -> base (contracts -> contract)
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && w.length > 3) {
    push(w.slice(0, -1));
  }

  // -ing -> base / +e / undouble consonant (running -> run, making -> make, signing -> sign, lying -> lie)
  if (w.endsWith('ing') && w.length > 4) {
    const stem = w.slice(0, -3);
    push(stem);
    push(`${stem}e`);
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1));
    }
    if (stem.endsWith('y')) {
      push(`${stem.slice(0, -1)}ie`);
    }
  }

  // -ed -> base / +e / undouble consonant (signed -> sign, approved -> approve, planned -> plan)
  if (w.endsWith('ed') && w.length > 3) {
    const stem = w.slice(0, -2);
    push(stem);
    push(w.slice(0, -1)); // approved -> approve
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1));
    }
  }

  // -ier / -iest -> -y (easier -> easy)
  if (w.endsWith('ier') && w.length > 4) {
    push(`${w.slice(0, -3)}y`);
  }
  if (w.endsWith('iest') && w.length > 5) {
    push(`${w.slice(0, -4)}y`);
  }

  // -er / -est -> base / +e / undouble (larger -> large, bigger -> big)
  if (w.endsWith('er') && w.length > 4) {
    const stem = w.slice(0, -2);
    push(stem);
    push(`${stem}e`);
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1));
    }
  }
  if (w.endsWith('est') && w.length > 4) {
    const stem = w.slice(0, -3);
    push(stem);
    push(`${stem}e`);
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      push(stem.slice(0, -1));
    }
  }

  // -ily -> -y, -ly -> base (quickly -> quick, easily -> easy)
  if (w.endsWith('ily') && w.length > 4) {
    push(`${w.slice(0, -3)}y`);
  } else if (w.endsWith('ly') && w.length > 4) {
    push(w.slice(0, -2));
    push(`${w.slice(0, -2)}e`);
  }

  return candidates;
}
