// New modular renderer initialization
const EVENTS = [ 'BOOT','READY','IDLE','THINKING','WRITING','SUCCESS','ERROR','HOT_LEAD','SLEEP','OFFLINE' ]
const TOOL_EVENTS = [
  'TOOL_RESPONSE_AI',
  'TOOL_COPILOT',
  'TOOL_REWRITE',
  'TOOL_PDF',
  'TOOL_AUDIO',
  'TOOL_CREDIT',
  'TOOL_BULK_SEND',
  'TOOL_MAPS_LEADS',
  'TOOL_EXTRACT_CONTACTS',
  'TOOL_HERO3D'
]
const INSIGHT_EVENTS = ['EVENT_INSIGHT']
const TOOL_EVENT_META = {
  TOOL_RESPONSE_AI: { label: 'Response AI', icon: 'AI', fallbackAnimation: 'thinking' },
  TOOL_COPILOT: { label: 'Copilot', icon: 'CP', fallbackAnimation: 'thinking' },
  TOOL_REWRITE: { label: 'Rewrite', icon: 'RW', fallbackAnimation: 'writing' },
  TOOL_PDF: { label: 'PDF', icon: 'PDF', fallbackAnimation: 'writing' },
  TOOL_AUDIO: { label: 'Audio', icon: 'AU', fallbackAnimation: 'writing' },
  TOOL_CREDIT: { label: 'Credit', icon: 'CR', fallbackAnimation: 'thinking' },
  TOOL_BULK_SEND: { label: 'Bulk Send', icon: 'BS', fallbackAnimation: 'writing' },
  TOOL_MAPS_LEADS: { label: 'Maps Leads', icon: 'ML', fallbackAnimation: 'thinking' },
  TOOL_EXTRACT_CONTACTS: { label: 'Extract Contacts', icon: 'EC', fallbackAnimation: 'thinking' },
  TOOL_HERO3D: { label: 'HERO3D', icon: '3D', fallbackAnimation: 'thinking' }
}
const INSIGHT_EVENT_META = {
  EVENT_INSIGHT: { label: 'Insight', icon: 'IN', fallbackAnimation: 'thinking' }
}

const VISUAL_EVENT_ALIASES = {
  HERO_READY: 'READY',
  HERO_OPEN: 'READY',
  LEAD_HOT: 'HOT_LEAD'
}

const logEl = document.getElementById('log')
const stateEl = document.getElementById('state')
const animEl = document.getElementById('animation')
const faceEl = document.getElementById('face')
const timelineEl = document.getElementById('timeline')
const EXPERIENCE_CATALOG = {}
const SOUND_CACHE = {}
let activeExperience = null
let transitionTimer = null
let activePriorityLockUntil = 0

function isOfficialHeroEvent(type) {
  return EVENTS.includes(type)
}

function isToolHeroEvent(type) {
  return TOOL_EVENTS.includes(type)
}

function isInsightHeroEvent(type) {
  return INSIGHT_EVENTS.includes(type)
}

function resolveIncomingExperience(ev) {
  const visualType = VISUAL_EVENT_ALIASES[ev?.type] || ev?.type
  if (!ev || (!isOfficialHeroEvent(visualType) && !isToolHeroEvent(visualType) && !isInsightHeroEvent(visualType))) {
    return null
  }

  const fromCatalog = EXPERIENCE_CATALOG[visualType]
  if (fromCatalog) {
    return fromCatalog
  }

  if (isToolHeroEvent(visualType)) {
    const meta = TOOL_EVENT_META[visualType] || {
      label: visualType,
      icon: 'TOOL',
      fallbackAnimation: 'thinking'
    }

    return {
      id: visualType,
      title: meta.label,
      animation: meta.fallbackAnimation,
      sound: null,
      loop: true,
      duration: 1500,
      priority: 2,
      next: null,
      toolIcon: meta.icon
    }
  }

  if (isInsightHeroEvent(visualType)) {
    const meta = INSIGHT_EVENT_META[visualType] || {
      label: visualType,
      icon: 'IN',
      fallbackAnimation: 'thinking'
    }

    return {
      id: visualType,
      title: meta.label,
      animation: meta.fallbackAnimation,
      sound: null,
      loop: true,
      duration: 1500,
      priority: 1,
      next: null,
      toolIcon: meta.icon
    }
  }

  return {
    id: visualType,
    title: visualType,
    animation: visualType.toLowerCase(),
    sound: `${visualType.toLowerCase()}.mp3`,
    loop: true,
    duration: 0,
    priority: 0,
    next: null
  }
}

function getSound(soundFile) {
  if (!soundFile) return null
  if (!SOUND_CACHE[soundFile]) {
    const audio = new Audio(`../assets/sounds/${soundFile}`)
    audio.preload = 'auto'
    SOUND_CACHE[soundFile] = audio
  }

  return SOUND_CACHE[soundFile]
}

function playExperienceSound(soundFile) {
  const sound = getSound(soundFile)
  if (!sound) return

  try {
    sound.currentTime = 0
    const playResult = sound.play()
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {})
    }
  } catch (_) {}
}

function clearTransitionTimer() {
  if (!transitionTimer) return
  clearTimeout(transitionTimer)
  transitionTimer = null
}

function scheduleAutoTransition(experience) {
  clearTransitionTimer()

  if (!experience?.next || !experience?.duration || experience.duration <= 0) {
    return
  }

  transitionTimer = setTimeout(() => {
    transitionTimer = null
    publish({
      type: experience.next,
      source: 'simulator:auto_transition',
      payload: {
        reason: 'experience_auto_transition',
        from: experience.id
      }
    })
  }, experience.duration)
}

function isPriorityLocked() {
  return Date.now() < activePriorityLockUntil
}

