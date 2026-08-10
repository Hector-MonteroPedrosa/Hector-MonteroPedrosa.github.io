/* =========================================================================
   GAME.JS
   Sala de espera (estilo Gartic Phone) + el bucle de juego completo:
   turnos rotativos, elegir entre 3 palabras, cronómetro, pistas progresivas
   y puntuación por rapidez.

   Aviso honesto sobre la palabra secreta: se guarda en la base de datos
   de la sala (todos los clientes la reciben, hace falta para poder
   comprobar los aciertos), pero la interfaz sólo se la enseña a quien
   modela — quien mire la pestaña de red del navegador podría verla. Con
   reglas de Firebase abiertas y sin cuenta de usuario no hay forma de
   ocultarla del todo sin montar autenticación real; es "honor system",
   como la mayoría de clones caseros de este tipo de juego.
   ========================================================================= */

const WORD_POOL = [
  // animales
  'perro','gato','elefante','jirafa','pulpo','tortuga','serpiente','pingüino','caracol','araña',
  'cangrejo','delfín','búho','murciélago','oso','conejo','pato','dinosaurio','tiburón','abeja','rana',
  // objetos cotidianos
  'silla','mesa','taza','paraguas','reloj','tijeras','llave','martillo','gafas','zapato',
  'sombrero','maleta','bombilla','tenedor','cepillo','guitarra','libro','cámara','teléfono','botella','ancla',
  // comida
  'pizza','hamburguesa','helado','plátano','sandía','donut','pastel','taco','manzana','piña','seta',
  // vehículos
  'coche','avión','barco','bicicleta','cohete','tren','submarino','patinete','helicóptero',
  // naturaleza / lugares
  'árbol','montaña','volcán','castillo','iglú','faro','cactus','nube','arcoíris','isla',
  // fantasía
  'robot','fantasma','dragón','alienígena','unicornio','momia','vampiro',
  // otros
  'corazón','calavera','garfio','bellota','albaricoque','corona','escalera',
];

let gameState = null;
function isHost(){ return !!(gameState && gameState.hostId === myUserId); }
function amModeler(){ return !!(gameState && gameState.currentModelerId === myUserId); }

/* -------------------------------------------------------------------------
   UTILIDADES DE JUEGO (puras, sin DOM)
   ------------------------------------------------------------------------- */
