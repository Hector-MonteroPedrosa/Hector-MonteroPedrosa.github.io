/* =========================================================================
   MULTIPLAYER.JS
   Salas en tiempo real sobre Firebase Realtime Database (gratis).
   Se carga DESPUÉS de script.js: usa sus funciones globales snapshotState()
   y restoreState(), y le asigna los "ganchos" onSceneChanged /
   onModalOrEditModeEnded que script.js llama cuando algo cambia.

   Estrategia de sincronización: "última escritura gana" sobre el estado
   COMPLETO de la escena (el mismo formato que ya usa el Deshacer/Rehacer
   local). No es edición concurrente tipo Google Docs: si dos personas
   tocan geometría exactamente a la vez, gana la última. Para el uso
   previsto (un "modelador" activo por ronda mientras el resto mira/chatea,
   como en un pinturillo) esto es exactamente lo que hace falta, no una
   limitación real.
   ========================================================================= */

let fbApp = null, fbDb = null;
let currentRoomId = null;
let myUserId = 'u_' + Math.random().toString(36).slice(2, 10);
let myName = 'Jugador' + Math.floor(100 + Math.random() * 900);
let applyingRemote = false;
let deferredRemoteSnapshot = null;
let lastBroadcastAt = 0;
let broadcastPending = false;
const BROADCAST_MIN_INTERVAL_MS = 120;
let onGameStateChanged = null; // lo asigna game.js: se llama con el estado de la sala (ajustes, fase, anfitrión)
let onPresenceChanged = null;  // lo asigna game.js: se llama con el mapa de presencia (para la lista de jugadores)
let onChatSubmit = null;       // lo asigna game.js: intercepta el chat para comprobar intentos de adivinar
let onCorrectGuessNotice = null; // lo asigna game.js: aviso central cuando alguien acierta

function firebaseIsConfigured() {
  return typeof firebaseConfig === 'object' && firebaseConfig &&
    firebaseConfig.databaseURL &&
    !String(firebaseConfig.databaseURL).includes('TU_PROYECTO') &&
    typeof firebase !== 'undefined';
}

function initFirebase() {
  if (!firebaseIsConfigured()) return false;
  if (!fbApp) {
    try {
      fbApp = firebase.initializeApp(firebaseConfig);
      fbDb = firebase.database();
      fbDb.ref('.info/serverTimeOffset').on('value', snap => { serverTimeOffset = snap.val() || 0; });
    } catch (e) {
      console.error('Error inicializando Firebase:', e);
      return false;
    }
  }
  return true;
}
let serverTimeOffset = 0;
function serverNow(){ return Date.now() + serverTimeOffset; } // hora estimada del servidor: evita relojes locales desincronizados

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* seguimos al método de reserva */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (e) { return false; }
}
document.getElementById('room-pill').addEventListener('click', async () => {
  if (!currentRoomId) return;
  const ok = await copyToClipboard(currentRoomId);
  const fb = document.getElementById('copy-feedback');
  fb.textContent = ok ? '¡Copiado!' : 'No se pudo copiar';
  fb.classList.add('show');
  clearTimeout(fb._t);
  fb._t = setTimeout(() => fb.classList.remove('show'), 1400);
});

/* -------------------------------------------------------------------------
   LOBBY
   ------------------------------------------------------------------------- */
