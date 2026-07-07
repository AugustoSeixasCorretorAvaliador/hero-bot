let lastMessageText = '';
let lastInteractionTime = 0;
let lastInteractionWasTyping = false;
let sendCheckTimer = null;
let extensionRuntimeAvailable = true;

const MESSAGE_BOX_SELECTORS = [
  'footer div[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][data-tab]',
  '[aria-label*="Digite uma mensagem"]',
  '[aria-label*="Type a message"]',
  '[aria-label*="Digite"]',
  '[aria-label*="mensagem"]'
];

const SEND_BUTTON_SELECTORS = [
  'button[data-icon="send"]',
  'button[aria-label*="Send"]',
  'button[aria-label*="Enviar"]',
  '[data-icon="send"]',
  '[aria-label*="Send"]',
  '[aria-label*="Enviar"]'
];

function log(...args) {
  console.log('[HERO.Bot][DOM]', ...args);
}

function findElement(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  return null;
}

function findMessageBox() {
  return findElement(MESSAGE_BOX_SELECTORS);
}

function getClosestSendButton(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest(SEND_BUTTON_SELECTORS.join(','));
}

function getMessageBoxText() {
  const messageBox = findMessageBox();
  if (!messageBox) {
    return '';
  }
  return messageBox.innerText.trim();
}

function sendInteraction(action, detail = {}) {
  if (!extensionRuntimeAvailable) {
    log('extension runtime unavailable due to page unload, skipping interaction', action, detail);
    return;
  }

  log('interaction', action, detail);
  try {
    if (!chrome?.runtime?.sendMessage) {
      log('chrome.runtime.sendMessage unavailable, skipping interaction', action);
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'hero_interaction',
        action,
        detail
      },
      () => {
        if (chrome.runtime.lastError) {
          const message = String(chrome.runtime.lastError.message || 'unknown error');
          log('chrome.runtime.sendMessage error:', message, action, detail);

          if (
            message.includes('Extension context invalidated') ||
            message.includes('Could not establish connection') ||
            message.includes('Receiving end does not exist')
          ) {
            log('transient runtime error, keeping content script active');
            return;
          }

          extensionRuntimeAvailable = false;
        }
      }
    );
  } catch (error) {
    log('sendInteraction exception:', error.message || error);
  }
}

function attachMessageBoxListeners() {
  const messageBox = findMessageBox();
  if (!messageBox || messageBox.__heroMapperAttached) {
    return;
  }

  messageBox.__heroMapperAttached = true;
  messageBox.addEventListener('pointerenter', () => {
    sendInteraction('composition_mouse_enter', { reason: 'pointerenter' });
  }, true);
}

function isInsideMessageBox(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  const messageBox = findMessageBox();
  return messageBox ? messageBox.contains(target) : false;
}

function sendUserTyping(key, text) {
  if (key === 'Backspace' || key === 'Delete') {
    sendInteraction('deleted_text', { key, text });
    return;
  }
  sendInteraction('typed_key', { key, text });
}

function sendContentChanged(text) {
  sendInteraction('content_changed', { text });
}

function handleSendDetected(reason, action = 'send_button_click') {
  log('send detected', reason);
  sendInteraction(action, { reason });
}

function scheduleSendCheck() {
  clearTimeout(sendCheckTimer);
  sendCheckTimer = setTimeout(() => {
    const currentText = getMessageBoxText();
    if (
      lastInteractionWasTyping &&
      lastMessageText &&
      currentText === '' &&
      Date.now() - lastInteractionTime < 3000
    ) {
      log('message box cleared after typing, assuming send');
      handleSendDetected('message_box_cleared');
    }
    lastMessageText = currentText;
  }, 120);
}

function isModifierKey(event) {
  return [
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock',
    'Tab',
    'Escape',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Insert',
    'Delete'
  ].includes(event.key);
}

