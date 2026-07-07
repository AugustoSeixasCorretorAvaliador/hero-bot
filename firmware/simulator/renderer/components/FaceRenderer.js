;(function(){
  function FaceRenderer(faceElId){
    this.el = document.getElementById(faceElId)
    if (this.el) {
      this.el.style.whiteSpace = 'pre'
      this.el.style.fontFamily = 'Consolas, monospace'
      this.el.style.textAlign = 'center'
      this.el.style.lineHeight = '1.2'
    }
  }
  FaceRenderer.prototype.draw = function(frame){
    if (!this.el) return
    this.el.textContent = typeof frame === 'string' ? frame : JSON.stringify(frame)
  }
  // expose
  window.FaceRenderer = FaceRenderer
})();
