export type AssistanceStatus = 'OPEN' | 'ASSIGNED' | 'FULFILLED' | 'CLOSED';
export type AssistanceActor = 'REQUESTER' | 'NGO';

const RULES: { from: AssistanceStatus; to: AssistanceStatus; actor: AssistanceActor }[] = [
  { from: 'OPEN', to: 'ASSIGNED', actor: 'NGO' },       // an NGO takes the request
  { from: 'ASSIGNED', to: 'OPEN', actor: 'NGO' },       // the NGO cannot help after all: back to the pool
  { from: 'ASSIGNED', to: 'FULFILLED', actor: 'NGO' },
  { from: 'ASSIGNED', to: 'CLOSED', actor: 'NGO' },
  { from: 'OPEN', to: 'CLOSED', actor: 'REQUESTER' },
  { from: 'ASSIGNED', to: 'CLOSED', actor: 'REQUESTER' },
];

export type AssistanceTransitionCheck = { ok: true } | { ok: false; httpStatus: 403 | 409; message: string };

export function checkAssistanceTransition(from: AssistanceStatus, to: AssistanceStatus, actor: AssistanceActor): AssistanceTransitionCheck {
  if (from === 'FULFILLED' || from === 'CLOSED') return { ok: false, httpStatus: 409, message: `This request is already ${from.toLowerCase()}` };
  if (from === to) return { ok: false, httpStatus: 409, message: `This request is already ${to.toLowerCase()}` };
  const rules = RULES.filter((r) => r.from === from && r.to === to);
  if (rules.length === 0) return { ok: false, httpStatus: 409, message: `Invalid status change: ${from} cannot move to ${to}` };
  if (!rules.some((r) => r.actor === actor))
    return { ok: false, httpStatus: 403, message: `Only ${rules[0].actor === 'NGO' ? 'the assigned NGO' : 'the person who made the request'} can do this` };
  return { ok: true };
}

export const REQUIREMENT_OPTIONS = ['Cooked meal', 'Dry ration', 'Baby food', 'Drinking water', 'Any food'] as const;
