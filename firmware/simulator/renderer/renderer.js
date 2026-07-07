// New modular renderer initialization
const EVENTS = [ 'BOOT','READY','IDLE','THINKING','WRITING','SUCCESS','ERROR','HOT_LEAD','SLEEP','OFFLINE' ]

const logEl = document.getElementById('log')
const stateEl = document.getElementById('state')
const animEl = document.getElementById('animation')
const faceEl = document.getElementById('face')
const timelineEl = document.getElementById('timeline')
const EXPERIENCE_CATALOG = {}
const SOUND_CACHE = {}
let activeExperience = null
let transitionTimer = null

function isOfficialHeroEvent(type) {
  return EVENTS.includes(type)
}

function resolveIncomingExperience(ev) {
  if (!ev || !isOfficialHeroEvent(ev.type)) {
    return null
  }

  const fromCatalog = EXPERIENCE_CATALOG[ev.type]
  if (fromCatalog) {
    return fromCatalog
  }

  return {
    id: ev.type,
    title: ev.type,
    animation: ev.type.toLowerCase(),
    sound: `${ev.type.toLowerCase()}.mp3`,
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

// build test buttons (TestPanel)
const btnContainer = document.getElementById('eventButtons')
EVENTS.forEach(name => {
  const b = document.createElement('button')
  b.textContent = name
  b.onclick = () => publish({ type: name, source: 'simulator', payload: name })
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

  if (activeExperience && Number(experience.priority) < Number(activeExperience.priority)) {
    addLog(`Ignored ${experience.id} due to priority ${experience.priority} < ${activeExperience.priority}`)
    return
  }

  activeExperience = experience
  setState(experience.id)
  playExperienceSound(experience.sound)
  scheduleAutoTransition(experience)

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
