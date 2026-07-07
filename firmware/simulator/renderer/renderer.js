// New modular renderer initialization
const EVENTS = [ 'BOOT','READY','IDLE','THINKING','WRITING','SUCCESS','ERROR','HOT_LEAD','SLEEP','OFFLINE' ]

const logEl = document.getElementById('log')
const stateEl = document.getElementById('state')
const animEl = document.getElementById('animation')
const faceEl = document.getElementById('face')
const timelineEl = document.getElementById('timeline')

function isOfficialHeroEvent(type) {
  return EVENTS.includes(type)
}

function resolveAnimationName(ev) {
  if (typeof ev?.payload === 'string' && ev.payload.trim()) {
    return ev.payload.trim()
  }

  if (typeof ev?.payload?.animation === 'string' && ev.payload.animation.trim()) {
    return ev.payload.animation.trim()
  }

  return ev?.type || '-'
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

// receive HeroEvent messages (from main or external bridge)
window.electronAPI.onHeroEvent((ev)=>{
  addLog('Received: '+JSON.stringify(ev))
  const prevState = stateEl.textContent || '-'

  if (isOfficialHeroEvent(ev?.type)) {
    setState(ev.type)
  }

  const anim = resolveAnimationName(ev)
  setAnimation(anim)
  // find animation and play it
  const catalog = window._SIM_ANIMATIONS || []
  const aobj = catalog.find(x=>x.name===anim.toLowerCase() || x.name===anim)
  const duration = aobj ? Math.round((aobj.frames.length / (aobj.fps||1))*1000) : 500
  if (aobj) animRenderer.play(aobj)
  timeline.push(ev, stateEl.textContent, anim, duration)
  inspector.update({ state: stateEl.textContent, lastEvent: ev.type, queueLength: 0, animation: anim, fps: aobj ? aobj.fps : '-', timeInState: duration+'ms' })
})

addLog('Simulator ready')