function pickThreeWords(){
  const pool = WORD_POOL.slice();
  const picks = [];
  while(picks.length<3 && pool.length){
    const i = Math.floor(Math.random()*pool.length);
    picks.push(pool.splice(i,1)[0]);
  }
  return picks;
}
function normalizeGuess(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function seededShuffleIndices(word){
  let seed=0;
  for(let i=0;i<word.length;i++) seed=(seed*31+word.charCodeAt(i))>>>0;
  const idxs=[];
  for(let i=0;i<word.length;i++) if(word[i]!==' ') idxs.push(i);
  function rnd(){ seed=(seed*1103515245+12345)>>>0; return seed/4294967296; }
  for(let i=idxs.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [idxs[i],idxs[j]]=[idxs[j],idxs[i]]; }
  return idxs;
}
function computeHintPattern(word, remaining, duration){
  if(!word) return '';
  const order = seededShuffleIndices(word);
  const frac = duration>0 ? remaining/duration : 0;
  let revealCount = 0;
  if(frac<=0.5) revealCount = 1;   // pasada la mitad del tiempo: 1 letra
  if(frac<=0.25) revealCount = 2;  // pasado un cuarto del tiempo: 2 letras
  revealCount = Math.min(revealCount, order.length);
  const revealed = new Set(order.slice(0,revealCount));
  return word.split('').map((ch,i)=> ch===' ' ? '  ' : (revealed.has(i) ? ch.toUpperCase() : '_')).join(' ');
}
function computeGuessPoints(remaining, duration){
  const frac = Math.max(0, Math.min(1, remaining/duration));
  return Math.round(20 + 80*frac);
}
function computeLeaderboard(){
  const scores = {};
  (gameState && gameState.roundsHistory || []).forEach(entry=>{
    Object.entries(entry.guesses||{}).forEach(([uid,g])=>{ scores[uid]=(scores[uid]||0)+(g.points||0); });
    scores[entry.modelerId] = (scores[entry.modelerId]||0) + (entry.modelerPoints||0);
  });
  return scores;
}
function nameOf(uid){ return (lastPresenceMap[uid] && lastPresenceMap[uid].name) || 'Jugador'; }

/* -------------------------------------------------------------------------
   ENTRADA / SALIDA DE FASES
   ------------------------------------------------------------------------- */
onGameStateChanged = function(g){
  const prevPhase = gameState && gameState.phase;
  const prevModeler = gameState && gameState.currentModelerId;
  gameState = g;
  updateCanEdit();

  if(!g.started){
    clearInterval(drawTicker); clearInterval(chooseTicker);
    document.getElementById('choose-word-overlay').style.display='none';
    document.getElementById('roundend-overlay').style.display='none';
    document.getElementById('gameend-overlay').style.display='none';
    document.getElementById('game-hud').style.display='none';
    document.getElementById('scoreboard-panel').style.display='none';
    showWaitingRoom();
    renderWaitingRoom();
    return;
  }

  hideWaitingRoom();
  document.getElementById('lobby-overlay').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('game-hud').style.display='flex';
  document.getElementById('scoreboard-panel').style.display='flex';

  renderScoreboard();
  renderChooseOverlay();
  document.getElementById('roundend-overlay').style.display = g.phase==='roundEnd' ? 'flex' : 'none';
  document.getElementById('gameend-overlay').style.display = g.phase==='gameEnd' ? 'flex' : 'none';
  if(g.phase==='roundEnd') renderRoundEnd();
  if(g.phase==='gameEnd') renderGameEnd();

  if(g.phase==='drawing'){ runDrawTicker(); } else { clearInterval(drawTicker); }
  if(g.phase==='choosing' && amModeler()){ startChooseCountdown(); } else { clearInterval(chooseTicker); }

  renderHUD();

  if(prevPhase!==g.phase && g.phase==='drawing' && !amModeler()){
    const tab = document.querySelector('.rp-tab[data-rptab="chat"]');
    if(tab && !tab.classList.contains('active')) tab.click();
  }
};

onPresenceChanged = function(map){
  renderWaitingRoomPlayers(map);
  renderScoreboard();
};

function updateCanEdit(){
  const should = !currentRoomId || (gameState && gameState.started && gameState.phase==='drawing' && amModeler());
  if(canEdit && !should && typeof modal!=='undefined' && modal.active){
    cancelModal(); // se acabó tu turno a media edición: se cancela limpio, no se manda tarde
  }
  canEdit = should;
  document.getElementById('app').classList.toggle('spectator-mode', !!currentRoomId && !should);
}

/* -------------------------------------------------------------------------
   SALA DE ESPERA
   ------------------------------------------------------------------------- */
function showWaitingRoom(){
  document.getElementById('lobby-overlay').style.display='none';
  document.getElementById('waitingroom-overlay').style.display='flex';
  document.getElementById('app').style.display='none';
}
function hideWaitingRoom(){
  document.getElementById('waitingroom-overlay').style.display='none';
}
function renderWaitingRoomPlayers(map){
  const wrEl = document.getElementById('wr-player-list');
  if(!wrEl) return;
  const entries = Object.entries(map).sort((a,b)=>(a[1].ts||0)-(b[1].ts||0));
  wrEl.innerHTML = entries.map(([uid,p])=>{
    const hostTag = gameState && gameState.hostId===uid ? ' <span class="host-tag">★ anfitrión</span>' : '';
    const meTag = uid===myUserId ? ' <span class="me-tag">(tú)</span>' : '';
    return `<div class="wr-player">${escapeHtml(p.name)}${meTag}${hostTag}</div>`;
  }).join('') || '<div class="wr-player wr-empty">Nadie más todavía…</div>';
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

/* -------------------------------------------------------------------------
   EMPEZAR PARTIDA (anfitrión)
   ------------------------------------------------------------------------- */
function resetAndBroadcastScene(){
  resetSceneForNewRound();
  forceBroadcastScene();
  // por si un cliente cuyo turno acaba de terminar mandó algo tarde durante la transición
  setTimeout(()=>{ if(isHost()) forceBroadcastScene(); }, 900);
}

document.getElementById('wr-start-btn').addEventListener('click', ()=>{
  if(!isHost()) return;
  const order = Object.entries(lastPresenceMap).sort((a,b)=>(a[1].ts||0)-(b[1].ts||0)).map(([uid])=>uid);
  if(order.length===0) order.push(myUserId);
  const totalRounds = (gameState.settings && gameState.settings.roundsPerPlayer) || 2;
  writeGameState({
    started:true, turnOrder:order, turnIndex:0, round:1, totalRounds,
    currentModelerId: order[0], phase:'choosing', word:null,
    wordChoices: pickThreeWords(), correctGuessers:{}, roundsHistory:[],
    chooseDeadline: serverNow()+15000,
  });
  resetAndBroadcastScene();
});

/* -------------------------------------------------------------------------
   ELEGIR PALABRA (sólo la ve quien modela esta ronda)
   ------------------------------------------------------------------------- */
let chooseTicker=null;
function renderChooseOverlay(){
  const overlay = document.getElementById('choose-word-overlay');
  const show = gameState.phase==='choosing' && amModeler();
  overlay.style.display = show ? 'flex' : 'none';
  if(show){
    const el = document.getElementById('choose-word-buttons');
    el.innerHTML = (gameState.wordChoices||[]).map(w=>
      `<button class="choose-word-btn" data-word="${escapeHtml(w)}">${escapeHtml(w.toUpperCase())}</button>`
    ).join('');
    el.querySelectorAll('.choose-word-btn').forEach(btn=>{
      btn.onclick = ()=> pickWord(btn.dataset.word);
    });
  }
}
function startChooseCountdown(){
  clearInterval(chooseTicker);
  chooseTicker = setInterval(()=>{
    const remaining = Math.max(0, Math.ceil(((gameState.chooseDeadline||serverNow())-serverNow())/1000));
    const el = document.getElementById('choose-word-timer');
    if(el) el.textContent = remaining;
    if(remaining<=0){
      clearInterval(chooseTicker);
      const opts = gameState.wordChoices && gameState.wordChoices.length ? gameState.wordChoices : pickThreeWords();
      pickWord(opts[Math.floor(Math.random()*opts.length)]);
    }
  }, 250);
}
function pickWord(word){
  clearInterval(chooseTicker);
  writeGameState({ word, phase:'drawing', roundStartTs:serverNow(), correctGuessers:{}, wordChoices:null });
}

/* -------------------------------------------------------------------------
   FASE DE DIBUJO/MODELADO: cronómetro + pistas + fin de ronda (anfitrión)
   ------------------------------------------------------------------------- */
let drawTicker=null;
let roundEndingInProgress=false;
function runDrawTicker(){
  clearInterval(drawTicker);
  roundEndingInProgress=false;
  drawTicker = setInterval(tickDrawPhase, 400);
  tickDrawPhase();
}
function tickDrawPhase(){
  if(!gameState || gameState.phase!=='drawing') { clearInterval(drawTicker); return; }
  renderHUD();
  if(isHost()){
    const duration = (gameState.settings && gameState.settings.roundSeconds) || 80;
    const elapsed = (serverNow()-(gameState.roundStartTs||serverNow()))/1000;
    const remaining = duration-elapsed;
    if(remaining<=0 || allNonModelersGuessed()){ endRoundAsHost(); }
  }
}
function allNonModelersGuessed(){
  const others = Object.keys(lastPresenceMap||{}).filter(uid=>uid!==gameState.currentModelerId);
  if(others.length===0) return false;
  const guessed = new Set(Object.keys(gameState.correctGuessers||{}));
  return others.every(uid=>guessed.has(uid));
}
function endRoundAsHost(){
  if(!gameState || gameState.phase!=='drawing' || roundEndingInProgress) return;
  roundEndingInProgress=true;
  const modelerId = gameState.currentModelerId;
  const guesses = gameState.correctGuessers||{};
  const modelerPoints = Object.keys(guesses).length*50;
  const historyEntry = { round:gameState.round, modelerId, word:gameState.word, guesses, modelerPoints };
  const newHistory = (gameState.roundsHistory||[]).concat([historyEntry]);
  writeGameState({ phase:'roundEnd', roundsHistory:newHistory });
  setTimeout(()=>{ if(isHost()) hostAdvanceRound(); }, 6000);
}
function hostAdvanceRound(){
  if(!isHost() || !gameState) return;
  let { turnIndex, round, totalRounds, turnOrder } = gameState;
  turnIndex++;
  if(turnIndex>=turnOrder.length){ turnIndex=0; round++; }
  if(round>totalRounds){ writeGameState({ phase:'gameEnd' }); return; }
  writeGameState({
    turnIndex, round, currentModelerId: turnOrder[turnIndex], phase:'choosing',
    word:null, wordChoices: pickThreeWords(), correctGuessers:{}, chooseDeadline: serverNow()+15000,
  });
  resetAndBroadcastScene();
}

/* -------------------------------------------------------------------------
   ADIVINAR: intercepta el chat mientras se está modelando
   ------------------------------------------------------------------------- */
onChatSubmit = function(text){
  if(gameState && gameState.started && gameState.phase==='drawing' && !amModeler()
     && !(gameState.correctGuessers && gameState.correctGuessers[myUserId])){
    if(normalizeGuess(text)===normalizeGuess(gameState.word||'')){
      const duration = (gameState.settings && gameState.settings.roundSeconds) || 80;
      const elapsed = (serverNow()-(gameState.roundStartTs||serverNow()))/1000;
      const points = computeGuessPoints(duration-elapsed, duration);
      fbDb.ref('rooms/'+currentRoomId+'/game/correctGuessers/'+myUserId).set({ ts:serverNow(), points });
      sendSystemMessage('🎉 '+myName+' ha adivinado la palabra', 'correct_guess', myUserId);
      showCenterToast('¡Correcto! +'+points+' puntos');
      return;
    }
  }
  sendChatMessage(text);
};

let toastTimer=null;
function showCenterToast(text, cls){
  const el = document.getElementById('center-toast');
  el.textContent = text;
  el.className = 'center-toast show' + (cls?(' '+cls):'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.classList.remove('show'); }, 2400);
}
onCorrectGuessNotice = function(text){ showCenterToast(text, 'toast-other'); };

/* -------------------------------------------------------------------------
   RENDER: HUD, MARCADOR, FIN DE RONDA, FIN DE PARTIDA
   ------------------------------------------------------------------------- */
function renderHUD(){
  if(!gameState || !gameState.started) return;
  document.getElementById('hud-round').textContent = `Ronda ${gameState.round}/${gameState.totalRounds}`;
  const modelerName = escapeHtml(nameOf(gameState.currentModelerId));
  if(gameState.phase==='choosing'){
    document.getElementById('hud-status').textContent = `${modelerName} está eligiendo palabra…`;
    document.getElementById('hud-word').textContent='';
    document.getElementById('hud-timer').textContent='';
  } else if(gameState.phase==='drawing'){
    const duration = (gameState.settings && gameState.settings.roundSeconds) || 80;
    const elapsed = (serverNow()-(gameState.roundStartTs||serverNow()))/1000;
    const remaining = Math.max(0, duration-elapsed);
    document.getElementById('hud-status').textContent = amModeler() ? 'Te toca a ti' : `${modelerName} está modelando`;
    document.getElementById('hud-word').textContent = amModeler()
      ? (gameState.word||'').toUpperCase()
      : computeHintPattern(gameState.word||'', remaining, duration);
    document.getElementById('hud-timer').textContent = Math.ceil(remaining);
  } else {
    document.getElementById('hud-status').textContent='';
    document.getElementById('hud-word').textContent='';
    document.getElementById('hud-timer').textContent='';
  }
}
function renderScoreboard(){
  const el = document.getElementById('sb-list');
  if(!el || !gameState || !gameState.started) return;
  const scores = computeLeaderboard();
  const uids = Object.keys(lastPresenceMap||{});
  if(gameState.currentModelerId && !uids.includes(gameState.currentModelerId)) uids.push(gameState.currentModelerId);
  const ranked = uids.map(uid=>({uid, score:scores[uid]||0})).sort((a,b)=>b.score-a.score);
  el.innerHTML = ranked.map((r,i)=>{
    const isModeler = gameState.phase==='drawing' && r.uid===gameState.currentModelerId;
    return `<div class="sb-entry${isModeler?' sb-modeler':''}">
      <span class="sb-rank">${i+1}</span>
      <span class="sb-name">${escapeHtml(nameOf(r.uid))}${r.uid===myUserId?' (tú)':''}</span>
      ${isModeler?'<span class="sb-pencil">✏️</span>':''}
      <span class="sb-score">${r.score}</span>
    </div>`;
  }).join('');
}
function renderRoundEnd(){
  const last = gameState.roundsHistory && gameState.roundsHistory[gameState.roundsHistory.length-1];
  if(!last) return;
  document.getElementById('roundend-word').textContent = (last.word||'').toUpperCase();
  document.getElementById('roundend-sub').textContent = `${nameOf(last.modelerId)} modeló esta ronda`;
  const rows = Object.entries(last.guesses||{}).sort((a,b)=>a[1].ts-b[1].ts);
  let html = rows.map(([uid,g])=>
    `<div class="sb-entry"><span class="sb-name">${escapeHtml(nameOf(uid))}</span><span class="sb-score">+${g.points}</span></div>`
  ).join('');
  html += `<div class="sb-entry sb-modeler"><span class="sb-name">${escapeHtml(nameOf(last.modelerId))} (modeló)</span><span class="sb-score">+${last.modelerPoints}</span></div>`;
  document.getElementById('roundend-list').innerHTML = html || '<div class="sb-entry">Nadie acertó esta ronda</div>';
}
function renderGameEnd(){
  const scores = computeLeaderboard();
  const uids = Object.keys(lastPresenceMap||{});
  const ranked = uids.map(uid=>({uid, score:scores[uid]||0})).sort((a,b)=>b.score-a.score);
  const medals=['🥇','🥈','🥉'];
  document.getElementById('gameend-list').innerHTML = ranked.map((r,i)=>
    `<div class="sb-entry"><span class="sb-rank">${medals[i]||(i+1)}</span><span class="sb-name">${escapeHtml(nameOf(r.uid))}${r.uid===myUserId?' (tú)':''}</span><span class="sb-score">${r.score}</span></div>`
  ).join('');
  document.getElementById('gameend-again-btn').style.display = isHost() ? 'block' : 'none';
  document.getElementById('gameend-wait-msg').style.display = isHost() ? 'none' : 'block';
}
document.getElementById('gameend-again-btn').addEventListener('click', ()=>{
  if(!isHost()) return;
  writeGameState({ started:false, phase:null, word:null, wordChoices:null, correctGuessers:{}, roundsHistory:[] });
});

/* -------------------------------------------------------------------------
   PESTAÑAS Escena / Chat del panel derecho
   ------------------------------------------------------------------------- */
document.querySelectorAll('.rp-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.rp-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.rp-pane').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('rp-'+tab.dataset.rptab).classList.add('active');
    if(tab.dataset.rptab==='chat') document.getElementById('chat-unread').classList.remove('show');
  });
});