function showLobby() {
  const r = new URLSearchParams(location.search).get('room');
  if (r) document.getElementById('lobby-code-input').value = r.toUpperCase();
  document.getElementById('lobby-overlay').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  const ready = firebaseIsConfigured();
  document.getElementById('lobby-error').textContent = ready ? '' :
    'Multijugador no configurado todavía (falta editar firebase-config.js con tus credenciales gratis de Firebase). Puedes seguir en modo local mientras tanto.';
  document.getElementById('lobby-create-btn').disabled = !ready;
  document.getElementById('lobby-join-btn').disabled = !ready;
  document.getElementById('lobby-code-input').disabled = !ready;
}
function enterEditor() {
  document.getElementById('lobby-overlay').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

document.getElementById('lobby-solo-btn').addEventListener('click', enterEditor);

document.getElementById('lobby-create-btn').addEventListener('click', async () => {
  if (!initFirebase()) return;
  myName = document.getElementById('lobby-name').value.trim() || myName;
  setLobbyBusy(true);
  try {
    await joinOrCreateRoom(makeRoomCode(), true);
  } catch (e) {
    document.getElementById('lobby-error').textContent = 'No se pudo crear la sala: ' + e.message;
  }
  setLobbyBusy(false);
});
document.getElementById('lobby-join-btn').addEventListener('click', async () => {
  if (!initFirebase()) return;
  const code = document.getElementById('lobby-code-input').value.trim().toUpperCase();
  if (!code) { document.getElementById('lobby-error').textContent = 'Escribe un código de sala.'; return; }
  myName = document.getElementById('lobby-name').value.trim() || myName;
  setLobbyBusy(true);
  try {
    await joinOrCreateRoom(code, false);
  } catch (e) {
    document.getElementById('lobby-error').textContent = 'No se pudo unir a la sala: ' + e.message;
  }
  setLobbyBusy(false);
});
function setLobbyBusy(b) {
  ['lobby-create-btn', 'lobby-join-btn'].forEach(id => document.getElementById(id).disabled = b);
}

/* -------------------------------------------------------------------------
   CONEXIÓN A LA SALA
   ------------------------------------------------------------------------- */
async function joinOrCreateRoom(code, isCreator) {
  const roomRef = fbDb.ref('rooms/' + code);

  if (isCreator) {
    await roomRef.child('scene').set({ data: JSON.stringify(snapshotState()), sender: myUserId, ts: Date.now() });
    await roomRef.child('game').set({
      hostId: myUserId,
      started: false,
      settings: { roundSeconds: 80, roundsPerPlayer: 2 }
    });
  } else {
    const snap = await roomRef.child('scene').get();
    if (!snap.exists()) throw new Error('esa sala no existe, comprueba el código');
  }

  currentRoomId = code;
  history.replaceState(null, '', location.pathname + '?room=' + code);

  const presenceRef = roomRef.child('presence/' + myUserId);
  presenceRef.set({ name: myName, ts: Date.now() });
  presenceRef.onDisconnect().remove();
  roomRef.child('presence').on('value', snap => {
    const map = snap.val() || {};
    renderPresence(map);
    if (typeof onPresenceChanged === 'function') onPresenceChanged(map);
  });

  roomRef.child('game').on('value', snap => {
    const g = snap.val();
    if (g && typeof onGameStateChanged === 'function') onGameStateChanged(g);
  });

  roomRef.child('scene').on('value', snap => {
    const v = snap.val();
    if (!v || v.sender === myUserId) return;
    tryApplyRemote(JSON.parse(v.data));
  });

  document.getElementById('chat-messages').innerHTML = '';
  roomRef.child('chat').limitToLast(100).on('child_added', snap => appendChatMessage(snap.val()));

  onSceneChanged = scheduleBroadcast;
  onModalOrEditModeEnded = flushDeferredRemote;

  document.getElementById('room-code-label').textContent = code;
  document.getElementById('room-badge').style.display = 'flex';
  showWaitingRoom();
  setStatus('Sala ' + code + (isCreator ? ' creada' : ' — conectado'));
}
function writeGameState(update) {
  if (!currentRoomId) return;
  fbDb.ref('rooms/' + currentRoomId + '/game').update(update);
}

function tryApplyRemote(snapshotData) {
  // Sólo aplazamos si hay un arrastre G/R/S/E/Inset o un Loop Cut EN CURSO (tocar sus índices
  // a mitad de operación los rompería). Estar simplemente en Modo Edición mirando ya NO bloquea
  // nada: así los cambios de otros se ven en vivo, no sólo al volver a Modo Objeto.
  if (modal.active || loopCutMode) {
    deferredRemoteSnapshot = snapshotData; // nos quedamos solo con la más reciente
    return;
  }
  applyingRemote = true;
  try {
    const wasEditMode = editMode;
    const selName = selectedObject ? selectedObject.name : null;
    restoreState(snapshotData, { preserveSelectionByName: selName });
    if (wasEditMode) {
      // la topología pudo cambiar por completo: no reutilizamos índices de selección viejos,
      // simplemente refrescamos los ayudantes (puntos/aristas) contra la malla nueva.
      editSelection.verts.clear(); editSelection.edges.clear(); editSelection.faces.clear();
      if (selectedObject) { editMode = true; buildEditHelpers(); syncEditFromData(); }
      else { editMode = false; document.getElementById('mode-select').value = 'object'; clearEditHelpers(); }
    }
  } finally {
    applyingRemote = false;
  }
}
function flushDeferredRemote() {
  if (deferredRemoteSnapshot) {
    const s = deferredRemoteSnapshot;
    deferredRemoteSnapshot = null;
    tryApplyRemote(s);
  }
}

function scheduleBroadcast() {
  if (applyingRemote || !currentRoomId || !canEdit) return;
  const now = Date.now();
  if (now - lastBroadcastAt >= BROADCAST_MIN_INTERVAL_MS) {
    lastBroadcastAt = now;
    sendBroadcastNow();
  } else if (!broadcastPending) {
    broadcastPending = true;
    setTimeout(() => {
      broadcastPending = false;
      lastBroadcastAt = Date.now();
      sendBroadcastNow();
    }, BROADCAST_MIN_INTERVAL_MS);
  }
}
function sendBroadcastNow() {
  if (!currentRoomId) return;
  fbDb.ref('rooms/' + currentRoomId + '/scene').set({
    data: JSON.stringify(snapshotState()), sender: myUserId, ts: Date.now()
  });
}
function forceBroadcastScene() {
  // salta la comprobación de canEdit: para resets de escena controlados por el sistema (nueva ronda)
  lastBroadcastAt = Date.now();
  sendBroadcastNow();
}

/* -------------------------------------------------------------------------
   PRESENCIA
   ------------------------------------------------------------------------- */
let lastPresenceMap = {};
function renderPresence(map) {
  lastPresenceMap = map;
  const el = document.getElementById('presence-list');
  el.innerHTML = '';
  Object.values(map).forEach(p => {
    const span = document.createElement('span');
    span.className = 'presence-chip';
    span.textContent = p.name;
    el.appendChild(span);
  });
}

/* -------------------------------------------------------------------------
   CHAT — onChatSubmit permite a game.js interceptar mensajes como intentos
   de adivinar la palabra antes de que lleguen al chat normal.
   ------------------------------------------------------------------------- */
function appendChatMessage(msg) {
  const el = document.getElementById('chat-messages');
  const div = document.createElement('div');
  if (msg.system) { div.className = 'chat-system'; div.textContent = msg.text; }
  else { div.innerHTML = `<b>${escapeHtml(msg.name)}:</b> ${escapeHtml(msg.text)}`; }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (msg.kind==='correct_guess' && msg.uid!==myUserId && typeof onCorrectGuessNotice==='function') onCorrectGuessNotice(msg.text);
}
function sendChatMessage(text) {
  if (!text || !currentRoomId) return;
  fbDb.ref('rooms/' + currentRoomId + '/chat').push({ name: myName, text, ts: Date.now(), uid: myUserId });
}
function sendSystemMessage(text, kind, uid) {
  if (!currentRoomId) return;
  fbDb.ref('rooms/' + currentRoomId + '/chat').push({ system: true, kind: kind||null, uid: uid||null, text, ts: Date.now() });
}
function handleChatSubmit() {
  const inp = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  if (typeof onChatSubmit === 'function') { onChatSubmit(text); }
  else { sendChatMessage(text); }
}
document.getElementById('chat-send').addEventListener('click', handleChatSubmit);
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleChatSubmit(); });
document.getElementById('chat-toggle-btn').addEventListener('click', () => {
  const tab = document.querySelector('.rp-tab[data-rptab="chat"]');
  if (tab) tab.click();
});

