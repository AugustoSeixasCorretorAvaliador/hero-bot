;(function(){
  function AnimationRenderer(faceRenderer){
    this.face = faceRenderer
    this.current = null
    this.timer = null
  }
  AnimationRenderer.prototype.play = function(anim, options){
    if (!anim || !anim.frames) return
    this.stop()
    const opts = options || {}
    const loop = opts.loop !== false
    const fps = anim.fps || 2
    const interval = 1000 / fps
    let idx = 0
    this.current = anim
    const maxFrames = anim.frames.length

    this.face.draw(anim.frames[0])
    if (maxFrames <= 1 && !loop) {
      return
    }

    this.timer = setInterval(()=>{
      idx += 1

      if (loop) {
        this.face.draw(anim.frames[idx % maxFrames])
        return
      }

      if (idx >= maxFrames) {
        this.stop()
        this.face.draw(anim.frames[maxFrames - 1])
        return
      }

      this.face.draw(anim.frames[idx])
    }, interval)
  }
  AnimationRenderer.prototype.stop = function(){ if (this.timer) clearInterval(this.timer); this.timer=null }
  window.AnimationRenderer = AnimationRenderer
})();