function handleEvent(event) {
  const target = event.target;

  if (event.type === 'focusin' && isInsideMessageBox(target)) {
    sendInteraction('composition_focus', { reason: 'focusin_message_box' });
    return;
  }

  if (event.type === 'click') {
    const sendButton = getClosestSendButton(target);
    if (sendButton) {
      handleSendDetected('send_button_click', 'send_button_click');
      return;
    }

    if (isInsideMessageBox(target)) {
      sendInteraction('composition_mouse_enter', { reason: 'click_message_box' });
      return;
    }
    return;
  }

  const messageBox = findMessageBox();
  if (!messageBox || !messageBox.contains(target)) {
    return;
  }

  if (event.type === 'keydown') {
    if (event.key === 'Enter' && !event.shiftKey) {
      handleSendDetected('enter_key_send', 'enter_key_send');
      return;
    }
    if (!isModifierKey(event)) {
      const currentText = getMessageBoxText();
      lastInteractionWasTyping = true;
      lastInteractionTime = Date.now();
      sendUserTyping(event.key, currentText);
    }
    return;
  }

  if (event.type === 'input') {
    const currentText = getMessageBoxText();
    if (currentText !== lastMessageText) {
      if (currentText.length < lastMessageText.length) {
        sendInteraction('deleted_text', { text: currentText });
      } else {
        sendContentChanged(currentText);
      }
      lastMessageText = currentText;
    }
    return;
  }

  if (event.type === 'paste') {
    const currentText = getMessageBoxText();
    sendContentChanged(currentText);
    lastMessageText = currentText;
    return;
  }

  if (event.type === 'keyup') {
    const currentText = getMessageBoxText();
    if (currentText !== lastMessageText) {
      sendContentChanged(currentText);
      lastMessageText = currentText;
    }
    return;
  }
}

function setupDocumentDelegation() {
  const events = ['focusin', 'click', 'input', 'paste', 'keydown', 'keyup'];
  for (const type of events) {
    document.addEventListener(type, handleEvent, true);
  }
}

function setupWindowListeners() {
  window.addEventListener('blur', () => {
    sendInteraction('window_blur', {});
  });

  window.addEventListener('unload', () => {
    extensionRuntimeAvailable = false;
  });

  window.addEventListener('pagehide', () => {
    extensionRuntimeAvailable = false;
  });
}

function setupMutationObserver() {
  const target = document.body;
  if (!target) {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    const messageBox = findMessageBox();
    if (!messageBox) {
      return;
    }

    attachMessageBoxListeners();
    const currentText = getMessageBoxText();
    if (lastMessageText && currentText === '' && Date.now() - lastInteractionTime < 3000) {
      log('message box cleared after mutation, checking for send');
      sendInteraction('enter_key_send', { reason: 'message_box_cleared' });
      lastMessageText = currentText;
      return;
    }

    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent?.closest('footer, [data-testid="conversation-panel-messages"], #main, #pane-side')) {
          log('mutation detected (characterData)');
          sendInteraction('content_changed', { reason: 'dom_characterData' });
          break;
        }
      }

      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        if (node.closest('footer, [data-testid="conversation-panel-messages"], #main, #pane-side')) {
          log('mutation detected (node change)');
          sendInteraction('content_changed', { reason: 'dom_node_change' });
          break;
        }
      }
    }

    lastMessageText = currentText;
  });

  observer.observe(target, { childList: true, subtree: true, characterData: true });
}

function init() {
  log('content script loaded');
  const messageBox = findMessageBox();
  if (messageBox) {
    log('message box found', messageBox);
    attachMessageBoxListeners();
  } else {
    log('message box not found yet');
  }
  lastMessageText = getMessageBoxText();
  setupDocumentDelegation();
  setupWindowListeners();
  setupMutationObserver();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  sendInteraction('whatsapp_loaded', {});
  init();
} else {
  window.addEventListener('load', () => {
    sendInteraction('whatsapp_loaded', {});
    setTimeout(init, 1500);
  });
}
