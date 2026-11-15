/*
 * PeerVoice — app.js
 *
 * 100% peer-to-peer. Nothing here talks to a server you run — PeerJS's
 * public broker and the STUN servers below only help two browsers find
 * each other; once connected, voice, video and chat all flow directly
 * between the two devices.
 *
 * Your invite link and card both encode your persistent ID as a URL of
 * the form `<this site>?add=<id>`. Because the link is always built from
 * wherever the page is currently hosted (window.location), moving the
 * app to a new domain later needs no code changes at all.
 */

(() => {
  'use strict';

  // --------------------------------------------------------------------
  // Config
  // --------------------------------------------------------------------
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];

  const PEERJS_OPTS = {
    debug: 0,
    config: { iceServers: ICE_SERVERS }
  };

  const THEME_PRESETS = [
    { name: 'Indigo', accent: '#4f46e5', accent2: '#60a5fa' },
    { name: 'Emerald', accent: '#059669', accent2: '#34d399' },
    { name: 'Rose', accent: '#e11d48', accent2: '#fb7185' },
    { name: 'Amber', accent: '#d97706', accent2: '#fbbf24' },
    { name: 'Slate', accent: '#475569', accent2: '#94a3b8' }
  ];

  const CARD_QR_SIZE = 220;
  const ID_PATTERN = /^pv-[A-Za-z0-9]{10,40}$/;

  // --------------------------------------------------------------------
  // DOM references
  // --------------------------------------------------------------------
  const panels = {
    permission: document.getElementById('panel-permission'),
    home: document.getElementById('panel-home'),
    connecting: document.getElementById('panel-connecting'),
    incoming: document.getElementById('panel-incoming'),
    chat: document.getElementById('panel-chat'),
    call: document.getElementById('panel-call')
  };

  const els = {
    netPill: document.getElementById('netPill'),
    netPillLabel: document.getElementById('netPillLabel'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toastText'),
    toastClose: document.getElementById('toastClose'),

    btnSettings: document.getElementById('btnSettings'),
    settingsBackdrop: document.getElementById('settingsBackdrop'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    selfNameInput: document.getElementById('selfNameInput'),
    themeSwatches: document.getElementById('themeSwatches'),
    customColorInput: document.getElementById('customColorInput'),

    nameBackdrop: document.getElementById('nameBackdrop'),
    nameModalInput: document.getElementById('nameModalInput'),
    btnSaveName: document.getElementById('btnSaveName'),

    installCard: document.getElementById('installCard'),
    installTitle: document.getElementById('installTitle'),
    installSub: document.getElementById('installSub'),
    btnInstall: document.getElementById('btnInstall'),
    btnDismissInstall: document.getElementById('btnDismissInstall'),

    btnEnableMic: document.getElementById('btnEnableMic'),

    inviteLinkInput: document.getElementById('inviteLinkInput'),
    btnCopyLink: document.getElementById('btnCopyLink'),
    btnShareLink: document.getElementById('btnShareLink'),
    btnDownloadCard: document.getElementById('btnDownloadCard'),
    cardFileInput: document.getElementById('cardFileInput'),
    contactsList: document.getElementById('contactsList'),
    contactsEmpty: document.getElementById('contactsEmpty'),

    connectingTitle: document.getElementById('connectingTitle'),
    connectingTarget: document.getElementById('connectingTarget'),
    btnCancelConnecting: document.getElementById('btnCancelConnecting'),

    incomingKind: document.getElementById('incomingKind'),
    incomingFrom: document.getElementById('incomingFrom'),
    btnAccept: document.getElementById('btnAccept'),
    btnDecline: document.getElementById('btnDecline'),

    btnChatBack: document.getElementById('btnChatBack'),
    chatContactName: document.getElementById('chatContactName'),
    chatContactStatus: document.getElementById('chatContactStatus'),
    btnChatCall: document.getElementById('btnChatCall'),
    btnChatVideo: document.getElementById('btnChatVideo'),
    chatMessages: document.getElementById('chatMessages'),
    chatInputForm: document.getElementById('chatInputForm'),
    chatInput: document.getElementById('chatInput'),

    videoStage: document.getElementById('videoStage'),
    remoteVideo: document.getElementById('remoteVideo'),
    localVideo: document.getElementById('localVideo'),
    liveOrb: document.getElementById('liveOrb'),
    callPeerLabel: document.getElementById('callPeerLabel'),
    callTimer: document.getElementById('callTimer'),
    waveCanvas: document.getElementById('waveCanvas'),

    controlBar: document.getElementById('controlBar'),
    btnMute: document.getElementById('btnMute'),
    btnToggleCamera: document.getElementById('btnToggleCamera'),
    btnEndCall: document.getElementById('btnEndCall'),
    iconMicOn: document.querySelector('#btnMute .icon-mic-on'),
    iconMicOff: document.querySelector('#btnMute .icon-mic-off'),
    iconCamOn: document.querySelector('#btnToggleCamera .icon-cam-on'),
    iconCamOff: document.querySelector('#btnToggleCamera .icon-cam-off'),

    remoteAudio: document.getElementById('remoteAudio')
  };

  // --------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------
  const state = {
    persistentId: null,
    peer: null,
    localStream: null,
    currentCallLocalStream: null,
    activeCall: null,
    pendingIncomingCall: null,
    pendingIncomingWantsVideo: false,
    targetPeerId: getTargetIdFromUrl(),
    pendingAutoConnectId: null,
    dataConnections: new Map(),
    openChatId: null,
    timerHandle: null,
    callStartedAt: null,
    callConnected: false,
    isMuted: false,
    cameraOff: false,
    audioCtx: null,
    analyser: null,
    rafHandle: null,
    toastTimeout: null,
    deferredInstallPrompt: null
  };

  // --------------------------------------------------------------------
  // Small helpers
  // --------------------------------------------------------------------
  function showPanel(name) {
    Object.entries(panels).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
    els.controlBar.hidden = name !== 'call';
  }

  function getCurrentPanelName() {
    const found = Object.entries(panels).find(([, el]) => el && !el.hidden);
    return found ? found[0] : null;
  }

  function setNetState(stateName, label) {
    els.netPill.dataset.state = stateName;
    els.netPillLabel.textContent = label;
  }

  function showToast(message, { sticky = false } = {}) {
    els.toastText.textContent = message;
    els.toast.hidden = false;
    if (state.toastTimeout) clearTimeout(state.toastTimeout);
    if (!sticky) state.toastTimeout = setTimeout(hideToast, 5500);
  }

  function hideToast() {
    els.toast.hidden = true;
    if (state.toastTimeout) {
      clearTimeout(state.toastTimeout);
      state.toastTimeout = null;
    }
  }

  els.toastClose.addEventListener('click', hideToast);

  function getTargetIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('add');
    return id && ID_PATTERN.test(id) ? id : null;
  }

  function clearAddParam() {
    if (window.location.search) {
      history.replaceState(null, '', window.location.pathname);
    }
    state.targetPeerId = null;
  }

  function shortId(id) {
    if (!id) return '';
    const bare = id.replace(/^pv-/, '');
    return bare.length > 10 ? `${bare.slice(0, 6)}…${bare.slice(-4)}` : bare;
  }

  function buildInviteLink(peerId) {
    const url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.set('add', peerId);
    return url.toString();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image-load-failed'));
      img.src = src;
    });
  }

  // --------------------------------------------------------------------
  // Persistent identity
  // --------------------------------------------------------------------
  function getOrCreatePersistentId() {
    let id = localStorage.getItem('pv_id');
    if (!id || !ID_PATTERN.test(id)) {
      id = `pv-${randomIdSegment()}`;
      localStorage.setItem('pv_id', id);
    }
    return id;
  }

  function randomIdSegment() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    let out = '';
    for (let i = 0; i < 20; i++) out += Math.floor(Math.random() * 36).toString(36);
    return out;
  }

  function getSelfDisplayName() {
    return (localStorage.getItem('pv_self_name') || '').trim();
  }

  els.selfNameInput.addEventListener('change', () => {
    localStorage.setItem('pv_self_name', els.selfNameInput.value.trim());
  });

  // --------------------------------------------------------------------
  // Contacts (localStorage only — never leaves this device)
  // --------------------------------------------------------------------
  const CONTACTS_KEY = 'pv_contacts';

  function loadContacts() {
    try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); }
    catch (err) { return []; }
  }

  function saveContacts(list) {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
  }

  function getContact(id) {
    return loadContacts().find((c) => c.id === id) || null;
  }

  function getContactDisplayName(id) {
    const c = getContact(id);
    return c ? c.name : shortId(id);
  }

  function upsertContact({ id, name }) {
    const contacts = loadContacts();
    const existing = contacts.find((c) => c.id === id);
    if (existing) {
      if (name) existing.name = name;
      existing.lastContacted = Date.now();
    } else {
      contacts.push({ id, name: name || shortId(id), lastContacted: Date.now(), unread: false });
    }
    saveContacts(contacts);
    renderContactsList();
  }

  function markUnread(id) {
    const contacts = loadContacts();
    const c = contacts.find((x) => x.id === id);
    if (c) { c.unread = true; saveContacts(contacts); renderContactsList(); }
  }

  function clearUnread(id) {
    const contacts = loadContacts();
    const c = contacts.find((x) => x.id === id);
    if (c && c.unread) { c.unread = false; saveContacts(contacts); renderContactsList(); }
  }

  function initials(name) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const letters = parts.map((w) => (w[0] || '').toUpperCase()).join('');
    return letters || '?';
  }

  function timeAgo(ts) {
    const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  // Presence here is purely "are we connected to them right now" — there's
  // no server anywhere keeping track of who's online in the background.
  function describePresence(contact) {
    const conn = state.dataConnections.get(contact.id);
    if (conn && conn.open) return 'Online now';
    if (contact.lastContacted) return `Last talked ${timeAgo(contact.lastContacted)}`;
    return 'Tap to message';
  }

  function renderContactsList() {
    const contacts = loadContacts().sort((a, b) => b.lastContacted - a.lastContacted);
    els.contactsList.innerHTML = '';
    els.contactsEmpty.hidden = contacts.length > 0;

    contacts.forEach((contact) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'contact-card';
      card.dataset.id = contact.id;
      const isOnline = Boolean(state.dataConnections.get(contact.id)?.open);
      card.dataset.online = String(isOnline);

      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.textContent = initials(contact.name);

      const meta = document.createElement('span');
      meta.className = 'contact-meta';

      const name = document.createElement('span');
      name.className = 'contact-name';
      name.textContent = contact.name;

      const status = document.createElement('span');
      status.className = 'contact-status';
      const dot = document.createElement('span');
      dot.className = 'status-dot';
      const statusText = document.createElement('span');
      statusText.textContent = describePresence(contact);
      status.append(dot, statusText);

      meta.append(name, status);
      card.append(avatar, meta);

      if (contact.unread) {
        const badge = document.createElement('span');
        badge.className = 'contact-unread';
        card.appendChild(badge);
      }

      card.addEventListener('click', () => connectToContactChat(contact.id));
      els.contactsList.appendChild(card);
    });
  }

  // --------------------------------------------------------------------
  // Name-this-contact modal
  // --------------------------------------------------------------------
  function promptContactName(id, suggested) {
    return new Promise((resolve) => {
      els.nameModalInput.value = suggested || '';
      els.nameModalInput.placeholder = `e.g. ${shortId(id)}`;
      els.nameBackdrop.hidden = false;

      const cleanup = () => {
        els.nameBackdrop.hidden = true;
        els.btnSaveName.removeEventListener('click', onSave);
        els.nameBackdrop.removeEventListener('click', onBackdrop);
      };
      const onSave = () => {
        const val = els.nameModalInput.value.trim();
        cleanup();
        resolve(val || suggested || shortId(id));
      };
      const onBackdrop = (e) => {
        if (e.target === els.nameBackdrop) { cleanup(); resolve(suggested || shortId(id)); }
      };

      els.btnSaveName.addEventListener('click', onSave);
      els.nameBackdrop.addEventListener('click', onBackdrop);
      setTimeout(() => els.nameModalInput.focus(), 50);
    });
  }

  // --------------------------------------------------------------------
  // Microphone (base audio stream, kept alive for the whole session)
  // --------------------------------------------------------------------
  async function requestMicrophone() {
    els.btnEnableMic.disabled = true;
    els.btnEnableMic.textContent = 'Requesting access…';
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      afterMicGranted();
    } catch (err) {
      els.btnEnableMic.disabled = false;
      els.btnEnableMic.textContent = 'Allow microphone to continue';
      if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        showToast('Microphone access was blocked. Allow it in your browser\u2019s site settings, then try again.', { sticky: true });
      } else if (err && err.name === 'NotFoundError') {
        showToast('No microphone was found on this device.', { sticky: true });
      } else {
        showToast('Couldn\u2019t access the microphone. Check your device and try again.');
      }
    }
  }

  function afterMicGranted() {
    initPeer();
    renderContactsList();
    if (state.targetPeerId) {
      state.pendingAutoConnectId = state.targetPeerId;
      showPanel('connecting');
      els.connectingTitle.textContent = 'Connecting';
      els.connectingTarget.textContent = ` to ${shortId(state.targetPeerId)}`;
    } else {
      showPanel('home');
    }
  }

  // --------------------------------------------------------------------
  // PeerJS signaling
  // --------------------------------------------------------------------
  function initPeer() {
    if (state.peer) return;
    state.persistentId = getOrCreatePersistentId();

    setNetState('offline', 'Connecting…');
    const peer = new Peer(state.persistentId, PEERJS_OPTS);
    state.peer = peer;

    peer.on('open', () => {
      setNetState('online', 'Online');
      els.inviteLinkInput.value = buildInviteLink(peer.id);
      els.btnShareLink.hidden = !navigator.share;

      if (state.pendingAutoConnectId) {
        const id = state.pendingAutoConnectId;
        state.pendingAutoConnectId = null;
        connectToContactChat(id, { isFirstTime: true });
      }
    });

    peer.on('connection', handleIncomingConnection);
    peer.on('call', handleIncomingCall);

    peer.on('disconnected', () => {
      setNetState('offline', 'Reconnecting…');
      if (!peer.destroyed) peer.reconnect();
    });

    peer.on('close', () => setNetState('offline', 'Offline'));
    peer.on('error', handlePeerError);
  }

  function handlePeerError(err) {
    const type = err && err.type;
    if (type === 'peer-unavailable') {
      showToast('That link isn\u2019t active right now \u2014 the other person may be offline.');
      if (getCurrentPanelName() === 'connecting') {
        state.activeCall = null;
        returnToIdle({ clearParam: true });
      }
      return;
    }
    if (type === 'unavailable-id') {
      setNetState('error', 'Already open elsewhere');
      showToast('PeerVoice looks like it\u2019s already open in another tab or window on this device.', { sticky: true });
      return;
    }
    if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
      setNetState('error', 'Connection issue');
      showToast('Having trouble reaching the signaling server. Check your connection.');
      return;
    }
    console.error('PeerVoice peer error:', err);
    showToast('Something went wrong with the connection.');
  }

  // --------------------------------------------------------------------
  // Text chat (PeerJS DataConnection)
  // --------------------------------------------------------------------
  function getOrCreateDataConnection(id, opts = {}) {
    let conn = state.dataConnections.get(id);
    if (conn && conn.open) return Promise.resolve(conn);

    if (!conn) {
      conn = state.peer.connect(id, { reliable: true, metadata: { name: getSelfDisplayName() } });
      state.dataConnections.set(id, conn);
    }

    if (!conn._pvBound) {
      conn._pvBound = true;
      conn.on('data', (data) => handleIncomingChatData(id, data));
      conn.on('close', () => {
        state.dataConnections.delete(id);
        if (state.openChatId === id) updateChatHeaderStatus(id);
        renderContactsList();
      });
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('timeout')); }
      }, 8000);

      conn.on('open', async () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (!getContact(id)) {
          const suggested = conn.metadata && conn.metadata.name;
          const name = await promptContactName(id, suggested);
          upsertContact({ id, name });
        } else {
          upsertContact({ id });
        }
        if (opts.isFirstTime) clearAddParam();
        resolve(conn);
      });

      conn.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  function handleIncomingConnection(conn) {
    const id = conn.peer;
    state.dataConnections.set(id, conn);
    conn._pvBound = true;

    conn.on('data', (data) => handleIncomingChatData(id, data));
    conn.on('close', () => {
      state.dataConnections.delete(id);
      if (state.openChatId === id) updateChatHeaderStatus(id);
      renderContactsList();
    });

    conn.on('open', async () => {
      if (!getContact(id)) {
        const suggested = conn.metadata && conn.metadata.name;
        const name = await promptContactName(id, suggested);
        upsertContact({ id, name });
      } else {
        upsertContact({ id });
      }
      renderContactsList();
      if (state.openChatId === id) updateChatHeaderStatus(id);
    });
  }

  function handleIncomingChatData(id, data) {
    if (!data || typeof data.text !== 'string') return;
    appendMessage(id, { from: 'them', text: data.text, ts: data.ts || Date.now() });
    if (state.openChatId === id) {
      renderChatMessages(id);
    } else {
      markUnread(id);
      showToast(`New message from ${getContactDisplayName(id)}`);
    }
  }

  async function connectToContactChat(id, opts = {}) {
    state.openChatId = id;
    const existing = state.dataConnections.get(id);
    if (existing && existing.open) {
      openChatScreen(id);
      return;
    }
    showPanel('connecting');
    els.connectingTitle.textContent = 'Connecting';
    els.connectingTarget.textContent = ` to ${getContactDisplayName(id)}`;
    try {
      await getOrCreateDataConnection(id, opts);
      openChatScreen(id);
    } catch (err) {
      showToast(getContact(id) ? `${getContactDisplayName(id)} appears to be offline right now.` : 'That link isn\u2019t active anymore.');
      returnToIdle({ clearParam: !!opts.isFirstTime });
    }
  }

  function openChatScreen(id) {
    state.openChatId = id;
    els.chatContactName.textContent = getContactDisplayName(id);
    updateChatHeaderStatus(id);
    clearUnread(id);
    renderChatMessages(id);
    showPanel('chat');
    setTimeout(() => els.chatInput.focus(), 50);
  }

  function updateChatHeaderStatus(id) {
    const contact = getContact(id);
    els.chatContactStatus.textContent = contact ? describePresence(contact) : 'Offline';
  }

  els.btnChatBack.addEventListener('click', () => {
    state.openChatId = null;
    showPanel('home');
    renderContactsList();
  });

  // --------------------------------------------------------------------
  // Chat message storage (on this device only, never synced anywhere)
  // --------------------------------------------------------------------
  function msgsKey(id) { return `pv_msgs_${id}`; }

  function loadMessages(id) {
    try { return JSON.parse(localStorage.getItem(msgsKey(id)) || '[]'); }
    catch (err) { return []; }
  }

  function appendMessage(id, msg) {
    const msgs = loadMessages(id);
    msgs.push(msg);
    while (msgs.length > 300) msgs.shift();
    localStorage.setItem(msgsKey(id), JSON.stringify(msgs));
  }

  function formatClock(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderChatMessages(id) {
    const msgs = loadMessages(id);
    els.chatMessages.innerHTML = '';
    if (!msgs.length) {
      const empty = document.createElement('p');
      empty.className = 'chat-empty';
      empty.textContent = 'Say hi \u{1F44B}';
      els.chatMessages.appendChild(empty);
      return;
    }
    msgs.forEach((msg) => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${msg.from === 'me' ? 'is-mine' : 'is-theirs'}`;
      const text = document.createElement('span');
      text.textContent = msg.text;
      const time = document.createElement('span');
      time.className = 'chat-bubble-time';
      time.textContent = msg.failed ? 'not delivered' : formatClock(msg.ts);
      bubble.append(text, time);
      els.chatMessages.appendChild(bubble);
    });
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  els.chatInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = els.chatInput.value.trim();
    const id = state.openChatId;
    if (!text || !id) return;
    els.chatInput.value = '';
    try {
      const conn = await getOrCreateDataConnection(id);
      conn.send({ text, ts: Date.now() });
      appendMessage(id, { from: 'me', text, ts: Date.now() });
    } catch (err) {
      appendMessage(id, { from: 'me', text, ts: Date.now(), failed: true });
      showToast(`${getContactDisplayName(id)} seems to be offline right now \u2014 try again once you\u2019re both online at the same time.`);
    }
    renderChatMessages(id);
  });

  // --------------------------------------------------------------------
  // Calls (voice or video)
  // --------------------------------------------------------------------
  async function getCallStream(withVideo) {
    if (!withVideo) return state.localStream;
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
  }

  async function startOutgoingCall(id, withVideo) {
    if (state.activeCall) {
      showToast('You\u2019re already on a call.');
      return;
    }
    showPanel('connecting');
    els.connectingTitle.textContent = 'Calling';
    els.connectingTarget.textContent = ` ${getContactDisplayName(id)}`;
    try {
      const stream = await getCallStream(withVideo);
      state.currentCallLocalStream = stream;
      const call = state.peer.call(id, stream, { metadata: { video: withVideo } });
      if (!call) throw new Error('call-failed');
      state.activeCall = call;
      bindCallEvents(call, id);
    } catch (err) {
      console.error('PeerVoice outgoing call error:', err);
      if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        showToast('Camera/microphone access was blocked.');
      } else {
        showToast('Couldn\u2019t start the call.');
      }
      returnToIdle({ clearParam: false });
    }
  }

  function handleIncomingCall(call) {
    if (state.activeCall) {
      call.close();
      return;
    }
    state.pendingIncomingCall = call;
    state.pendingIncomingWantsVideo = Boolean(call.metadata && call.metadata.video);
    els.incomingKind.textContent = state.pendingIncomingWantsVideo ? 'video call' : 'call';
    els.incomingFrom.textContent = ` from ${getContactDisplayName(call.peer)}`;
    showPanel('incoming');

    call.on('close', () => {
      if (state.pendingIncomingCall === call) {
        state.pendingIncomingCall = null;
        if (!state.activeCall) returnToIdle({ clearParam: false });
      }
    });
  }

  els.btnAccept.addEventListener('click', async () => {
    const call = state.pendingIncomingCall;
    if (!call) return;
    state.pendingIncomingCall = null;
    try {
      const stream = await getCallStream(state.pendingIncomingWantsVideo);
      state.currentCallLocalStream = stream;
      call.answer(stream);
      bindCallEvents(call, call.peer);
      state.activeCall = call;
    } catch (err) {
      showToast('Couldn\u2019t access the microphone/camera to answer.');
      call.close();
      returnToIdle({ clearParam: false });
    }
  });

  els.btnDecline.addEventListener('click', () => {
    const call = state.pendingIncomingCall;
    state.pendingIncomingCall = null;
    if (call) call.close();
    returnToIdle({ clearParam: false });
  });

  function bindCallEvents(call, remoteId) {
    call.on('stream', (remoteStream) => {
      els.remoteAudio.srcObject = remoteStream;
      const playPromise = els.remoteAudio.play();
      if (playPromise && playPromise.catch) playPromise.catch(() => {});
      enterActiveCall(remoteId, remoteStream);
    });
    call.on('close', () => endCall({ clearParam: false, notify: false }));
    call.on('error', (err) => {
      console.error('PeerVoice call error:', err);
      showToast('The call ended unexpectedly.');
      endCall({ clearParam: false, notify: false });
    });
  }

  function enterActiveCall(remoteId, remoteStream) {
    state.callConnected = true;
    hideToast();
    els.callPeerLabel.textContent = `Connected to ${getContactDisplayName(remoteId)}`;

    const localStream = state.currentCallLocalStream;
    const hasRemoteVideo = remoteStream.getVideoTracks().length > 0;
    const hasLocalVideo = Boolean(localStream && localStream.getVideoTracks().length > 0);
    const isVideoCall = hasRemoteVideo || hasLocalVideo;

    els.remoteVideo.srcObject = remoteStream;
    els.videoStage.hidden = !isVideoCall;
    els.videoStage.dataset.hasVideo = String(isVideoCall);
    els.liveOrb.hidden = isVideoCall;

    if (hasLocalVideo) {
      els.localVideo.srcObject = localStream;
      els.localVideo.hidden = false;
      els.btnToggleCamera.hidden = false;
      els.btnToggleCamera.setAttribute('aria-pressed', 'false');
      els.iconCamOn.hidden = false;
      els.iconCamOff.hidden = true;
      state.cameraOff = false;
    } else {
      els.localVideo.hidden = true;
      els.btnToggleCamera.hidden = true;
    }

    showPanel('call');
    startTimer();
    if (!hasRemoteVideo) startVisualizer(remoteStream);
  }

  function endCall({ clearParam, notify } = {}) {
    state.callConnected = false;
    if (state.activeCall) {
      try { state.activeCall.close(); } catch (err) { /* already closing */ }
      state.activeCall = null;
    }
    stopTimer();
    stopVisualizer();
    els.remoteAudio.srcObject = null;
    els.remoteVideo.srcObject = null;
    els.localVideo.srcObject = null;
    els.videoStage.hidden = true;
    els.liveOrb.hidden = false;
    els.btnToggleCamera.hidden = true;
    state.cameraOff = false;

    if (state.currentCallLocalStream && state.currentCallLocalStream !== state.localStream) {
      state.currentCallLocalStream.getTracks().forEach((t) => t.stop());
    }
    state.currentCallLocalStream = null;

    if (notify) showToast('Call ended.');
    returnToIdle({ clearParam });
  }

  els.btnEndCall.addEventListener('click', () => endCall({ clearParam: false, notify: false }));

  els.btnCancelConnecting.addEventListener('click', () => {
    if (state.activeCall) {
      try { state.activeCall.close(); } catch (err) { /* noop */ }
      state.activeCall = null;
    }
    const id = state.openChatId || state.targetPeerId;
    if (id) {
      const conn = state.dataConnections.get(id);
      if (conn && !conn.open) {
        try { conn.close(); } catch (err) { /* noop */ }
        state.dataConnections.delete(id);
      }
    }
    returnToIdle({ clearParam: true });
  });

  function returnToIdle({ clearParam } = {}) {
    state.callConnected = false;
    if (clearParam) clearAddParam();
    els.callTimer.textContent = '00:00';
    if (state.isMuted) toggleMute();
    if (state.openChatId && getContact(state.openChatId)) {
      openChatScreen(state.openChatId);
    } else {
      state.openChatId = null;
      showPanel('home');
      renderContactsList();
    }
  }

  // --------------------------------------------------------------------
  // Link copy / share (home screen)
  // --------------------------------------------------------------------
  els.btnCopyLink.addEventListener('click', async () => {
    const link = els.inviteLinkInput.value;
    if (!link) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        els.inviteLinkInput.select();
        document.execCommand('copy');
      }
      els.btnCopyLink.classList.add('is-copied');
      setTimeout(() => els.btnCopyLink.classList.remove('is-copied'), 1600);
    } catch (err) {
      showToast('Couldn\u2019t copy automatically \u2014 select the link and copy it manually.');
    }
  });

  els.btnShareLink.addEventListener('click', async () => {
    const link = els.inviteLinkInput.value;
    if (!link || !navigator.share) return;
    try { await navigator.share({ title: 'Message me on PeerVoice', url: link }); }
    catch (err) { /* user cancelled the share sheet */ }
  });

  // --------------------------------------------------------------------
  // Card: generate (QR encodes your invite link) and scan (add a contact)
  // --------------------------------------------------------------------
  async function generateCardDataUrl() {
    const link = (state.peer && state.peer.open) ? buildInviteLink(state.peer.id) : els.inviteLinkInput.value;
    if (!link) throw new Error('no-link-yet');

    const qrDataUrl = await QRCode.toDataURL(link, {
      margin: 1,
      width: CARD_QR_SIZE,
      color: { dark: '#050505', light: '#ffffff' }
    });

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0c0c10');
    grad.addColorStop(1, '#050505');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f46e5';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    try {
      const logoImg = await loadImage('./logo.svg');
      ctx.drawImage(logoImg, 36, 34, 56, 56);
    } catch (err) { /* logo is decorative — card still works without it */ }

    ctx.fillStyle = '#f3f3f5';
    ctx.font = '600 26px "Space Grotesk", sans-serif';
    ctx.fillText(getSelfDisplayName() || 'PeerVoice user', 106, 64);

    ctx.fillStyle = '#8d8d97';
    ctx.font = '400 14px Inter, sans-serif';
    ctx.fillText('Scan to message me on PeerVoice', 106, 88);

    const qrImg = await loadImage(qrDataUrl);
    const qrX = (canvas.width - CARD_QR_SIZE) / 2;
    const qrY = 126;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 12, qrY - 12, CARD_QR_SIZE + 24, CARD_QR_SIZE + 24);
    ctx.drawImage(qrImg, qrX, qrY, CARD_QR_SIZE, CARD_QR_SIZE);

    ctx.fillStyle = '#58585f';
    ctx.font = '400 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(shortId(state.persistentId), canvas.width / 2, qrY + CARD_QR_SIZE + 40);
    ctx.textAlign = 'left';

    return canvas.toDataURL('image/png');
  }

  els.btnDownloadCard.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!state.peer || !state.peer.open) {
      showToast('Still connecting \u2014 try again in a moment.');
      return;
    }
    try {
      const dataUrl = await generateCardDataUrl();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `peervoice-card-${shortId(state.persistentId)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('PeerVoice card generation failed:', err);
      showToast('Couldn\u2019t generate your card. Try again.');
    }
  });

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function extractIdFromScannedText(text) {
    try {
      const url = new URL(text);
      const id = url.searchParams.get('add');
      if (id && ID_PATTERN.test(id)) return id;
    } catch (err) { /* not a URL — fall through and try the raw text */ }
    return ID_PATTERN.test(text) ? text : null;
  }

  async function decodeCardFile(file) {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (!code || !code.data) return null;
    return extractIdFromScannedText(code.data);
  }

  els.cardFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const id = await decodeCardFile(file);
      if (!id) {
        showToast('Couldn\u2019t find a PeerVoice QR code in that image.');
        return;
      }
      if (id === state.persistentId) {
        showToast('That\u2019s your own card.');
        return;
      }
      connectToContactChat(id, { isFirstTime: true });
    } catch (err) {
      console.error('PeerVoice card scan failed:', err);
      showToast('Couldn\u2019t read that image.');
    }
  });

  // --------------------------------------------------------------------
  // Chat-screen call buttons
  // --------------------------------------------------------------------
  els.btnChatCall.addEventListener('click', () => {
    if (state.openChatId) startOutgoingCall(state.openChatId, false);
  });
  els.btnChatVideo.addEventListener('click', () => {
    if (state.openChatId) startOutgoingCall(state.openChatId, true);
  });

  // --------------------------------------------------------------------
  // Mute / camera toggles
  // --------------------------------------------------------------------
  function toggleMute() {
    const stream = state.currentCallLocalStream || state.localStream;
    if (!stream) return;
    state.isMuted = !state.isMuted;
    stream.getAudioTracks().forEach((track) => { track.enabled = !state.isMuted; });
    els.btnMute.setAttribute('aria-pressed', String(state.isMuted));
    els.btnMute.setAttribute('aria-label', state.isMuted ? 'Unmute microphone' : 'Mute microphone');
    els.iconMicOn.hidden = state.isMuted;
    els.iconMicOff.hidden = !state.isMuted;
  }
  els.btnMute.addEventListener('click', toggleMute);

  els.btnToggleCamera.addEventListener('click', () => {
    const stream = state.currentCallLocalStream;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (!videoTracks.length) return;
    state.cameraOff = !state.cameraOff;
    videoTracks.forEach((t) => { t.enabled = !state.cameraOff; });
    els.btnToggleCamera.setAttribute('aria-pressed', String(state.cameraOff));
    els.btnToggleCamera.setAttribute('aria-label', state.cameraOff ? 'Turn camera on' : 'Turn camera off');
    els.iconCamOn.hidden = state.cameraOff;
    els.iconCamOff.hidden = !state.cameraOff;
    els.localVideo.style.visibility = state.cameraOff ? 'hidden' : 'visible';
  });

  // --------------------------------------------------------------------
  // Call timer
  // --------------------------------------------------------------------
  function startTimer() {
    state.callStartedAt = Date.now();
    updateTimer();
    state.timerHandle = setInterval(updateTimer, 1000);
  }

  function updateTimer() {
    const totalSeconds = Math.floor((Date.now() - state.callStartedAt) / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    els.callTimer.textContent = `${mm}:${ss}`;
  }

  function stopTimer() {
    if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
  }

  // --------------------------------------------------------------------
  // Audio visualizer — radial bars driven by the remote stream's volume
  // (voice-only calls; video calls show the real picture instead)
  // --------------------------------------------------------------------
  function startVisualizer(remoteStream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioCtx();
      if (state.audioCtx.state === 'suspended') state.audioCtx.resume().catch(() => {});

      const source = state.audioCtx.createMediaStreamSource(remoteStream);
      const analyser = state.audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      state.analyser = analyser;

      drawVisualizer();
    } catch (err) {
      console.warn('PeerVoice visualizer unavailable:', err);
    }
  }

  function drawVisualizer() {
    const canvas = els.waveCanvas;
    const ctx = canvas.getContext('2d');
    const analyser = state.analyser;
    if (!canvas || !ctx || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    const bars = 28;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRadius = 58;

    function frame() {
      state.rafHandle = requestAnimationFrame(frame);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < bars; i++) {
        const amp = data[i % bufferLength] / 255;
        const len = 6 + amp * 26;
        const angle = (i / bars) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * baseRadius;
        const y1 = cy + Math.sin(angle) * baseRadius;
        const x2 = cx + Math.cos(angle) * (baseRadius + len);
        const y2 = cy + Math.sin(angle) * (baseRadius + len);
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.35 + amp * 0.5})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    frame();
  }

  function stopVisualizer() {
    if (state.rafHandle) { cancelAnimationFrame(state.rafHandle); state.rafHandle = null; }
    if (state.audioCtx) { state.audioCtx.close().catch(() => {}); state.audioCtx = null; }
    state.analyser = null;
    const ctx = els.waveCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, els.waveCanvas.width, els.waveCanvas.height);
  }

  // --------------------------------------------------------------------
  // Theming
  // --------------------------------------------------------------------
  const THEME_KEY = 'pv_theme';

  function hexToRgbTriplet(hex) {
    const m = hex.replace('#', '');
    const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const bigint = parseInt(full, 16);
    return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
  }

  function lighten(hex, amount) {
    const m = hex.replace('#', '');
    const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const bigint = parseInt(full, 16);
    let r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    r = Math.min(255, Math.round(r + (255 - r) * amount));
    g = Math.min(255, Math.round(g + (255 - g) * amount));
    b = Math.min(255, Math.round(b + (255 - b) * amount));
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  function applyTheme(accentHex, accent2Hex) {
    const root = document.documentElement.style;
    root.setProperty('--accent', accentHex);
    root.setProperty('--accent-2', accent2Hex);
    root.setProperty('--accent-rgb', hexToRgbTriplet(accentHex));
    root.setProperty('--accent-2-rgb', hexToRgbTriplet(accent2Hex));
  }

  function saveTheme(accentHex, accent2Hex) {
    localStorage.setItem(THEME_KEY, JSON.stringify({ accent: accentHex, accent2: accent2Hex }));
  }

  function loadTheme() {
    try { return JSON.parse(localStorage.getItem(THEME_KEY) || 'null'); }
    catch (err) { return null; }
  }

  function renderThemeSwatches(selectedAccent) {
    els.themeSwatches.innerHTML = '';
    THEME_PRESETS.forEach((preset) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-swatch';
      btn.style.background = `linear-gradient(135deg, ${preset.accent2}, ${preset.accent})`;
      btn.setAttribute('aria-label', preset.name);
      if (selectedAccent === preset.accent) btn.classList.add('is-selected');
      btn.addEventListener('click', () => {
        applyTheme(preset.accent, preset.accent2);
        saveTheme(preset.accent, preset.accent2);
        els.customColorInput.value = preset.accent;
        renderThemeSwatches(preset.accent);
      });
      els.themeSwatches.appendChild(btn);
    });
  }

  function initTheme() {
    const saved = loadTheme();
    if (saved && saved.accent && saved.accent2) {
      applyTheme(saved.accent, saved.accent2);
      els.customColorInput.value = saved.accent;
    }
    renderThemeSwatches(saved ? saved.accent : THEME_PRESETS[0].accent);
  }

  els.customColorInput.addEventListener('input', (e) => {
    const accent = e.target.value;
    const accent2 = lighten(accent, 0.35);
    applyTheme(accent, accent2);
    saveTheme(accent, accent2);
    renderThemeSwatches(null);
  });

  // --------------------------------------------------------------------
  // Settings modal
  // --------------------------------------------------------------------
  els.btnSettings.addEventListener('click', () => {
    els.selfNameInput.value = getSelfDisplayName();
    els.settingsBackdrop.hidden = false;
  });
  els.btnCloseSettings.addEventListener('click', () => { els.settingsBackdrop.hidden = true; });
  els.settingsBackdrop.addEventListener('click', (e) => {
    if (e.target === els.settingsBackdrop) els.settingsBackdrop.hidden = true;
  });

  // --------------------------------------------------------------------
  // Custom install card
  // --------------------------------------------------------------------
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function maybeShowInstallCard() {
    if (isStandalone()) return;
    if (localStorage.getItem('pv_install_dismissed') === '1') return;
    if (state.deferredInstallPrompt) {
      els.installTitle.textContent = 'Install PeerVoice';
      els.installSub.textContent = 'Add it to your home screen for a faster, full-screen experience.';
      els.btnInstall.hidden = false;
      els.installCard.hidden = false;
    } else if (isIOS()) {
      els.installTitle.textContent = 'Add to Home Screen';
      els.installSub.textContent = 'Tap the Share icon in Safari, then "Add to Home Screen."';
      els.btnInstall.hidden = true;
      els.installCard.hidden = false;
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    maybeShowInstallCard();
  });

  window.addEventListener('appinstalled', () => {
    els.installCard.hidden = true;
    localStorage.setItem('pv_install_dismissed', '1');
  });

  els.btnInstall.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.installCard.hidden = true;
  });

  els.btnDismissInstall.addEventListener('click', () => {
    els.installCard.hidden = true;
    localStorage.setItem('pv_install_dismissed', '1');
  });

  // --------------------------------------------------------------------
  // Service worker
  // --------------------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('PeerVoice service worker registration failed:', err);
      });
    });
  }

  // --------------------------------------------------------------------
  // Device network state
  // --------------------------------------------------------------------
  window.addEventListener('offline', () => {
    setNetState('error', 'No internet connection');
    showToast('You\u2019re offline. Calls and messages will resume once your connection comes back.');
  });

  window.addEventListener('beforeunload', () => {
    if (state.peer && !state.peer.destroyed) state.peer.destroy();
  });

  // --------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------
  initTheme();
  maybeShowInstallCard();
  showPanel('permission');
  els.btnEnableMic.addEventListener('click', requestMicrophone);
})();
