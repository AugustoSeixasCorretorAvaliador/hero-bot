;(function(){
  function FaceRenderer(faceElId){
    this.el = document.getElementById(faceElId)
  }
  FaceRenderer.prototype.draw = function(frame){
    if (!this.el) return
    this.el.textContent = typeof frame === 'string' ? frame : JSON.stringify(frame)
  }
  // expose
  window.FaceRenderer = FaceRenderer
})();
