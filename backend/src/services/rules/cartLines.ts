import { createHash } from 'node:crypto';

export interface Selection { group: string; option: string }
export interface CustomizationGroup { name: string; options: { label: string; extraPrice: number }[] }

export type ResolvedSelections =
  | { ok: true; normalized: Selection[]; extraPricePaise: number }
  | { ok: false; message: string };

/**
 * Validates the customer's chosen options against the dish's definition stored in the database
 * and computes the extra price from THAT definition. The client never supplies a price.
 * One option per group.
 */
export function resolveSelections(definition: unknown, selections: Selection[]): ResolvedSelections {
  if (selections.length === 0) return { ok: true, normalized: [], extraPricePaise: 0 };
  const groups: CustomizationGroup[] = Array.isArray(definition) ? (definition as CustomizationGroup[]) : [];
  const seen = new Set<string>();
  let extra = 0;
  for (const sel of selections) {
    const group = groups.find((g) => g.name === sel.group);
    if (!group) return { ok: false, message: `Unknown customization "${sel.group}"` };
    if (seen.has(sel.group)) return { ok: false, message: `Choose only one option for "${sel.group}"` };
    seen.add(sel.group);
    const option = group.options.find((o) => o.label === sel.option);
    if (!option) return { ok: false, message: `"${sel.option}" is not an option for "${sel.group}"` };
    extra += Math.round(option.extraPrice * 100);
  }
  const normalized = [...selections].sort((a, b) => a.group.localeCompare(b.group));
  return { ok: true, normalized, extraPricePaise: extra };
}

/** Same dish + same options + same note => same key, so adding it again just raises the quantity. */
export function makeLineKey(foodItemId: string, normalized: Selection[], instructions: string | null | undefined): string {
  const canonical = JSON.stringify([foodItemId, normalized.map((s) => [s.group, s.option]), (instructions ?? '').trim()]);
  return createHash('sha1').update(canonical).digest('hex');
}
