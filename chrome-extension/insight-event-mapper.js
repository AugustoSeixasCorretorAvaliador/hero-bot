const DEFAULT_INSIGHT_TIMING = {
  afterReadyDelayMs: 800,
  insightDurationMs: 1500,
  readyWindowMs: 10000,
  postInsightSilenceMs: 4000
};

export class InsightEventMapper {
  constructor(dispatchHeroEvent, timing = DEFAULT_INSIGHT_TIMING) {
    this.dispatchHeroEvent = dispatchHeroEvent;
    this.timing = {
      ...DEFAULT_INSIGHT_TIMING,
      ...(timing || {})
    };

    this.insightVisible = false;
    this.waitingToolReady = false;
    this.lastToolReadyAt = 0;
    this.cycleId = 0;
    this.consumedCycleId = 0;
    this.lastInsightAt = 0;
    this.insightTimer = null;
    this.readyTimer = null;
    this.insightLoopActive = false;
    this.lastInsightDetail = {};
  }

  clearInsightTimer() {
    if (this.insightTimer) {
      clearTimeout(this.insightTimer);
      this.insightTimer = null;
    }
  }

  clearReadyTimer() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  clearTimers() {
    this.clearInsightTimer();
    this.clearReadyTimer();
  }

  stopInsightLoop() {
    this.insightLoopActive = false;
    this.clearTimers();
  }

  isToolLayer(payload = {}) {
    return payload?.layer === 'HERO_TOOL_EVENTS';
  }

  hasInsightWindowExpired() {
    if (!this.lastToolReadyAt) {
      return true;
    }

    return (Date.now() - this.lastToolReadyAt) > this.timing.readyWindowMs;
  }

  canEmitInsight() {
    if (!this.insightVisible) {
      return false;
    }

    if (!this.lastToolReadyAt || this.waitingToolReady) {
      return false;
    }

    if (this.cycleId === 0 || this.consumedCycleId === this.cycleId) {
      return false;
    }

    if (this.hasInsightWindowExpired()) {
      return false;
    }

    if (this.lastInsightAt && (Date.now() - this.lastInsightAt) < this.timing.postInsightSilenceMs) {
      return false;
    }

    return true;
  }

  canContinueLoop() {
    if (!this.insightVisible || !this.insightLoopActive) {
      return false;
    }

    if (this.hasInsightWindowExpired()) {
      return false;
    }

    return true;
  }

  scheduleInsightIfEligible(detail = {}) {
    if (!this.canEmitInsight()) {
      return;
    }

    if (this.insightTimer) {
      return;
    }

    const elapsedSinceReady = Date.now() - this.lastToolReadyAt;
    const waitMs = Math.max(0, this.timing.afterReadyDelayMs - elapsedSinceReady);
    this.insightTimer = setTimeout(() => {
      this.insightTimer = null;
      this.emitInsight(detail);
    }, waitMs);
  }

  emitInsight(detail = {}) {
    if (!this.insightLoopActive) {
      if (!this.canEmitInsight()) {
        return;
      }
    } else if (!this.canContinueLoop()) {
      return;
    }

    if (!this.insightLoopActive) {
      this.consumedCycleId = this.cycleId;
    }

    this.lastInsightAt = Date.now();
    this.insightLoopActive = true;
    this.lastInsightDetail = { ...detail };

    this.dispatchHeroEvent('EVENT_INSIGHT', {
      ...detail,
      layer: 'HERO_INSIGHT_EVENTS',
      trigger: 'insight_popup_visible',
      insightVisible: true
    });

    this.clearReadyTimer();
    this.readyTimer = setTimeout(() => {
      if (!this.canContinueLoop()) {
        this.stopInsightLoop();
        return;
      }

      this.dispatchHeroEvent('READY', {
        ...detail,
        layer: 'HERO_INSIGHT_EVENTS',
        trigger: 'insight_sequence_ready',
        insightVisible: this.insightVisible
      });

      this.clearInsightTimer();
      this.insightTimer = setTimeout(() => {
        if (!this.canContinueLoop()) {
          this.stopInsightLoop();
          return;
        }
        this.emitInsight(this.lastInsightDetail);
      }, this.timing.afterReadyDelayMs);
    }, this.timing.insightDurationMs);
  }

  handleStateDispatched(type, payload = {}) {
    if (!this.isToolLayer(payload)) {
      return;
    }

    if (type === 'SUCCESS') {
      this.cycleId += 1;
      this.waitingToolReady = true;
      this.lastToolReadyAt = 0;
      this.clearTimers();
      return;
    }

    if (type === 'READY' && this.waitingToolReady) {
      this.waitingToolReady = false;
      this.lastToolReadyAt = Date.now();
      this.scheduleInsightIfEligible({ source: payload?.source || 'chrome-extension' });
    }
  }

  handleInsightVisibility(visible, detail = {}) {
    this.insightVisible = Boolean(visible);

    if (!this.insightVisible) {
      this.stopInsightLoop();
      return;
    }

    this.lastInsightDetail = { ...detail };

    if (this.insightLoopActive) {
      return;
    }

    this.scheduleInsightIfEligible(detail);
  }
}
