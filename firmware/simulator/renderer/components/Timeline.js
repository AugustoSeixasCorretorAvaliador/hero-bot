;(function(){
  function Timeline(elId){
    this.el = document.getElementById(elId)
  }
  Timeline.prototype.push = function(evt, nextState, animation, duration){
    if (!this.el) return
    const row = document.createElement('div')
    row.textContent = `${evt.type} → ${nextState} → ${animation} → ${duration}ms`
    this.el.appendChild(row)
    this.el.scrollTop = this.el.scrollHeight
  }
  window.Timeline = Timeline
})();
