const TOOL_EVENTS_BY_BUTTON_ID = {
  'hero-btn-core-draft': 'TOOL_RESPONSE_AI',
  'hero-btn-core-follow': 'TOOL_COPILOT',
  'hero-btn-refine': 'TOOL_REWRITE',
  'hero-btn-pdf': 'TOOL_PDF',
  'hero-btn-audio': 'TOOL_AUDIO',
  'hero-btn-credito': 'TOOL_CREDIT',
  'hero-btn-disparo': 'TOOL_BULK_SEND',
  'hero-btn-gerar-leads': 'TOOL_MAPS_LEADS',
  'hero-btn-extrair-contatos': 'TOOL_EXTRACT_CONTACTS',
  'hero-btn-hero3d-print-otimizador': 'TOOL_HERO3D'
};

const TOOL_EVENT_META = {
  TOOL_RESPONSE_AI: { label: 'Response AI', icon: 'AI', includesWriting: true },
  TOOL_COPILOT: { label: 'Copilot', icon: 'CP', includesWriting: true },
  TOOL_REWRITE: { label: 'Rewrite', icon: 'RW', includesWriting: true },
  TOOL_PDF: { label: 'PDF', icon: 'PDF', includesWriting: true },
  TOOL_AUDIO: { label: 'Audio', icon: 'AU', includesWriting: true },
  TOOL_CREDIT: { label: 'Credit', icon: 'CR', includesWriting: false },
  TOOL_BULK_SEND: { label: 'Bulk Send', icon: 'BS', includesWriting: true },
  TOOL_MAPS_LEADS: { label: 'Maps Leads', icon: 'ML', includesWriting: true },
  TOOL_EXTRACT_CONTACTS: { label: 'Extract Contacts', icon: 'EC', includesWriting: true },
  TOOL_HERO3D: { label: 'HERO3D', icon: '3D', includesWriting: true }
};

const TOOL_TIMING_DEFAULT = {
  showToolEvent: 1500,
  thinkingMinMs: 1900,
  writingSignalMinMs: 1500,
  successAfterThinking: 900,
  successAfterWriting: 900,
  returnReadyAfterSuccess: 2000
};

const TOOL_TIMING_BY_EVENT = {
  TOOL_COPILOT: {
    thinkingMinMs: 3000,
    writingSignalMinMs: 1500
  },
  TOOL_RESPONSE_AI: {
    thinkingMinMs: 3000,
    writingSignalMinMs: 1500
  },
  TOOL_CREDIT: {
    thinkingMinMs: 900,
    successAfterThinking: 700
  }
};

export const TOOL_EVENTS = new Set(Object.keys(TOOL_EVENT_META));

export class ToolEventMapper {
  constructor(dispatchHeroEvent) {
    this.dispatchHeroEvent = dispatchHeroEvent;
    this.timers = [];
    this.activeSequence = null;
    this.pendingEarlyWritingTimer = null;
  }

  clearTimers() {
    while (this.timers.length) {
      clearTimeout(this.timers.pop());
    }

    if (this.pendingEarlyWritingTimer) {
      clearTimeout(this.pendingEarlyWritingTimer);
      this.pendingEarlyWritingTimer = null;
    }
  }

  resolveToolEventByButtonId(buttonId) {
    if (!buttonId) {
      return null;
    }
    return TOOL_EVENTS_BY_BUTTON_ID[buttonId] || null;
  }

  getToolMeta(toolEvent) {
    return TOOL_EVENT_META[toolEvent] || {
      label: toolEvent,
      icon: 'TOOL',
      includesWriting: true
    };
  }

  getToolTiming(toolEvent) {
    return {
      ...TOOL_TIMING_DEFAULT,
      ...(TOOL_TIMING_BY_EVENT[toolEvent] || {})
    };
  }

  dispatchToolState(type, sequence, trigger, extra = {}) {
    this.dispatchHeroEvent(type, {
      ...sequence.detail,
      source: sequence.source,
      layer: 'HERO_TOOL_EVENTS',
      toolEvent: sequence.toolEvent,
      toolLabel: sequence.meta.label,
      toolIcon: sequence.meta.icon,
      trigger,
      ...extra
    });
  }

