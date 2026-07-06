(function(){
  document.getElementById('demoBtn').addEventListener('click', ()=>{
    // open WhatsApp chat or scroll to contact section (placeholder)
    const wa = 'https://wa.me/?text=' + encodeURIComponent('Olá, quero solicitar uma demonstração do HERO.Bot')
    window.open(wa, '_blank')
  })
  document.getElementById('simBtn').addEventListener('click', ()=>{
    // scroll to simulator section
    document.getElementById('simulator').scrollIntoView({behavior:'smooth'})
  })
  document.getElementById('whatsappBtn').addEventListener('click', ()=>{
    const wa = 'https://wa.me/?text=' + encodeURIComponent('Solicito demonstração do HERO.Bot')
    window.open(wa, '_blank')
  })
})();