function canApplyExperience(experience) {
  if (!activeExperience) return true
  if (!isPriorityLocked()) return true

  return Number(experience.priority) >= Number(activeExperience.priority)
}

function updatePriorityLock(experience) {
  if (!experience?.duration || experience.duration <= 0) {
    activePriorityLockUntil = 0
    return
  }

  activePriorityLockUntil = Date.now() + experience.duration
}

function addLog(line) {
  const p = document.createElement('div')
  p.textContent = '['+new Date().toLocaleTimeString()+'] '+line
  logEl.appendChild(p)
  logEl.scrollTop = logEl.scrollHeight
}

function publish(ev) {
  window.electronAPI.publishEvent(ev)
  addLog('Published: '+JSON.stringify(ev))
}

function setState(s) { stateEl.textContent = s }

function setAnimation(a) {
  animEl.textContent = a
  faceEl.textContent = a[0] || ':'
}

function setToolStateDisplay(experience) {
  if (!experience || (!isToolHeroEvent(experience.id) && !isInsightHeroEvent(experience.id))) {
    return false
  }

  const icon = experience.toolIcon || (isInsightHeroEvent(experience.id) ? 'IN' : 'TOOL')
  stateEl.textContent = `${icon} ${experience.title}`
  animEl.textContent = `${experience.id}`
  faceEl.textContent = icon
  return true
}

// build test buttons (TestPanel)
const btnContainer = document.getElementById('eventButtons')
EVENTS.forEach(name => {
  const b = document.createElement('button')
  b.textContent = name
  b.onclick = () => publish({ type: name, source: 'simulator', payload: name })
  btnContainer.appendChild(b)
})
TOOL_EVENTS.forEach(name => {
  const b = document.createElement('button')
  b.textContent = name
  b.onclick = () => publish({ type: name, source: 'simulator', payload: { layer: 'HERO_TOOL_EVENTS', trigger: 'manual_tool_test' } })
  btnContainer.appendChild(b)
})
INSIGHT_EVENTS.forEach(name => {
  const b = document.createElement('button')
  b.textContent = name
  b.onclick = () => publish({ type: name, source: 'simulator', payload: { layer: 'HERO_INSIGHT_EVENTS', trigger: 'manual_insight_test' } })
  btnContainer.appendChild(b)
})

// Timeline helper
function pushTimeline(evt, nextState, animation, duration) {
  const row = document.createElement('div')
  row.textContent = `${evt.type} ↓ ${nextState} ↓ ${animation} ↓ ${duration}ms`
  timelineEl.appendChild(row)
  timelineEl.scrollTop = timelineEl.scrollHeight
}

// Load animations from main
// Initialize render modules
const faceRenderer = new (window.FaceRenderer || function(id){ this.el=document.getElementById('face'); this.draw=(f)=>{ this.el.textContent = f } })('face')
const animRenderer = new (window.AnimationRenderer || function(fr){ this.play=function(){} })(faceRenderer)
const inspector = new (window.Inspector || function(){ this.update=()=>{} })()
const timeline = new (window.Timeline || function(id){ this.push=()=>{} })('timeline')

window.electronAPI.loadAnimations().then(list=>{
  window._SIM_ANIMATIONS = list
  addLog('Loaded animations: '+list.map(a=>a.name).join(', '))
}).catch(e=>addLog('Error loading animations'))

window.electronAPI.loadExperiences().then((list) => {
  list.forEach((exp) => {
    if (!exp?.id) return
    EXPERIENCE_CATALOG[exp.id] = {
      id: exp.id,
      title: exp.title || exp.id,
      animation: exp.animation || exp.id.toLowerCase(),
      sound: exp.sound || `${exp.id.toLowerCase()}.mp3`,
      loop: exp.loop !== false,
      duration: Number(exp.duration || 0),
      priority: Number(exp.priority || 0),
      next: exp.next || null
    }
  })

  addLog('Loaded experiences: '+Object.keys(EXPERIENCE_CATALOG).join(', '))
}).catch((e) => addLog('Error loading experiences: '+(e?.message || e)))

// receive HeroEvent messages (from main or external bridge)
window.electronAPI.onHeroEvent((ev)=>{
  addLog('Received: '+JSON.stringify(ev))
  const experience = resolveIncomingExperience(ev)
  if (!experience) {
    return
  }

  if (!canApplyExperience(experience)) {
    addLog(`Ignored ${experience.id} due to active priority lock (${experience.priority} < ${activeExperience.priority})`)
    return
  }

  activeExperience = experience
  updatePriorityLock(experience)
  setState(experience.id)
  playExperienceSound(experience.sound)
  scheduleAutoTransition(experience)

  if (setToolStateDisplay(experience)) {
    timeline.push(ev, stateEl.textContent, experience.animation, experience.duration || 1500)
    inspector.update({ state: stateEl.textContent, lastEvent: ev.type, queueLength: 0, animation: experience.animation, fps: '-', timeInState: (experience.duration || 1500)+'ms' })
    return
  }

  const anim = experience.animation
  setAnimation(anim)
  // find animation and play it
  const catalog = window._SIM_ANIMATIONS || []
  const aobj = catalog.find(x=>x.name===anim.toLowerCase() || x.name===anim)
  const naturalDuration = aobj ? Math.round((aobj.frames.length / (aobj.fps||1))*1000) : 500
  const duration = experience.duration > 0 ? experience.duration : naturalDuration
  if (aobj) animRenderer.play(aobj, { loop: experience.loop })
  timeline.push(ev, stateEl.textContent, anim, duration)
  inspector.update({ state: stateEl.textContent, lastEvent: ev.type, queueLength: 0, animation: anim, fps: aobj ? aobj.fps : '-', timeInState: duration+'ms' })
})

addLog('Simulator ready')
