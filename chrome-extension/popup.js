const wsStatusEl = document.getElementById('wsStatus');
const lastEventEl = document.getElementById('lastEvent');
const eventButtons = Array.from(document.querySelectorAll('[data-event]'));
const showMiniOverlayEl = document.getElementById('showMiniOverlay');
const sendToSimulatorEl = document.getElementById('sendToSimulator');
const overlayDebugTimelineEl = document.getElementById('overlayDebugTimeline');

function setStatus(text) {
  wsStatusEl.textContent = text;
}

function setLastEvent(type, reason) {
  lastEventEl.textContent = `${type}${reason ? ` (${reason})` : ''}`;
}

function sendEvent(eventType, payload) {
  chrome.runtime.sendMessage({ type: 'send_event', eventType, payload }, (response) => {
    if (chrome.runtime.lastError) {
      setLastEvent('ERROR', 'popup_send_failed');
      return;
    }

    if (response?.success) {
      setLastEvent(eventType, payload?.reason);
      return;
    }

    setLastEvent('ERROR', 'popup_send_failed');
  });
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get_settings' }, (response) => {
      resolve(response?.settings || null);
    });
  });
}

function updateSettings(nextSettings) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'update_settings', settings: nextSettings }, (response) => {
      resolve(response || null);
    });
  });
}

function init() {
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response?.status) {
      setStatus(response.status);
    }
  });

  getSettings().then((settings) => {
    if (!settings) {
      return;
    }

    showMiniOverlayEl.checked = Boolean(settings.showMiniOverlay);
    sendToSimulatorEl.checked = Boolean(settings.sendToSimulator);
    overlayDebugTimelineEl.checked = Boolean(settings.overlayDebugTimeline);
  });

  const syncSettings = () => {
    const nextSettings = {
      showMiniOverlay: Boolean(showMiniOverlayEl.checked),
      sendToSimulator: Boolean(sendToSimulatorEl.checked),
      overlayDebugTimeline: Boolean(overlayDebugTimelineEl.checked)
    };

    updateSettings(nextSettings).then((response) => {
      if (response?.status) {
        setStatus(response.status);
      }
    });
  };

  showMiniOverlayEl.addEventListener('change', syncSettings);
  sendToSimulatorEl.addEventListener('change', syncSettings);
  overlayDebugTimelineEl.addEventListener('change', syncSettings);

  for (const button of eventButtons) {
    const heroEvent = button.dataset.event;
    if (!heroEvent) {
      continue;
    }

    button.addEventListener('click', () => {
      sendEvent(heroEvent, {
        heroEvent,
        source: 'popup_manual_override',
        page: 'whatsapp-web',
        reason: 'manual_override'
      });
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'status_update' && message.status) {
      setStatus(message.status);
    }
  });
}

init();
