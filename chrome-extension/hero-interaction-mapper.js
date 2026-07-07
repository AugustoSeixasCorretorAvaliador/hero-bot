export class HeroInteractionMapper {
  constructor(dispatchHeroEvent) {
    this.dispatchHeroEvent = dispatchHeroEvent;
    this.state = 'READY';
    this.idleTimer = null;
    this.successTimer = null;
    this.logTransition('INIT', this.state);
    this.startIdleTimer();
  }

  logTransition(from, to) {
    console.log('[HeroMapper]', `${from} -> ${to}`);
  }

  setState(nextState, payload = {}) {
    if (this.state === nextState) {
      return;
    }

    const previousState = this.state;
    this.state = nextState;
    this.logTransition(previousState, nextState);
    this.dispatchHeroEvent(nextState, payload);

    if (nextState === 'READY') {
      this.startIdleTimer();
    } else {
      this.clearIdleTimer();
    }

    if (nextState === 'SUCCESS') {
      this.startSuccessTimer();
    } else {
      this.clearSuccessTimer();
    }
  }

  startIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.state === 'READY') {
        this.setState('IDLE');
      }
    }, 5000);
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  startSuccessTimer() {
    this.clearSuccessTimer();
    this.successTimer = setTimeout(() => {
      this.setState('READY', { reason: 'auto_return_ready' });
    }, 2000);
  }

  clearSuccessTimer() {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  }

  handleInteraction(action, detail = {}) {
    switch (action) {
      case 'whatsapp_loaded':
        this.setState('READY', { reason: 'whatsapp_loaded', ...detail });
        break;
      case 'composition_mouse_enter':
      case 'composition_focus':
        if (this.state === 'READY' || this.state === 'IDLE') {
          this.setState('THINKING', { reason: action, ...detail });
        }
        break;
      case 'typed_key':
      case 'deleted_text':
      case 'content_changed':
        if (this.state !== 'SUCCESS' && this.state !== 'ERROR' && this.state !== 'OFFLINE') {
          this.setState('WRITING', { reason: action, ...detail });
        }
        break;
      case 'send_button_click':
      case 'enter_key_send':
        this.setState('SUCCESS', { reason: action, ...detail });
        break;
      case 'websocket_disconnected':
        this.setState('OFFLINE', { reason: action, ...detail });
        break;
      case 'internal_error':
        this.setState('ERROR', { reason: action, ...detail });
        break;
      case 'window_blur':
        // Window blur is kept as a trigger event but does not change the current Hero state.
        break;
      default:
        break;
    }
  }
}
