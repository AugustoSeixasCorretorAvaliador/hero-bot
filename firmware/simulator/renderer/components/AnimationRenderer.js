;(function(){
  function AnimationRenderer(faceRenderer){
    this.face = faceRenderer
    this.current = null
    this.timer = null
  }
  AnimationRenderer.prototype.play = function(anim){
    if (!anim || !anim.frames) return
    this.stop()
    const fps = anim.fps || 2
    const interval = 1000 / fps
    let idx = 0
    this.current = anim
    this.timer = setInterval(()=>{
      this.face.draw(anim.frames[idx % anim.frames.length])
      idx++
    }, interval)
  }
  AnimationRenderer.prototype.stop = function(){ if (this.timer) clearInterval(this.timer); this.timer=null }
  window.AnimationRenderer = AnimationRenderer
})();