/* -------------------------------------------------------------------------
   FEEDBACK — funciona incluso en modo local, no hace falta estar en una sala
   ------------------------------------------------------------------------- */
function openFeedback() {
  document.getElementById('feedback-status').textContent = '';
  document.getElementById('feedback-overlay').style.display = 'flex';
}
function closeFeedback() {
  document.getElementById('feedback-overlay').style.display = 'none';
}
document.getElementById('feedback-open-btn').addEventListener('click', openFeedback);
document.getElementById('feedback-open-btn-2').addEventListener('click', openFeedback);
document.getElementById('feedback-close-btn').addEventListener('click', closeFeedback);
document.getElementById('feedback-send-btn').addEventListener('click', async () => {
  const text = document.getElementById('feedback-text').value.trim();
  const statusEl = document.getElementById('feedback-status');
  if (!text) { statusEl.textContent = 'Escribe algo antes de enviar.'; return; }
  if (!initFirebase()) { statusEl.textContent = 'El feedback necesita que la sala esté configurada (falta firebase-config.js).'; return; }
  try {
    await fbDb.ref('feedback').push({
      text,
      name: document.getElementById('feedback-name').value.trim() || 'Anónimo',
      ts: Date.now(),
      page: location.href,
    });
    document.getElementById('feedback-text').value = '';
    statusEl.style.color = '#8fd34c';
    statusEl.textContent = '¡Gracias! Enviado.';
    setTimeout(closeFeedback, 1200);
  } catch (e) {
    statusEl.style.color = '';
    statusEl.textContent = 'No se pudo enviar: ' + e.message;
  }
});

showLobby();