  emitWriting(sequence, trigger) {
    if (!sequence || !sequence.meta.includesWriting || sequence.writingEmitted) {
      return;
    }

    sequence.writingEmitted = true;
    this.dispatchToolState('WRITING', sequence, trigger);

    const successTimer = setTimeout(() => {
      if (this.activeSequence !== sequence) {
        return;
      }

      this.dispatchToolState('SUCCESS', sequence, 'tool_sequence_success');
    }, sequence.timing.successAfterWriting);
    this.timers.push(successTimer);

    const readyTimer = setTimeout(() => {
      if (this.activeSequence !== sequence) {
        return;
      }

      this.dispatchToolState('READY', sequence, 'tool_sequence_ready');
      this.activeSequence = null;
    }, sequence.timing.successAfterWriting + sequence.timing.returnReadyAfterSuccess);
    this.timers.push(readyTimer);
  }

  maybeEmitEarlyWriting(sequence, trigger = 'tool_sequence_writing_signal') {
    if (!sequence || !sequence.meta.includesWriting || sequence.writingEmitted || !sequence.thinkingStartedAt) {
      return;
    }

    const elapsedThinkingMs = Date.now() - sequence.thinkingStartedAt;
    if (elapsedThinkingMs >= sequence.timing.writingSignalMinMs) {
      this.emitWriting(sequence, trigger);
      return;
    }

    if (this.pendingEarlyWritingTimer) {
      return;
    }

    const waitMs = sequence.timing.writingSignalMinMs - elapsedThinkingMs;
    this.pendingEarlyWritingTimer = setTimeout(() => {
      this.pendingEarlyWritingTimer = null;
      if (this.activeSequence !== sequence) {
        return;
      }
      this.emitWriting(sequence, 'tool_sequence_writing_signal_min_met');
    }, waitMs);
    this.timers.push(this.pendingEarlyWritingTimer);
  }

  startSequence(toolEvent, detail = {}, source = 'chrome-extension') {
    const meta = this.getToolMeta(toolEvent);
    const timing = this.getToolTiming(toolEvent);
    this.clearTimers();

    const sequence = {
      toolEvent,
      source,
      detail,
      meta,
      timing,
      startedAt: Date.now(),
      thinkingStartedAt: 0,
      writingEmitted: false
    };
    this.activeSequence = sequence;

    this.dispatchToolState(toolEvent, sequence, 'tool_button_click');

    const thinkingTimer = setTimeout(() => {
      if (this.activeSequence !== sequence) {
        return;
      }

      sequence.thinkingStartedAt = Date.now();
      this.dispatchToolState('THINKING', sequence, 'tool_sequence_thinking');

      if (sequence.meta.includesWriting) {
        const writingTimer = setTimeout(() => {
          if (this.activeSequence !== sequence) {
            return;
          }
          this.emitWriting(sequence, 'tool_sequence_writing');
        }, sequence.timing.thinkingMinMs);
        this.timers.push(writingTimer);
        return;
      }

      const successTimer = setTimeout(() => {
        if (this.activeSequence !== sequence) {
          return;
        }
        this.dispatchToolState('SUCCESS', sequence, 'tool_sequence_success');
      }, sequence.timing.thinkingMinMs + sequence.timing.successAfterThinking);
      this.timers.push(successTimer);

      const readyTimer = setTimeout(() => {
        if (this.activeSequence !== sequence) {
          return;
        }
        this.dispatchToolState('READY', sequence, 'tool_sequence_ready');
        this.activeSequence = null;
      }, sequence.timing.thinkingMinMs + sequence.timing.successAfterThinking + sequence.timing.returnReadyAfterSuccess);
      this.timers.push(readyTimer);
    }, timing.showToolEvent);
    this.timers.push(thinkingTimer);
  }

  handleToolProgress(progressType, detail = {}) {
    if (progressType !== 'writing_detected') {
      return false;
    }

    const sequence = this.activeSequence;
    if (!sequence || !sequence.meta.includesWriting || !sequence.thinkingStartedAt) {
      return false;
    }

    this.maybeEmitEarlyWriting(sequence, detail?.trigger || 'tool_sequence_writing_signal');
    return true;
  }

  handleToolClick(buttonId, detail = {}) {
    const toolEvent = this.resolveToolEventByButtonId(buttonId);
    if (!toolEvent) {
      return false;
    }

    this.startSequence(toolEvent, { ...detail, buttonId }, 'chrome-extension');
    return true;
  }
}
