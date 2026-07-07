const wsStatusEl = document.getElementById('wsStatus');
const lastEventEl = document.getElementById('lastEvent');
const eventButtons = Array.from(document.querySelectorAll('[data-event]'));

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

function init() {
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response?.status) {
      setStatus(response.status);
    }
  });

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
