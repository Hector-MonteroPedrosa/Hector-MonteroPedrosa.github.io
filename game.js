/* =========================================================================
   GAME.JS
   Sala de espera (estilo Gartic Phone): ajustes visibles para todos,
   editables SÓLO por quien creó la sala. "Empezar partida" abre el editor
   compartido para todos.

   Nota de alcance: esto monta la SALA (lobby, ajustes, anfitrión, jugadores).
   El modo por turnos en sí (palabra secreta, elegir entre 3, puntos por
   tiempo, pistas progresivas) es el siguiente paso — todavía no vive aquí.
   Por eso, al pulsar "Empezar partida", de momento se entra al editor 3D
   compartido tal cual funciona hoy (todos pueden modelar libremente).
   ========================================================================= */

let gameState = null;
function isHost(){ return !!(gameState && gameState.hostId === myUserId); }

onGameStateChanged = function(g){
  gameState = g;
  renderWaitingRoom();
  if(g.started){
    hideWaitingRoom();
    enterEditor();
  }
};

onPresenceChanged = function(map){
  const wrEl = document.getElementById('wr-player-list');
  if(!wrEl) return;
  const entries = Object.entries(map).sort((a,b)=>(a[1].ts||0)-(b[1].ts||0));
  wrEl.innerHTML = entries.map(([uid,p])=>{
    const hostTag = gameState && gameState.hostId===uid ? ' <span class="host-tag">★ anfitrión</span>' : '';
    const meTag = uid===myUserId ? ' <span class="me-tag">(tú)</span>' : '';
    return `<div class="wr-player">${escapeHtml(p.name)}${meTag}${hostTag}</div>`;
  }).join('') || '<div class="wr-player wr-empty">Nadie más todavía…</div>';
};

function showWaitingRoom(){
  document.getElementById('lobby-overlay').style.display='none';
  document.getElementById('waitingroom-overlay').style.display='flex';
  document.getElementById('app').style.display='none';
}
function hideWaitingRoom(){
  document.getElementById('waitingroom-overlay').style.display='none';
}

function renderWaitingRoom(){
  if(!gameState) return;
  document.getElementById('wr-room-code').textContent = currentRoomId;
  const host = isHost();
  const s = gameState.settings || {};
  const roundsInp = document.getElementById('wr-round-seconds');
  const perPlayerInp = document.getElementById('wr-rounds-per-player');
  if(document.activeElement !== roundsInp) roundsInp.value = s.roundSeconds ?? 80;
  if(document.activeElement !== perPlayerInp) perPlayerInp.value = s.roundsPerPlayer ?? 2;
  roundsInp.disabled = !host;
  perPlayerInp.disabled = !host;
  document.getElementById('wr-settings-lock').style.display = host ? 'none' : 'block';

  document.getElementById('wr-start-btn').style.display = host ? 'block' : 'none';
  document.getElementById('wr-wait-msg').style.display = host ? 'none' : 'block';
}

let settingsDebounce=null;
function writeSettingsDebounced(){
  if(!isHost()) return;
  clearTimeout(settingsDebounce);
  settingsDebounce = setTimeout(()=>{
    writeGameState({ settings: {
      roundSeconds: Math.max(20, Math.min(240, parseInt(document.getElementById('wr-round-seconds').value)||80)),
      roundsPerPlayer: Math.max(1, Math.min(10, parseInt(document.getElementById('wr-rounds-per-player').value)||2)),
    }});
  }, 350);
}
document.getElementById('wr-round-seconds').addEventListener('input', writeSettingsDebounced);
document.getElementById('wr-rounds-per-player').addEventListener('input', writeSettingsDebounced);

document.getElementById('wr-start-btn').addEventListener('click', ()=>{
  if(!isHost()) return;
  writeGameState({ started:true });
});

document.getElementById('wr-room-pill').addEventListener('click', async ()=>{
  const ok = await copyToClipboard(currentRoomId);
  const fb = document.getElementById('wr-copy-feedback');
  fb.textContent = ok ? '¡Copiado!' : 'No se pudo copiar';
  fb.classList.add('show');
  clearTimeout(fb._t);
  fb._t = setTimeout(()=>fb.classList.remove('show'), 1400);
});
document.getElementById('wr-copy-link-btn').addEventListener('click', async ()=>{
  const url = location.origin + location.pathname + '?room=' + currentRoomId;
  const ok = await copyToClipboard(url);
  const btn = document.getElementById('wr-copy-link-btn');
  const original = btn.textContent;
  btn.textContent = ok ? '¡Enlace copiado!' : 'No se pudo copiar';
  setTimeout(()=>{ btn.textContent = original; }, 1400);
});
