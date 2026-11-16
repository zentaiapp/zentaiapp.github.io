/*
 * PeerVoice — app.js
 *
 * 100% peer-to-peer. Nothing here talks to a server you run — PeerJS's
 * public broker and the STUN servers below only help two browsers find
 * each other; once connected, voice, video, and chat all flow directly
 * between the two devices.
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

  const PEERJS_OPTS = { debug: 0, config: { iceServers: ICE_SERVERS } };

  const THEME_PRESETS = [
    { name: 'Indigo', accent: '#4f46e5', accent2: '#60a5fa' },
    { name: 'Sky', accent: '#0284c7', accent2: '#38bdf8' },
    { name: 'Teal', accent: '#0d9488', accent2: '#2dd4bf' },
    { name: 'Emerald', accent: '#059669', accent2: '#34d399' },
    { name: 'Amber', accent: '#d97706', accent2: '#fbbf24' },
    { name: 'Rose', accent: '#e11d48', accent2: '#fb7185' },
    { name: 'Crimson', accent: '#be123c', accent2: '#f87171' },
    { name: 'Violet', accent: '#7c3aed', accent2: '#a78bfa' },
    { name: 'Slate', accent: '#475569', accent2: '#94a3b8' }
  ];

  const CARD_QR_SIZE = 220;
  const ID_PATTERN = /^pv-[A-Za-z0-9]{10,40}$/;
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const CHAT_RETRY_MS = 10000;

  // --------------------------------------------------------------------
  // DOM references
  // --------------------------------------------------------------------
  const panels = {
    permission: document.getElementById('panel-permission'),
    home: document.getElementById('panel-home'),
    profile: document.getElementById('panel-profile'),
    scanner: document.getElementById('panel-scanner'),
    connecting: document.getElementById('panel-connecting'),
    incoming: document.getElementById('panel-incoming'),
    chat: document.getElementById('panel-chat'),
    call: document.getElementById('panel-call')
  };

  const TAB_PANELS = new Set(['home', 'profile']);

  const els = {
    brandName: document.getElementById('brandName'),
    btnToggleAvailability: document.getElementById('btnToggleAvailability'),

    toast: document.getElementById('toast'),
    toastText: document.getElementById('toastText'),
    toastClose: document.getElementById('toastClose'),

    installCard: document.getElementById('installCard'),
    installTitle: document.getElementById('installTitle'),
    installSub: document.getElementById('installSub'),
    btnInstall: document.getElementById('btnInstall'),
    btnDismissInstall: document.getElementById('btnDismissInstall'),

    btnEnableMic: document.getElementById('btnEnableMic'),

    contactsList: document.getElementById('contactsList'),
    contactsEmpty: document.getElementById('contactsEmpty'),
    btnShowArchived: document.getElementById('btnShowArchived'),
    archivedCount: document.getElementById('archivedCount'),

    selfNameInput: document.getElementById('selfNameInput'),
    cardCanvas: document.getElementById('cardCanvas'),
    btnDownloadCard: document.getElementById('btnDownloadCard'),
    btnShareCard: document.getElementById('btnShareCard'),
    inviteLinkInput: document.getElementById('inviteLinkInput'),
    btnCopyLink: document.getElementById('btnCopyLink'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),

    scannerVideo: document.getElementById('scannerVideo'),
    scannerHint: document.getElementById('scannerHint'),
    cardFileInput: document.getElementById('cardFileInput'),
    btnCloseScanner: document.getElementById('btnCloseScanner'),

    connectingTitle: document.getElementById('connectingTitle'),
    connectingTarget: document.getElementById('connectingTarget'),
    btnCancelConnecting: document.getElementById('btnCancelConnecting'),

    incomingKind: document.getElementById('incomingKind'),
    incomingFrom: document.getElementById('incomingFrom'),
    btnAccept: document.getElementById('btnAccept'),
    btnDecline: document.getElementById('btnDecline'),

    btnChatBack: document.getElementById('btnChatBack'),
    btnChatContactInfo: document.getElementById('btnChatContactInfo'),
    chatContactName: document.getElementById('chatContactName'),
    chatContactStatus: document.getElementById('chatContactStatus'),
    btnChatCall: document.getElementById('btnChatCall'),
    btnChatVideo: document.getElementById('btnChatVideo'),
    chatMessages: document.getElementById('chatMessages'),
    chatInputForm: document.getElementById('chatInputForm'),
    chatInput: document.getElementById('chatInput'),
    btnChatSend: document.getElementById('btnChatSend'),
    btnChatAttachLabel: document.getElementById('btnChatAttachLabel'),
    chatFileInput: document.getElementById('chatFileInput'),

    videoStage: document.getElementById('videoStage'),
    remoteVideo: document.getElementById('remoteVideo'),
    localVideo: document.getElementById('localVideo'),
    liveOrb: document.getElementById('liveOrb'),
    callPeerLabel: document.getElementById('callPeerLabel'),
    callTimer: document.getElementById('callTimer'),
    waveCanvas: document.getElementById('waveCanvas'),

    controlBar: document.getElementById('controlBar'),
    btnMute: document.getElementById('btnMute'),
    btnUpgradeVideo: document.getElementById('btnUpgradeVideo'),
    btnFlipCamera: document.getElementById('btnFlipCamera'),
    btnToggleCamera: document.getElementById('btnToggleCamera'),
    btnEndCall: document.getElementById('btnEndCall'),
    iconMicOn: document.querySelector('#btnMute .icon-mic-on'),
    iconMicOff: document.querySelector('#btnMute .icon-mic-off'),
    iconCamOn: document.querySelector('#btnToggleCamera .icon-cam-on'),
    iconCamOff: document.querySelector('#btnToggleCamera .icon-cam-off'),

    tabBar: document.getElementById('tabBar'),
    tabHome: document.getElementById('tabHome'),
    tabScan: document.getElementById('tabScan'),
    tabProfile: document.getElementById('tabProfile'),

    settingsBackdrop: document.getElementById('settingsBackdrop'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    modeSegmented: document.getElementById('modeSegmented'),
    themeSwatches: document.getElementById('themeSwatches'),
    btnAvailabilitySwitch: document.getElementById('btnAvailabilitySwitch'),
    btnSettingsInstall: document.getElementById('btnSettingsInstall'),
    settingsInstallHint: document.getElementById('settingsInstallHint'),

    nameBackdrop: document.getElementById('nameBackdrop'),
    nameModalInput: document.getElementById('nameModalInput'),
    btnSaveName: document.getElementById('btnSaveName'),

    contactDetailBackdrop: document.getElementById('contactDetailBackdrop'),
    contactDetailTitle: document.getElementById('contactDetailTitle'),
    contactDetailNameInput: document.getElementById('contactDetailNameInput'),
    contactDetailIdText: document.getElementById('contactDetailIdText'),
    btnCloseContactDetail: document.getElementById('btnCloseContactDetail'),
    btnSaveContactName: document.getElementById('btnSaveContactName'),
    btnArchiveContact: document.getElementById('btnArchiveContact'),
    btnDeleteContact: document.getElementById('btnDeleteContact'),

    archivedBackdrop: document.getElementById('archivedBackdrop'),
    archivedList: document.getElementById('archivedList'),
    archivedEmpty: document.getElementById('archivedEmpty'),
    btnCloseArchived: document.getElementById('btnCloseArchived'),

    confirmBackdrop: document.getElementById('confirmBackdrop'),
    confirmMessage: document.getElementById('confirmMessage'),
    btnConfirmCancel: document.getElementById('btnConfirmCancel'),
    btnConfirmOk: document.getElementById('btnConfirmOk'),

    remoteAudio: document.getElementById('remoteAudio')
  };

  // --------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------
  const state = {
    persistentId: null,
    peer: null,
    manuallyOffline: false,
    connectionState: 'offline',
    localStream: null,
    currentCallLocalStream: null,
    cameraFacing: 'user',
    activeCall: null,
    pendingIncomingCall: null,
    pendingIncomingWantsVideo: false,
    targetPeerId: getTargetIdFromUrl(),
    pendingAutoConnectId: null,
    dataConnections: new Map(),
    fileUrls: new Map(),
    openChatId: null,
    chatRetryHandle: null,
    contactDetailId: null,
    timerHandle: null,
    callStartedAt: null,
    callConnected: false,
    isMuted: false,
    cameraOff: false,
    audioCtx: null,
    analyser: null,
    rafHandle: null,
    toastTimeout: null,
    deferredInstallPrompt: null,
    scannerStream: null,
    scannerRaf: null,
    scannerCanvas: document.createElement('canvas')
  };

  // --------------------------------------------------------------------
  // Small helpers
  // --------------------------------------------------------------------
  function showPanel(name) {
    Object.entries(panels).forEach(([key, el]) => { if (el) el.hidden = key !== name; });
    els.controlBar.hidden = name !== 'call';
    els.tabBar.hidden = !TAB_PANELS.has(name);
    els.tabHome.classList.toggle('is-active', name === 'home');
    els.tabProfile.classList.toggle('is-active', name === 'profile');
    if (name !== 'scanner') closeScanner();
    if (name !== 'chat') stopChatRetry();
  }

  function getCurrentPanelName() {
    const found = Object.entries(panels).find(([, el]) => el && !el.hidden);
    return found ? found[0] : null;
  }

  function showToast(message, { sticky = false } = {}) {
    els.toastText.textContent = message;
    els.toast.hidden = false;
    if (state.toastTimeout) clearTimeout(state.toastTimeout);
    if (!sticky) state.toastTimeout = setTimeout(hideToast, 5500);
  }

  function hideToast() {
    els.toast.hidden = true;
    if (state.toastTimeout) { clearTimeout(state.toastTimeout); state.toastTimeout = null; }
  }

  els.toastClose.addEventListener('click', hideToast);

  function getTargetIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('add');
    return id && ID_PATTERN.test(id) ? id : null;
  }

  function clearAddParam() {
    if (window.location.search) history.replaceState(null, '', window.location.pathname);
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

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // --------------------------------------------------------------------
  // Generic confirm modal
  // --------------------------------------------------------------------
  function confirmAction(message, onConfirm) {
    els.confirmMessage.textContent = message;
    els.confirmBackdrop.hidden = false;
    const cleanup = () => {
      els.confirmBackdrop.hidden = true;
      els.btnConfirmOk.removeEventListener('click', onOk);
      els.btnConfirmCancel.removeEventListener('click', onCancel);
    };
    const onOk = () => { cleanup(); onConfirm(); };
    const onCancel = () => cleanup();
    els.btnConfirmOk.addEventListener('click', onOk);
    els.btnConfirmCancel.addEventListener('click', onCancel);
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
    refreshCardPreview();
  });

  // --------------------------------------------------------------------
  // Contacts (localStorage only — never leaves this device)
  // --------------------------------------------------------------------
  const CONTACTS_KEY = 'pv_contacts';

  function loadContacts() {
    try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); }
    catch (err) { return []; }
  }

  function saveContacts(list) { localStorage.setItem(CONTACTS_KEY, JSON.stringify(list)); }
  function getContact(id) { return loadContacts().find((c) => c.id === id) || null; }
  function getContactDisplayName(id) { const c = getContact(id); return c ? c.name : shortId(id); }

  function upsertContact({ id, name }) {
    const contacts = loadContacts();
    const existing = contacts.find((c) => c.id === id);
    if (existing) {
      if (name) existing.name = name;
      existing.lastContacted = Date.now();
    } else {
      contacts.push({ id, name: name || shortId(id), lastContacted: Date.now(), unread: false, archived: false });
    }
    saveContacts(contacts);
    renderContactsList();
  }

  function renameContact(id, name) {
    const contacts = loadContacts();
    const c = contacts.find((x) => x.id === id);
    if (c && name) { c.name = name; saveContacts(contacts); }
    renderContactsList();
  }

  function archiveContact(id, archived) {
    const contacts = loadContacts();
    const c = contacts.find((x) => x.id === id);
    if (c) { c.archived = archived; saveContacts(contacts); }
    renderContactsList();
    renderArchivedList();
  }

  function deleteContact(id) {
    const contacts = loadContacts().filter((c) => c.id !== id);
    saveContacts(contacts);
    localStorage.removeItem(msgsKey(id));
    const conn = state.dataConnections.get(id);
    if (conn) { try { conn.close(); } catch (err) { /* noop */ } state.dataConnections.delete(id); }
    renderContactsList();
    renderArchivedList();
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

  // Presence is purely "are we connected right now" — there's no server
  // anywhere keeping track of who's online in the background.
  function describePresence(contact) {
    const conn = state.dataConnections.get(contact.id);
    if (conn && conn.open) return 'Online now';
    if (contact.lastContacted) return `Last talked ${timeAgo(contact.lastContacted)}`;
    return 'Tap to message';
  }

  function renderContactsList() {
    const contacts = loadContacts().filter((c) => !c.archived).sort((a, b) => b.lastContacted - a.lastContacted);
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

      const kebab = document.createElement('button');
      kebab.type = 'button';
      kebab.className = 'contact-kebab';
      kebab.setAttribute('aria-label', 'Contact options');
      kebab.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><circle cx="12" cy="5" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="12" cy="19" r="1.6"></circle></svg>';
      kebab.addEventListener('click', (e) => { e.stopPropagation(); openContactDetail(contact.id); });

      card.append(avatar, meta, kebab);
      if (contact.unread) {
        const badge = document.createElement('span');
        badge.className = 'contact-unread';
        card.appendChild(badge);
      }
      card.addEventListener('click', () => connectToContactChat(contact.id));
      els.contactsList.appendChild(card);
    });

    const archivedCount = loadContacts().filter((c) => c.archived).length;
    els.btnShowArchived.hidden = archivedCount === 0;
    els.archivedCount.textContent = String(archivedCount);
  }

  function renderArchivedList() {
    const archived = loadContacts().filter((c) => c.archived);
    els.archivedList.innerHTML = '';
    els.archivedEmpty.hidden = archived.length > 0;
    archived.forEach((contact) => {
      const row = document.createElement('div');
      row.className = 'archived-row';
      const name = document.createElement('span');
      name.className = 'contact-name';
      name.textContent = contact.name;
      const unarchiveBtn = document.createElement('button');
      unarchiveBtn.type = 'button';
      unarchiveBtn.className = 'btn btn-ghost';
      unarchiveBtn.textContent = 'Unarchive';
      unarchiveBtn.addEventListener('click', () => archiveContact(contact.id, false));
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        confirmAction(`Delete the conversation with ${contact.name}? This can\u2019t be undone.`, () => deleteContact(contact.id));
      });
      row.append(name, unarchiveBtn, deleteBtn);
      els.archivedList.appendChild(row);
    });
  }

  els.btnShowArchived.addEventListener('click', () => { renderArchivedList(); els.archivedBackdrop.hidden = false; });
  els.btnCloseArchived.addEventListener('click', () => { els.archivedBackdrop.hidden = true; });
  els.archivedBackdrop.addEventListener('click', (e) => { if (e.target === els.archivedBackdrop) els.archivedBackdrop.hidden = true; });

  // --------------------------------------------------------------------
  // Contact detail modal (rename existing contact any time, archive, delete)
  // --------------------------------------------------------------------
  function openContactDetail(id) {
    const contact = getContact(id);
    if (!contact) return;
    state.contactDetailId = id;
    els.contactDetailTitle.textContent = contact.name;
    els.contactDetailNameInput.value = contact.name;
    els.contactDetailIdText.textContent = `ID: ${shortId(id)}`;
    els.contactDetailBackdrop.hidden = false;
  }

  els.btnCloseContactDetail.addEventListener('click', () => { els.contactDetailBackdrop.hidden = true; });
  els.contactDetailBackdrop.addEventListener('click', (e) => { if (e.target === els.contactDetailBackdrop) els.contactDetailBackdrop.hidden = true; });

  els.btnSaveContactName.addEventListener('click', () => {
    const id = state.contactDetailId;
    const val = els.contactDetailNameInput.value.trim();
    if (id && val) {
      renameContact(id, val);
      if (state.openChatId === id) { els.chatContactName.textContent = val; }
    }
    els.contactDetailBackdrop.hidden = true;
  });

  els.btnArchiveContact.addEventListener('click', () => {
    const id = state.contactDetailId;
    els.contactDetailBackdrop.hidden = true;
    if (!id) return;
    archiveContact(id, true);
    if (state.openChatId === id) { state.openChatId = null; showPanel('home'); }
  });

  els.btnDeleteContact.addEventListener('click', () => {
    const id = state.contactDetailId;
    els.contactDetailBackdrop.hidden = true;
    if (!id) return;
    confirmAction(`Delete this conversation with ${getContactDisplayName(id)}? This can\u2019t be undone.`, () => {
      deleteContact(id);
      if (state.openChatId === id) { state.openChatId = null; showPanel('home'); }
    });
  });

  els.btnChatContactInfo.addEventListener('click', () => {
    if (state.openChatId) openContactDetail(state.openChatId);
  });

  // --------------------------------------------------------------------
  // Name-this-contact modal (first time only)
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
      const onSave = () => { const val = els.nameModalInput.value.trim(); cleanup(); resolve(val || suggested || shortId(id)); };
      const onBackdrop = (e) => { if (e.target === els.nameBackdrop) { cleanup(); resolve(suggested || shortId(id)); } };
      els.btnSaveName.addEventListener('click', onSave);
      els.nameBackdrop.addEventListener('click', onBackdrop);
      setTimeout(() => els.nameModalInput.focus(), 50);
    });
  }

  // --------------------------------------------------------------------
  // Tab navigation
  // --------------------------------------------------------------------
  els.tabHome.addEventListener('click', () => { showPanel('home'); renderContactsList(); });
  els.tabProfile.addEventListener('click', () => { showPanel('profile'); refreshProfileScreen(); });
  els.tabScan.addEventListener('click', openScanner);

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
  function updateBrandState() {
    const effective = state.manuallyOffline ? 'offline' : state.connectionState;
    els.brandName.dataset.state = effective;
    els.btnToggleAvailability.setAttribute('aria-pressed', String(!state.manuallyOffline));
    const label = state.manuallyOffline
      ? 'Appearing offline — tap to go online'
      : effective === 'online' ? 'Online — tap to appear offline'
      : effective === 'connecting' ? 'Connecting…' : 'Offline';
    els.btnToggleAvailability.setAttribute('aria-label', label);
    els.btnAvailabilitySwitch.setAttribute('aria-pressed', String(state.manuallyOffline));
  }

  function setConnectionState(stateName) {
    state.connectionState = stateName;
    updateBrandState();
  }

  function initPeer() {
    if (state.peer) return;
    state.persistentId = getOrCreatePersistentId();

    setConnectionState('connecting');
    const peer = new Peer(state.persistentId, PEERJS_OPTS);
    state.peer = peer;

    peer.on('open', () => {
      els.inviteLinkInput.value = buildInviteLink(peer.id);
      refreshCardPreview();
      if (state.manuallyOffline) {
        peer.disconnect();
        setConnectionState('offline');
      } else {
        setConnectionState('online');
      }
      if (state.pendingAutoConnectId) {
        const id = state.pendingAutoConnectId;
        state.pendingAutoConnectId = null;
        connectToContactChat(id, { isFirstTime: true });
      }
    });

    peer.on('connection', handleIncomingConnection);
    peer.on('call', handleIncomingCall);

    peer.on('disconnected', () => {
      if (state.manuallyOffline) { setConnectionState('offline'); return; }
      setConnectionState('connecting');
      if (!peer.destroyed) peer.reconnect();
    });

    peer.on('close', () => setConnectionState('offline'));
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
      setConnectionState('offline');
      showToast('PeerVoice looks like it\u2019s already open in another tab or window on this device.', { sticky: true });
      return;
    }
    if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
      if (!state.manuallyOffline) setConnectionState('connecting');
      showToast('Having trouble reaching the signaling server. Check your connection.');
      return;
    }
    console.error('PeerVoice peer error:', err);
    showToast('Something went wrong with the connection.');
  }

  // --------------------------------------------------------------------
  // Appear offline / availability toggle
  // --------------------------------------------------------------------
  function toggleAvailability() {
    if (!state.peer) return;
    state.manuallyOffline = !state.manuallyOffline;
    localStorage.setItem('pv_manually_offline', state.manuallyOffline ? '1' : '0');
    if (state.manuallyOffline) {
      state.peer.disconnect();
      showToast('You\u2019re appearing offline \u2014 no one can call or message you right now.');
    } else {
      state.peer.reconnect();
      showToast('You\u2019re back online.');
    }
    updateBrandState();
  }

  els.btnToggleAvailability.addEventListener('click', toggleAvailability);
  els.btnAvailabilitySwitch.addEventListener('click', toggleAvailability);

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
        if (state.openChatId === id) updateChatInputEnabled(id);
        renderContactsList();
      });
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => { if (!settled) { settled = true; reject(new Error('timeout')); } }, 8000);

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
        if (state.openChatId === id) updateChatInputEnabled(id);
        resolve(conn);
      });

      conn.on('error', (err) => { if (settled) return; settled = true; clearTimeout(timeout); reject(err); });
    });
  }

  function handleIncomingConnection(conn) {
    const id = conn.peer;
    state.dataConnections.set(id, conn);
    conn._pvBound = true;

    conn.on('data', (data) => handleIncomingChatData(id, data));
    conn.on('close', () => {
      state.dataConnections.delete(id);
      if (state.openChatId === id) updateChatInputEnabled(id);
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
      if (state.openChatId === id) updateChatInputEnabled(id);
    });
  }

  function fileUrlKey(id, ts) { return `${id}:${ts}`; }

  function handleIncomingChatData(id, data) {
    if (!data) return;
    if (data.kind === 'file' && data.data) {
      const blob = new Blob([data.data], { type: data.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const ts = data.ts || Date.now();
      state.fileUrls.set(fileUrlKey(id, ts), url);
      appendMessage(id, { from: 'them', kind: 'file', name: data.name, mimeType: data.mimeType, size: data.size, ts });
    } else if (typeof data.text === 'string') {
      appendMessage(id, { from: 'them', text: data.text, ts: data.ts || Date.now() });
    } else {
      return;
    }
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
    if (existing && existing.open) { openChatScreen(id); return; }
    showPanel('connecting');
    els.connectingTitle.textContent = 'Connecting';
    els.connectingTarget.textContent = ` to ${getContactDisplayName(id)}`;
    try {
      await getOrCreateDataConnection(id, opts);
      openChatScreen(id);
    } catch (err) {
      showToast(getContact(id) ? `${getContactDisplayName(id)} appears to be offline right now.` : 'That card or link isn\u2019t active anymore.');
      returnToIdle({ clearParam: !!opts.isFirstTime });
    }
  }

  function openChatScreen(id) {
    state.openChatId = id;
    els.chatContactName.textContent = getContactDisplayName(id);
    clearUnread(id);
    renderChatMessages(id);
    showPanel('chat');
    attemptBackgroundConnect(id);
    stopChatRetry();
    state.chatRetryHandle = setInterval(() => {
      if (state.openChatId === id && !(state.dataConnections.get(id)?.open)) {
        attemptBackgroundConnect(id);
      }
    }, CHAT_RETRY_MS);
    setTimeout(() => els.chatInput.focus(), 50);
  }

  function stopChatRetry() {
    if (state.chatRetryHandle) { clearInterval(state.chatRetryHandle); state.chatRetryHandle = null; }
  }

  async function attemptBackgroundConnect(id) {
    updateChatInputEnabled(id);
    try { await getOrCreateDataConnection(id); } catch (err) { /* stays disabled until next retry */ }
    if (state.openChatId === id) updateChatInputEnabled(id);
  }

  function updateChatInputEnabled(id) {
    const isOnline = Boolean(state.dataConnections.get(id)?.open);
    els.chatInput.disabled = !isOnline;
    els.btnChatSend.disabled = !isOnline;
    els.chatFileInput.disabled = !isOnline;
    els.btnChatAttachLabel.classList.toggle('is-disabled', !isOnline);
    els.chatInput.placeholder = isOnline ? 'Message' : 'Waiting for them to come online…';
    updateChatHeaderStatus(id);
  }

  function updateChatHeaderStatus(id) {
    const contact = getContact(id);
    els.chatContactStatus.textContent = contact ? describePresence(contact) : 'Offline';
  }

  els.btnChatBack.addEventListener('click', () => {
    stopChatRetry();
    state.openChatId = null;
    showPanel('home');
    renderContactsList();
  });

  // --------------------------------------------------------------------
  // Chat message storage (metadata only for files — see appendMessage)
  // --------------------------------------------------------------------
  function msgsKey(id) { return `pv_msgs_${id}`; }

  function loadMessages(id) {
    try { return JSON.parse(localStorage.getItem(msgsKey(id)) || '[]'); }
    catch (err) { return []; }
  }

  function appendMessage(id, msg) {
    const msgs = loadMessages(id);
    // File content (ArrayBuffer/blob URL) is never persisted — only its
    // metadata is, to avoid silently filling up localStorage with binary
    // data. The live blob URL stays available for this session only.
    const persisted = { from: msg.from, ts: msg.ts };
    if (msg.kind === 'file') {
      persisted.kind = 'file';
      persisted.name = msg.name;
      persisted.mimeType = msg.mimeType;
      persisted.size = msg.size;
    } else {
      persisted.text = msg.text;
    }
    msgs.push(persisted);
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

      if (msg.kind === 'file') {
        const url = state.fileUrls.get(fileUrlKey(id, msg.ts));
        if (url && msg.mimeType && msg.mimeType.startsWith('image/')) {
          const imgEl = document.createElement('img');
          imgEl.className = 'chat-image';
          imgEl.src = url;
          imgEl.alt = msg.name || 'image';
          bubble.appendChild(imgEl);
        } else {
          const fileRow = document.createElement('a');
          fileRow.className = 'chat-file' + (url ? '' : ' is-unavailable');
          fileRow.href = url || '#';
          if (url) fileRow.download = msg.name || 'file';
          fileRow.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>';
          const label = document.createElement('span');
          label.textContent = url ? `${msg.name || 'File'} \u00b7 ${formatBytes(msg.size || 0)}` : `${msg.name || 'File'} (unavailable after reload)`;
          fileRow.appendChild(label);
          bubble.appendChild(fileRow);
        }
      } else {
        const text = document.createElement('span');
        text.className = 'chat-bubble-text';
        text.textContent = msg.text;
        bubble.appendChild(text);
      }

      const time = document.createElement('span');
      time.className = 'chat-bubble-time';
      time.textContent = formatClock(msg.ts);
      bubble.appendChild(time);
      els.chatMessages.appendChild(bubble);
    });
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  els.chatInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = els.chatInput.value.trim();
    const id = state.openChatId;
    if (!text || !id) return;
    const conn = state.dataConnections.get(id);
    if (!conn || !conn.open) return; // input is disabled while offline, but guard anyway
    els.chatInput.value = '';
    try {
      conn.send({ text, ts: Date.now() });
      appendMessage(id, { from: 'me', text, ts: Date.now() });
    } catch (err) {
      appendMessage(id, { from: 'me', text, ts: Date.now() });
      showToast('That message may not have gone through. Try again.');
    }
    renderChatMessages(id);
  });

  els.chatFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    const id = state.openChatId;
    if (!file || !id) return;
    if (file.size > MAX_FILE_BYTES) { showToast('That file is too large to send (15 MB limit).'); return; }
    const conn = state.dataConnections.get(id);
    if (!conn || !conn.open) { showToast(`${getContactDisplayName(id)} is offline right now.`); return; }
    try {
      const buffer = await file.arrayBuffer();
      const ts = Date.now();
      conn.send({ kind: 'file', name: file.name, mimeType: file.type, size: file.size, data: buffer, ts });
      const localUrl = URL.createObjectURL(file);
      state.fileUrls.set(fileUrlKey(id, ts), localUrl);
      appendMessage(id, { from: 'me', kind: 'file', name: file.name, mimeType: file.type, size: file.size, ts });
      renderChatMessages(id);
    } catch (err) {
      console.error('PeerVoice file send failed:', err);
      showToast('Couldn\u2019t send that file.');
    }
  });

  // --------------------------------------------------------------------
  // Calls (voice or video)
  // --------------------------------------------------------------------
  async function getCallStream(withVideo) {
    if (!withVideo) return state.localStream;
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: { facingMode: state.cameraFacing, width: { ideal: 640 }, height: { ideal: 480 } }
    });
  }

  async function startOutgoingCall(id, withVideo) {
    if (state.activeCall) { showToast('You\u2019re already on a call.'); return; }
    state.cameraFacing = 'user';
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
    if (state.activeCall) { call.close(); return; }
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
    state.cameraFacing = 'user';
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

    // Best-effort fallback: catches a video track added mid-call (see
    // btnUpgradeVideo) on browsers/cases where PeerJS doesn't re-fire its
    // own 'stream' event after renegotiation. This path is less tested
    // than the rest of the app — if a voice-to-video upgrade misbehaves,
    // starting a fresh video call from the chat screen always works.
    if (call.peerConnection) {
      call.peerConnection.addEventListener('track', (event) => {
        if (event.track.kind !== 'video') return;
        const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
        els.remoteVideo.srcObject = stream;
        els.videoStage.hidden = false;
        els.videoStage.dataset.hasVideo = 'true';
        els.liveOrb.hidden = true;
        stopVisualizer();
      });
    }
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
      els.btnUpgradeVideo.hidden = true;
      els.btnFlipCamera.hidden = false;
      els.btnToggleCamera.hidden = false;
      els.btnToggleCamera.setAttribute('aria-pressed', 'false');
      els.iconCamOn.hidden = false;
      els.iconCamOff.hidden = true;
      state.cameraOff = false;
    } else {
      els.localVideo.hidden = true;
      els.btnUpgradeVideo.hidden = false;
      els.btnFlipCamera.hidden = true;
      els.btnToggleCamera.hidden = true;
    }

    showPanel('call');
    startTimer();
    if (!hasRemoteVideo) startVisualizer(remoteStream);
  }

  function endCall({ clearParam, notify } = {}) {
    state.callConnected = false;
    if (state.activeCall) { try { state.activeCall.close(); } catch (err) { /* already closing */ } state.activeCall = null; }
    stopTimer();
    stopVisualizer();
    els.remoteAudio.srcObject = null;
    els.remoteVideo.srcObject = null;
    els.localVideo.srcObject = null;
    els.videoStage.hidden = true;
    els.liveOrb.hidden = false;
    els.btnUpgradeVideo.hidden = true;
    els.btnFlipCamera.hidden = true;
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
    if (state.activeCall) { try { state.activeCall.close(); } catch (err) { /* noop */ } state.activeCall = null; }
    const id = state.openChatId || state.targetPeerId;
    if (id) {
      const conn = state.dataConnections.get(id);
      if (conn && !conn.open) { try { conn.close(); } catch (err) { /* noop */ } state.dataConnections.delete(id); }
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
  // Voice-to-video upgrade (best effort — see the note in bindCallEvents)
  // --------------------------------------------------------------------
  els.btnUpgradeVideo.addEventListener('click', async () => {
    if (!state.activeCall || !state.currentCallLocalStream) return;
    if (state.currentCallLocalStream.getVideoTracks().length) return;
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: state.cameraFacing, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      const videoTrack = videoStream.getVideoTracks()[0];
      const pc = state.activeCall.peerConnection;
      if (!pc || typeof pc.addTrack !== 'function') throw new Error('no-peer-connection');
      pc.addTrack(videoTrack, state.currentCallLocalStream);
      state.currentCallLocalStream.addTrack(videoTrack);

      els.localVideo.srcObject = state.currentCallLocalStream;
      els.localVideo.hidden = false;
      els.videoStage.hidden = false;
      els.videoStage.dataset.hasVideo = 'true';
      els.liveOrb.hidden = true;
      stopVisualizer();
      els.btnUpgradeVideo.hidden = true;
      els.btnFlipCamera.hidden = false;
      els.btnToggleCamera.hidden = false;
      els.btnToggleCamera.setAttribute('aria-pressed', 'false');
      els.iconCamOn.hidden = false;
      els.iconCamOff.hidden = true;
      showToast('Switching to video\u2026');
    } catch (err) {
      console.error('PeerVoice video upgrade failed:', err);
      showToast('Couldn\u2019t switch to video on this call \u2014 try starting a new video call instead.');
    }
  });

  els.btnFlipCamera.addEventListener('click', async () => {
    if (!state.activeCall || !state.currentCallLocalStream) return;
    const oldTrack = state.currentCallLocalStream.getVideoTracks()[0];
    if (!oldTrack) return;
    const newFacing = state.cameraFacing === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacing }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      const newTrack = newStream.getVideoTracks()[0];
      const pc = state.activeCall.peerConnection;
      const sender = pc && pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);
      oldTrack.stop();
      state.currentCallLocalStream.removeTrack(oldTrack);
      state.currentCallLocalStream.addTrack(newTrack);
      els.localVideo.srcObject = state.currentCallLocalStream;
      state.cameraFacing = newFacing;
    } catch (err) {
      console.error('PeerVoice camera flip failed:', err);
      showToast('Couldn\u2019t switch cameras on this device.');
    }
  });

  // --------------------------------------------------------------------
  // Chat-screen call buttons
  // --------------------------------------------------------------------
  els.btnChatCall.addEventListener('click', () => { if (state.openChatId) startOutgoingCall(state.openChatId, false); });
  els.btnChatVideo.addEventListener('click', () => { if (state.openChatId) startOutgoingCall(state.openChatId, true); });

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
  function stopTimer() { if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; } }

  // --------------------------------------------------------------------
  // Audio visualizer — radial bars driven by the remote stream's volume
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
  // Theming (accent color)
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
    refreshCardPreview();
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
        customColorInput.value = preset.accent;
        renderThemeSwatches(preset.accent);
      });
      els.themeSwatches.appendChild(btn);
    });

    const customColorInput = document.createElement('input');
    customColorInput.type = 'color';
    customColorInput.className = 'theme-swatch-custom';
    customColorInput.setAttribute('aria-label', 'Custom color');
    const saved = loadTheme();
    customColorInput.value = saved ? saved.accent : THEME_PRESETS[0].accent;
    customColorInput.addEventListener('input', (e) => {
      const accent = e.target.value;
      const accent2 = lighten(accent, 0.35);
      applyTheme(accent, accent2);
      saveTheme(accent, accent2);
      renderThemeSwatches(null);
    });
    els.themeSwatches.appendChild(customColorInput);
  }

  function initTheme() {
    const saved = loadTheme();
    if (saved && saved.accent && saved.accent2) applyTheme(saved.accent, saved.accent2);
    renderThemeSwatches(saved ? saved.accent : THEME_PRESETS[0].accent);
  }

  // --------------------------------------------------------------------
  // Light / dark / system appearance mode
  // --------------------------------------------------------------------
  const MODE_KEY = 'pv_mode';
  const lightMediaQuery = window.matchMedia('(prefers-color-scheme: light)');

  function applyColorMode(choice) {
    const resolved = choice === 'system' ? (lightMediaQuery.matches ? 'light' : 'dark') : choice;
    document.documentElement.setAttribute('data-mode', resolved);
  }

  function renderModeSegmented(choice) {
    els.modeSegmented.querySelectorAll('.segmented-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mode === choice);
    });
  }

  function setColorModeChoice(choice) {
    localStorage.setItem(MODE_KEY, choice);
    applyColorMode(choice);
    renderModeSegmented(choice);
  }

  function initColorMode() {
    const saved = localStorage.getItem(MODE_KEY) || 'system';
    applyColorMode(saved);
    renderModeSegmented(saved);
    lightMediaQuery.addEventListener('change', () => {
      if ((localStorage.getItem(MODE_KEY) || 'system') === 'system') applyColorMode('system');
    });
  }

  els.modeSegmented.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented-btn');
    if (btn) setColorModeChoice(btn.dataset.mode);
  });

  // --------------------------------------------------------------------
  // Settings modal
  // --------------------------------------------------------------------
  function refreshSettingsInstallRow() {
    if (isStandalone()) {
      els.btnSettingsInstall.hidden = true;
      els.settingsInstallHint.textContent = 'PeerVoice is installed on this device.';
    } else if (state.deferredInstallPrompt) {
      els.btnSettingsInstall.hidden = false;
      els.settingsInstallHint.textContent = 'Add it to your home screen for a faster, full-screen experience.';
    } else if (isIOS()) {
      els.btnSettingsInstall.hidden = true;
      els.settingsInstallHint.textContent = 'On iOS: tap the Share icon in Safari, then "Add to Home Screen."';
    } else {
      els.btnSettingsInstall.hidden = true;
      els.settingsInstallHint.textContent = 'Your browser doesn\u2019t support one-tap install here.';
    }
  }

  els.btnOpenSettings.addEventListener('click', () => {
    refreshSettingsInstallRow();
    els.settingsBackdrop.hidden = false;
  });
  els.btnCloseSettings.addEventListener('click', () => { els.settingsBackdrop.hidden = true; });
  els.settingsBackdrop.addEventListener('click', (e) => { if (e.target === els.settingsBackdrop) els.settingsBackdrop.hidden = true; });

  els.btnSettingsInstall.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    refreshSettingsInstallRow();
    els.installCard.hidden = true;
  });

  // --------------------------------------------------------------------
  // Profile screen + card rendering
  // --------------------------------------------------------------------
  function refreshProfileScreen() {
    els.selfNameInput.value = getSelfDisplayName();
    if (state.peer && state.peer.open) els.inviteLinkInput.value = buildInviteLink(state.peer.id);
    refreshCardPreview();
  }

  async function refreshCardPreview() {
    if (!els.cardCanvas || !(state.peer && state.peer.open)) return;
    try { await drawCardToCanvas(els.cardCanvas); } catch (err) { console.warn('PeerVoice card preview failed:', err); }
  }

  function drawMiniLogo(ctx, x, y, size) {
    // Drawn with plain canvas primitives (no external image) so card
    // generation never depends on loading an outside resource.
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f46e5';
    const accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#60a5fa';
    const r = size / 2;
    ctx.save();
    ctx.translate(x, y);
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, accent2);
    grad.addColorStop(1, accent);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(r * 0.32, r, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size - r * 0.32, r, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    const barHeights = [0.22, 0.42, 0.62, 0.42, 0.22];
    const barWidth = size * 0.07;
    const gap = size * 0.1;
    const startX = size * 0.32;
    barHeights.forEach((h, i) => {
      const barH = size * h;
      ctx.fillRect(startX + i * gap, r - barH / 2, barWidth, barH);
    });
    ctx.restore();
  }

  async function drawCardToCanvas(canvas) {
    const link = (state.peer && state.peer.open) ? buildInviteLink(state.peer.id) : els.inviteLinkInput.value;
    if (!link) throw new Error('no-link-yet');
    if (typeof QRCode === 'undefined') throw new Error('qrcode-library-not-loaded');

    const qrDataUrl = await QRCode.toDataURL(link, { margin: 1, width: CARD_QR_SIZE, color: { dark: '#050505', light: '#ffffff' } });

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

    drawMiniLogo(ctx, 36, 34, 56);

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
  }

  els.btnDownloadCard.addEventListener('click', async () => {
    if (!state.peer || !state.peer.open) { showToast('Still connecting \u2014 try again in a moment.'); return; }
    try {
      await drawCardToCanvas(els.cardCanvas);
      const dataUrl = els.cardCanvas.toDataURL('image/png');
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

  els.btnShareCard.addEventListener('click', async () => {
    if (!navigator.share) return;
    try {
      await drawCardToCanvas(els.cardCanvas);
      els.cardCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `peervoice-card-${shortId(state.persistentId)}.png`, { type: 'image/png' });
        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Message me on PeerVoice', url: els.inviteLinkInput.value });
          return;
        }
        await navigator.share({ title: 'Message me on PeerVoice', files: [file] });
      }, 'image/png');
    } catch (err) { /* user cancelled, or share isn't available for files here */ }
  });

  els.btnCopyLink.addEventListener('click', async () => {
    const link = els.inviteLinkInput.value;
    if (!link) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(link);
      else { els.inviteLinkInput.select(); document.execCommand('copy'); }
      els.btnCopyLink.classList.add('is-copied');
      setTimeout(() => els.btnCopyLink.classList.remove('is-copied'), 1600);
    } catch (err) {
      showToast('Couldn\u2019t copy automatically \u2014 select the link and copy it manually.');
    }
  });

  // --------------------------------------------------------------------
  // Scanner (live camera QR scan, with an upload-image fallback)
  // --------------------------------------------------------------------
  function extractIdFromScannedText(text) {
    try {
      const url = new URL(text);
      const id = url.searchParams.get('add');
      if (id && ID_PATTERN.test(id)) return id;
    } catch (err) { /* not a URL — fall through and try the raw text */ }
    return ID_PATTERN.test(text) ? text : null;
  }

  function handleScannedId(id) {
    if (id === state.persistentId) { showToast('That\u2019s your own card.'); showPanel('home'); return; }
    connectToContactChat(id, { isFirstTime: true });
  }

  async function openScanner() {
    showPanel('scanner');
    els.scannerHint.textContent = 'Point your camera at a PeerVoice card.';
    try {
      state.scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      els.scannerVideo.srcObject = state.scannerStream;
      await els.scannerVideo.play();
      scanLoop();
    } catch (err) {
      els.scannerHint.textContent = 'Couldn\u2019t access the camera \u2014 you can still upload an image below.';
    }
  }

  function scanLoop() {
    const canvas = state.scannerCanvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      if (!state.scannerStream) return;
      if (els.scannerVideo.readyState === els.scannerVideo.HAVE_ENOUGH_DATA && els.scannerVideo.videoWidth) {
        canvas.width = els.scannerVideo.videoWidth;
        canvas.height = els.scannerVideo.videoHeight;
        ctx.drawImage(els.scannerVideo, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const id = extractIdFromScannedText(code.data);
          if (id) { closeScanner(); handleScannedId(id); return; }
        }
      }
      state.scannerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function closeScanner() {
    if (state.scannerRaf) { cancelAnimationFrame(state.scannerRaf); state.scannerRaf = null; }
    if (state.scannerStream) { state.scannerStream.getTracks().forEach((t) => t.stop()); state.scannerStream = null; }
    els.scannerVideo.srcObject = null;
  }

  els.btnCloseScanner.addEventListener('click', () => { closeScanner(); showPanel('home'); });

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
      if (!id) { showToast('Couldn\u2019t find a PeerVoice QR code in that image.'); return; }
      closeScanner();
      handleScannedId(id);
    } catch (err) {
      console.error('PeerVoice card scan failed:', err);
      showToast('Couldn\u2019t read that image.');
    }
  });

  // --------------------------------------------------------------------
  // Custom install card (home screen) + always-available Settings entry
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
    // Dismissing only hides this banner — the Install option in Settings
    // (via the Profile tab) still works any time, since it doesn't rely
    // on this flag.
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
    showToast('You\u2019re offline. Calls and messages will resume once your connection comes back.');
  });

  window.addEventListener('beforeunload', () => {
    if (state.peer && !state.peer.destroyed) state.peer.destroy();
  });

  // --------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------
  state.manuallyOffline = localStorage.getItem('pv_manually_offline') === '1';
  initColorMode();
  initTheme();
  maybeShowInstallCard();
  showPanel('permission');
  els.btnEnableMic.addEventListener('click', requestMicrophone);
})();
