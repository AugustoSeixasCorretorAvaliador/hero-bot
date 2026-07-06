;(function(){
  function Inspector(){
    this.fields = {
      state: document.getElementById('ins_state'),
      event: document.getElementById('ins_event'),
      queue: document.getElementById('ins_queue'),
      anim: document.getElementById('ins_anim'),
      fps: document.getElementById('ins_fps'),
      tstate: document.getElementById('ins_tstate')
    }
  }
  Inspector.prototype.update = function(data){
    if (this.fields.state) this.fields.state.textContent = data.state || '-'
    if (this.fields.event) this.fields.event.textContent = data.lastEvent || '-'
    if (this.fields.queue) this.fields.queue.textContent = (data.queueLength||0).toString()
    if (this.fields.anim) this.fields.anim.textContent = data.animation || '-'
    if (this.fields.fps) this.fields.fps.textContent = (data.fps||'-')
    if (this.fields.tstate) this.fields.tstate.textContent = (data.timeInState||'0ms')
  }
  window.Inspector = Inspector
})();
