const wsStatusEl = document.getElementById('wsStatus');
const lastEventEl = document.getElementById('lastEvent');
const idleBtn = document.getElementById('idleBtn');
const workingBtn = document.getElementById('workingBtn');
const doneBtn = document.getElementById('doneBtn');
const errorBtn = document.getElementById('errorBtn');

function setStatus(text) {
  wsStatusEl.textContent = text;
}

function setLastEvent(type, reason) {
  lastEventEl.textContent = `${type}${reason ? ` (${reason})` : ''}`;
}

function sendEvent(eventType, payload) {
  chrome.runtime.sendMessage({ type: 'send_event', eventType, payload });
  setLastEvent(eventType, payload?.reason);
}

function init() {
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (response?.status) {
      setStatus(response.status);
    }
  });

  idleBtn.addEventListener('click', () => sendEvent('READY', { mvpState: 'IDLE', page: 'whatsapp-web', reason: 'manual_override' }));
  workingBtn.addEventListener('click', () => sendEvent('THINKING', { mvpState: 'WORKING', page: 'whatsapp-web', reason: 'manual_override' }));
  doneBtn.addEventListener('click', () => sendEvent('SUCCESS', { mvpState: 'DONE', page: 'whatsapp-web', reason: 'manual_override' }));
  errorBtn.addEventListener('click', () => sendEvent('ERROR', { mvpState: 'ERROR', page: 'whatsapp-web', reason: 'manual_override' }));
}

init();
