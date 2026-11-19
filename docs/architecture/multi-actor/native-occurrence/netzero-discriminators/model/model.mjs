// Pure proposed metadata algorithms. No production imports or mutable source reads.
export const selection = (value, D = [], W = []) => Object.freeze({value, D:Object.freeze(D), W:Object.freeze(W)});
export function append(previous, next) {
  if (!previous) return Object.freeze({...next});
  if (previous.slot !== next.slot || previous.segment !== next.segment || previous.kind !== next.kind)
    throw Error('capture identity mismatch');
  return Object.freeze({...next, before:previous.before, beforeKey:previous.beforeKey});
}
export function compileSelected(selected) {
  // Input is already disposition-filtered. Never consult omitted history.
  const out = [], runs = new Map();
  for (const e of selected) {
    if (e.kind === 'field') { out.push(e); continue; }
    const prior = runs.get(e.slot);
    const continuous = prior && Object.is(prior.effect.afterKey, e.beforeKey);
    const merged = continuous ? Object.freeze({...e, beforeKey:prior.effect.beforeKey, before:prior.effect.before}) : e;
    const index = continuous ? prior.index : out.length;
    out[index] = merged;
    runs.set(e.slot, {index, effect:merged});
  }
  // Canceled occupancy remains in capture state until drain, not inverse output.
  return out.filter(e => e.kind === 'field' || !Object.is(e.beforeKey,e.afterKey));
}
export const inverse = e => Object.freeze({...e, before:e.after, after:e.before, beforeKey:e.afterKey, afterKey:e.beforeKey});
export function rebindFields(removal, addition) {
  if (removal.slot !== addition.slot || removal.segment !== addition.segment) throw Error('rebind identity');
  const fields = [];
  for (const key of new Set([...Object.keys(removal.before.value), ...Object.keys(addition.after.value)])) {
    const a=removal.before.value[key], b=addition.after.value[key];
    if (Object.hasOwn(removal.before.value,key) !== Object.hasOwn(addition.after.value,key) || !Object.is(a?.value,b?.value)) fields.push(Object.freeze({kind:'field',slot:`${removal.slot}/${key}`,segment:addition.segment,before:a,after:b}));
  }
  return fields;
}
export function lower(ordinary, currentKeys) {
  const keys = new Map(currentKeys), physical = [], placement = new Map();
  for (const e of ordinary) {
    if (e.kind === 'field') { physical.push(e); continue; }
    const key=keys.get(e.slot);
    if (e.afterKey === undefined) {
      keys.delete(e.slot);
      if (key !== undefined) physical.push(Object.freeze({...e,beforeKey:key}));
    } else {
      if (e.beforeKey !== undefined && key === undefined) throw Error('missing physical lifetime');
      const p=Object.freeze({...e,beforeKey:key});
      keys.set(e.slot,e.afterKey); physical.push(p);
      if (e.beforeKey === undefined && key !== undefined) placement.set(p,e);
    }
  }
  return {ordinary,physical,placement}; // Ordinary evidence remains authority, even if physical removal absent.
}
export class History {
  counts=new Map(); owners=new Map();
  replace(owner, selections) {
    const next=new Set(selections), old=this.owners.get(owner)??new Set();
    // Acquire before release; aliases within an owner count once.
    for(const s of next) if(!old.has(s)) this.counts.set(s,(this.counts.get(s)??0)+1);
    for(const s of old) if(!next.has(s)) {const n=this.counts.get(s)-1;if(n)this.counts.set(s,n);else this.counts.delete(s);}
    if(next.size)this.owners.set(owner,next);else this.owners.delete(owner);
  }
  release(owner){this.replace(owner,[]);}
}
export function render(staged, source, retained) {
  // staged comes ONLY from existing eligible reducer, never the source domain.
  // Every exact occurrence/dimension has an explicit origin and expected selection identity.
  const support=new Map(), rows=[]; let visits=0;
  const take = (address, choice) => {
    visits++;
    const actual=(choice.origin==='source'?source:retained).get(address);
    if(!actual || actual !== choice.expected) throw Error('stale/missing exact slot');
    support.set(address,actual); return actual.value;
  };
  for(const row of staged.rows) {
    const value={};
    for(const [dimension,choice] of row.slots) {
      const v=take(`${row.occurrence}/${dimension}`,choice);
      if(dimension.startsWith('f:') && v.present) value[dimension.slice(2)]=v.value;
    }
    rows.push(value);
  }
  for(const [address,choice] of staged.exclusions) take(address,choice);
  return {rows,support,visits};
}

// Disposition is an explicit result of the native normalizer/planner, not inferred here.
export function installDisposition(current, effect, disposition) {
  switch(disposition.kind) {
    case 'admitted': return effect.after;
    case 'normalized-away': return disposition.retained;
    case 'omitted': case 'refused': return current;
    case 'selected-inverse': return effect.before;
    default: throw Error('missing native disposition');
  }
}
