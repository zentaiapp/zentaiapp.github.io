/*
 * PeerVoice — app.js
 * Zero-backend browser-to-browser voice calling.
 *
 * Signaling: PeerJS's free public cloud broker (0.peerjs.com) is used only
 * to exchange connection metadata (SDP/ICE). No audio, no call content, and
 * no identifying data ever passes through it or any server we control —
 * there is no server we control. Once a call connects, media flows directly
 * between the two browsers.
 *
 * ICE traversal: Google's and Cloudflare's public STUN servers, configured
 * below, help each browser discover a reachable address for the other.
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

  // --------------------------------------------------------------------
  // DOM references
  // --------------------------------------------------------------------
  const panels = {
    permission: document.getElementById('panel-permission'),
    home: document.getElementById('panel-home'),
    waiting: document.getElementById('panel-waiting'),
    dialing: document.getElementById('panel-dialing'),
    incoming: document.getElementById('panel-incoming'),
    call: document.getElementById('panel-call')
  };

  const els = {
    netPill: document.getElementById('netPill'),
    netPillLabel: document.getElementById('netPillLabel'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toastText'),
    toastClose: document.getElementById('toastClose'),

    btnEnableMic: document.getElementById('btnEnableMic'),
    btnCreateLink: document.getElementById('btnCreateLink'),

    inviteLinkInput: document.getElementById('inviteLinkInput'),
    btnCopyLink: document.getElementById('btnCopyLink'),
    btnShareLink: document.getElementById('btnShareLink'),
    btnCancelWaiting: document.getElementById('btnCancelWaiting'),

    dialingTarget: document.getElementById('dialingTarget'),
    btnCancelDialing: document.getElementById('btnCancelDialing'),

    incomingFrom: document.getElementById('incomingFrom'),
    btnAccept: document.getElementById('btnAccept'),
    btnDecline: document.getElementById('btnDecline'),

    callPeerLabel: document.getElementById('callPeerLabel'),
    callTimer: document.getElementById('callTimer'),
    waveCanvas: document.getElementById('waveCanvas'),

    controlBar: document.getElementById('controlBar'),
    btnMute: document.getElementById('btnMute'),
    btnEndCall: document.getElementById('btnEndCall'),
    iconMicOn: document.querySelector('#btnMute .icon-mic-on'),
    iconMicOff: document.querySelector('#btnMute .icon-mic-off'),

    remoteAudio: document.getElementById('remoteAudio')
  };

  // --------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------
  const state = {
    peer: null,
    localStream: null,
    activeCall: null,
    pendingIncomingCall: null,
    targetPeerId: getTargetIdFromHash(),
    timerHandle: null,
    callStartedAt: null,
    callConnected: false,
    isMuted: false,
    audioCtx: null,
    analyser: null,
    rafHandle: null,
    toastTimeout: null
  };

  // --------------------------------------------------------------------
  // Panel / UI helpers
  // --------------------------------------------------------------------
  function showPanel(name) {
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.hidden = key !== name;
    });
    els.controlBar.hidden = name !== 'call';
  }

  function setNetState(stateName, label) {
    els.netPill.dataset.state = stateName;
    els.netPillLabel.textContent = label;
  }

  function showToast(message, { sticky = false } = {}) {
    els.toastText.textContent = message;
    els.toast.hidden = false;
    if (state.toastTimeout) clearTimeout(state.toastTimeout);
    if (!sticky) {
      state.toastTimeout = setTimeout(hideToast, 5500);
    }
  }

  function hideToast() {
    els.toast.hidden = true;
    if (state.toastTimeout) {
      clearTimeout(state.toastTimeout);
      state.toastTimeout = null;
    }
  }

  els.toastClose.addEventListener('click', hideToast);

  function getTargetIdFromHash() {
    const hash = window.location.hash || '';
    const match = hash.match(/[#&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function shortId(id) {
    if (!id) return '';
    return id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  }

  function buildInviteLink(peerId) {
    const url = new URL(window.location.href);
    url.hash = `id=${encodeURIComponent(peerId)}`;
    return url.toString();
  }

  // --------------------------------------------------------------------
  // Microphone
  // --------------------------------------------------------------------
  async function requestMicrophone() {
    els.btnEnableMic.disabled = true;
    els.btnEnableMic.textContent = 'Requesting access…';
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
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
    if (state.targetPeerId) {
      showPanel('dialing');
      els.dialingTarget.textContent = ` ${shortId(state.targetPeerId)}`;
    } else {
      showPanel('home');
    }
  }

  // --------------------------------------------------------------------
  // PeerJS signaling
  // --------------------------------------------------------------------
  function initPeer() {
    if (state.peer) return;

    setNetState('offline', 'Connecting…');
    const peer = new Peer(PEERJS_OPTS);
    state.peer = peer;

    peer.on('open', () => {
      setNetState('online', 'Online');
      if (state.targetPeerId) {
        dialPeer(state.targetPeerId);
      }
    });

    peer.on('call', handleIncomingCall);

    peer.on('disconnected', () => {
      setNetState('offline', 'Reconnecting…');
      if (!peer.destroyed) peer.reconnect();
    });

    peer.on('close', () => {
      setNetState('offline', 'Offline');
    });

    peer.on('error', (err) => handlePeerError(err));
  }

  function handlePeerError(err) {
    const type = err && err.type;
    if (type === 'peer-unavailable') {
      showToast('That link isn\u2019t active anymore \u2014 the other person may have closed the app.');
      if (!state.callConnected) {
        state.activeCall = null;
        resetToHome({ clearHash: true });
      }
      return;
    }
    if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
      setNetState('error', 'Connection issue');
      showToast('Having trouble reaching the signaling server. Check your connection.');
      return;
    }
    if (type === 'unavailable-id') {
      // Extremely unlikely with broker-assigned IDs; just retry fresh.
      state.peer = null;
      initPeer();
      return;
    }
    console.error('PeerVoice peer error:', err);
    showToast('Something went wrong with the connection.');
  }

  // --------------------------------------------------------------------
  // Outgoing call (joiner flow — arrived via someone else's link)
  // --------------------------------------------------------------------
  function dialPeer(targetId) {
    showPanel('dialing');
    els.dialingTarget.textContent = ` ${shortId(targetId)}`;

    const call = state.peer.call(targetId, state.localStream);
    if (!call) {
      showToast('Couldn\u2019t start the call. Try opening the link again.');
      resetToHome({ clearHash: true });
      return;
    }
    bindCallEvents(call, targetId);
    state.activeCall = call;
  }

  // --------------------------------------------------------------------
  // Incoming call (host flow — someone opened our invite link)
  // --------------------------------------------------------------------
  function handleIncomingCall(call) {
    if (state.activeCall) {
      // Already on a call — politely refuse any second caller.
      call.close();
      return;
    }
    state.pendingIncomingCall = call;
    els.incomingFrom.textContent = ` from ${shortId(call.peer)}`;
    showPanel('incoming');

    call.on('close', () => {
      if (state.pendingIncomingCall === call) {
        state.pendingIncomingCall = null;
        if (!state.activeCall) resetToHome({ clearHash: false });
      }
    });
  }

  els.btnAccept.addEventListener('click', () => {
    const call = state.pendingIncomingCall;
    if (!call) return;
    state.pendingIncomingCall = null;
    call.answer(state.localStream);
    bindCallEvents(call, call.peer);
    state.activeCall = call;
  });

  els.btnDecline.addEventListener('click', () => {
    const call = state.pendingIncomingCall;
    state.pendingIncomingCall = null;
    if (call) call.close();
    resetToHome({ clearHash: false });
  });

  // --------------------------------------------------------------------
  // Shared call lifecycle
  // --------------------------------------------------------------------
  function bindCallEvents(call, remoteId) {
    call.on('stream', (remoteStream) => {
      els.remoteAudio.srcObject = remoteStream;
      const playPromise = els.remoteAudio.play();
      if (playPromise && playPromise.catch) playPromise.catch(() => {});
      enterActiveCall(remoteId, remoteStream);
    });

    call.on('close', () => endCall({ clearHash: true, notify: false }));

    call.on('error', (err) => {
      console.error('PeerVoice call error:', err);
      showToast('The call ended unexpectedly.');
      endCall({ clearHash: true, notify: false });
    });
  }

  function enterActiveCall(remoteId, remoteStream) {
    state.callConnected = true;
    hideToast();
    els.callPeerLabel.textContent = `Connected to ${shortId(remoteId)}`;
    showPanel('call');
    startTimer();
    startVisualizer(remoteStream);
  }

  function endCall({ clearHash, notify } = {}) {
    state.callConnected = false;
    if (state.activeCall) {
      try { state.activeCall.close(); } catch (err) { /* already closing */ }
      state.activeCall = null;
    }
    stopTimer();
    stopVisualizer();
    els.remoteAudio.srcObject = null;
    if (notify) showToast('Call ended.');
    resetToHome({ clearHash });
  }

  els.btnEndCall.addEventListener('click', () => endCall({ clearHash: true, notify: false }));
  els.btnCancelDialing.addEventListener('click', () => endCall({ clearHash: true, notify: false }));

  els.btnCancelWaiting.addEventListener('click', () => {
    if (state.peer && !state.peer.destroyed) {
      state.peer.destroy();
      state.peer = null;
    }
    showPanel('home');
    setNetState('offline', 'Offline');
    // Give the next "Create invite link" click a clean peer to reconnect with.
    setTimeout(initPeer, 150);
  });

  function resetToHome({ clearHash }) {
    state.callConnected = false;
    if (clearHash && window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      state.targetPeerId = null;
    }
    els.callTimer.textContent = '00:00';
    els.remoteAudio.srcObject = null;
    if (state.isMuted) toggleMute(); // restore mic to unmuted for the next call
    showPanel('home');
  }

  // --------------------------------------------------------------------
  // Create invite link (host flow)
  // --------------------------------------------------------------------
  els.btnCreateLink.addEventListener('click', () => {
    if (!state.peer || state.peer.destroyed) {
      initPeer();
    }
    showPanel('waiting');
    els.inviteLinkInput.value = 'Generating link…';

    const showLink = () => {
      const link = buildInviteLink(state.peer.id);
      els.inviteLinkInput.value = link;
      els.btnShareLink.hidden = !navigator.share;
    };

    if (state.peer && state.peer.open) {
      showLink();
    } else if (state.peer) {
      state.peer.once('open', showLink);
    }
  });

  els.btnCopyLink.addEventListener('click', async () => {
    const link = els.inviteLinkInput.value;
    if (!link || link.startsWith('Generating')) return;
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
    try {
      await navigator.share({ title: 'Join me on PeerVoice', url: link });
    } catch (err) {
      /* user cancelled the share sheet — nothing to do */
    }
  });

  // --------------------------------------------------------------------
  // Mute toggle
  // --------------------------------------------------------------------
  function toggleMute() {
    if (!state.localStream) return;
    state.isMuted = !state.isMuted;
    state.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !state.isMuted;
    });
    els.btnMute.setAttribute('aria-pressed', String(state.isMuted));
    els.btnMute.setAttribute('aria-label', state.isMuted ? 'Unmute microphone' : 'Mute microphone');
    els.iconMicOn.hidden = state.isMuted;
    els.iconMicOff.hidden = !state.isMuted;
  }

  els.btnMute.addEventListener('click', toggleMute);

  // --------------------------------------------------------------------
  // Call timer
  // --------------------------------------------------------------------
  function startTimer() {
    state.callStartedAt = Date.now();
    updateTimer();
    state.timerHandle = setInterval(updateTimer, 1000);
  }

  function updateTimer() {
    const elapsedMs = Date.now() - state.callStartedAt;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    els.callTimer.textContent = `${mm}:${ss}`;
  }

  function stopTimer() {
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
  }

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
      // Visualizer is decorative — never let it break the call.
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
    if (state.rafHandle) {
      cancelAnimationFrame(state.rafHandle);
      state.rafHandle = null;
    }
    if (state.audioCtx) {
      state.audioCtx.close().catch(() => {});
      state.audioCtx = null;
    }
    state.analyser = null;
    const ctx = els.waveCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, els.waveCanvas.width, els.waveCanvas.height);
  }

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
  // Online / offline (device network, distinct from signaling state)
  // --------------------------------------------------------------------
  window.addEventListener('offline', () => {
    setNetState('error', 'No internet connection');
    showToast('You\u2019re offline. The call will drop until your connection comes back.');
  });

  window.addEventListener('beforeunload', () => {
    if (state.peer && !state.peer.destroyed) state.peer.destroy();
  });

  // --------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------
  showPanel('permission');
  els.btnEnableMic.addEventListener('click', requestMicrophone);
})();
