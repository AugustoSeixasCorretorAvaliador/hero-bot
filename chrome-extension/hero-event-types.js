export const HERO_EVENT_TYPES = Object.freeze({
  DOM_INTERACTION: 'DOM_INTERACTION',
  TOOL_CLICK: 'TOOL_CLICK',
  TOOL_PROGRESS: 'TOOL_PROGRESS',
  INSIGHT_VISIBILITY: 'INSIGHT_VISIBILITY',
  STATE_DISPATCHED: 'STATE_DISPATCHED'
});

export function isHeroEventType(type) {
  return Object.values(HERO_EVENT_TYPES).includes(type);
}
