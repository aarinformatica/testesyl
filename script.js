document.addEventListener("DOMContentLoaded", () => {
  /* ELEMENTOS PRINCIPAIS */
  const welcomeScreen = document.getElementById("welcomeScreen");
  const accessAppBtn = document.getElementById("accessApp");
  const mainScreen = document.getElementById("mainScreen");
  const mapScreen = document.getElementById("mapScreen");
  const btnMapa = document.getElementById("btnMapa");
  const btnVoltar = document.getElementById("btnVoltar");
  const btnRecenter = document.getElementById("btnRecenter");
  const btnLogin = document.getElementById("btnLogin");
  const btnSite = document.getElementById("btnSite");
  const btnConfig = document.getElementById("btnConfig");

  /* LOGIN */
  const loginModal = document.getElementById("loginModal");
  const closeLogin = document.getElementById("closeLogin");
  const loginConfirm = document.getElementById("loginConfirm");
  const usernameInput = document.getElementById("usernameInput");
  const usernameDisplay = document.getElementById("usernameDisplay");

  /* CONFIGURAÇÕES */
  const settingsModal = document.getElementById("settingsModal");
  const closeSettings = document.getElementById("closeSettings");
  const cancelSettings = document.getElementById("cancelSettings");
  const applySettings = document.getElementById("applySettings");
  const alertOptions = document.querySelectorAll("input[name='alertOption']");
  const applyAnimation = document.getElementById("applyAnimation");

  /* FOOTER */
  const horaAtual = document.getElementById("horaAtual");
  const climaTexto = document.getElementById("climaTexto");
  const climaIcon = document.getElementById("climaIcon");

  /* MAPA */
  const loadingOverlay = document.getElementById("loadingOverlay");
  let map, userCoords = null;
  let username = "Usuário";
  let alertMode = "both";
  let tempAlertMode = alertMode;

  const userMarkers = {};
  const userColors = {};
  const colors = ["#00BFFF", "#FF4500", "#32CD32", "#FFD700", "#FF69B4", "#8A2BE2"];

  /* RELÓGIO */
  setInterval(() => {
    const now = new Date();
    horaAtual.textContent = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }, 1000);

  /* CLIMA */
  function atualizarClima(lat, lon) {
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=8a60b2de14f7a17c7a11706b2cfcd87c`)
      .then(res => res.json())
      .then(data => {
        climaTexto.textContent = `${Math.round(data.main.temp)}°C`;
        climaIcon.textContent = data.weather[0].icon.includes("d") ? "☀️" : "🌙";
      })
      .catch(() => climaTexto.textContent = "Erro clima");
  }

  /* TELA DE BOAS-VINDAS */
  accessAppBtn?.addEventListener("click", () => {
    welcomeScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");
  });

  /* LOGIN */
  btnLogin?.addEventListener("click", () => loginModal.classList.remove("hidden"));
  closeLogin?.addEventListener("click", () => loginModal.classList.add("hidden"));
  loginConfirm?.addEventListener("click", () => {
    if (usernameInput.value.trim()) {
      username = usernameInput.value;
      usernameDisplay.textContent = username;
    }
    loginModal.classList.add("hidden");
  });

  /* CONFIGURAÇÕES */
  btnConfig?.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
    alertOptions.forEach(opt => {
      opt.checked = (opt.value === alertMode);
    });
    tempAlertMode = alertMode;
    applyAnimation.classList.add("hidden");
    applyAnimation.classList.remove("visible");
  });

  closeSettings?.addEventListener("click", () => settingsModal.classList.add("hidden"));
  cancelSettings?.addEventListener("click", () => settingsModal.classList.add("hidden"));

  applySettings?.addEventListener("click", () => {
    const selected = document.querySelector("input[name='alertOption']:checked");
    if (!selected) {
      settingsModal.classList.add("hidden");
      return;
    }
    const newMode = selected.value;

    if (newMode !== alertMode) {
      applyAnimation.classList.remove("hidden");
      applyAnimation.classList.add("visible");

      setTimeout(() => {
        alertMode = newMode;
        applyAnimation.classList.remove("visible");
        applyAnimation.classList.add("hidden");
        settingsModal.classList.add("hidden");
      }, 2000);
    } else {
      settingsModal.classList.add("hidden");
    }
  });

  /* SITE */
  btnSite?.addEventListener("click", () => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <iframe src="https://codepen.io/alexsandroar/full/yyBZRwj" style="width:100%; height:400px; border:none;"></iframe>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".close").addEventListener("click", () => modal.remove());
  });

  /* ABLY */
  const ably = new Ably.Realtime("k8KGvw.DMPcTg:DCJCRov283jjdnvtNwp1nF37-w2mvZsiRHUTx9L47OU");
  const channel = ably.channels.get("syl-locations");

  function createPulseIcon(color, label, isAlert = false) {
    return L.divIcon({
      className: "custom-marker",
      html: `
        <div class="pulse-marker" style="background:${color}"></div>
        <div class="marker-label">${label}</div>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 16],
      popupAnchor: [0, -16]
    });
  }

  function updateUserMarker(userId, lat, lon, name, isAlert = false) {
    if (!userColors[userId]) {
      userColors[userId] = colors[Object.keys(userColors).length % colors.length];
    }
    const color = userColors[userId];
    if (userMarkers[userId]) {
      userMarkers[userId].setLatLng([lat, lon]);
      userMarkers[userId].setIcon(createPulseIcon(color, name, isAlert));
    } else {
      const marker = L.marker([lat, lon], {
        icon: createPulseIcon(color, name, isAlert)
      }).addTo(map);
      userMarkers[userId] = marker;
    }
  }

  function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function emitirAlerta() {
    if (alertMode === "audio" || alertMode === "both") {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      function tocarBip(inicio) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(550, ctx.currentTime + inicio);
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
        gainNode.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + inicio + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.5);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(ctx.currentTime + inicio);
        osc.stop(ctx.currentTime + inicio + 0.5);
      }
      tocarBip(0);
      tocarBip(0.6);
      tocarBip(1.2);
    }
    if ((alertMode === "vibrate" || alertMode === "both") && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }

  /* BOTÃO MAPA */
  btnMapa?.addEventListener("click", () => {
    mainScreen.classList.add("hidden");
    mapScreen.classList.remove("hidden");
    btnVoltar.classList.remove("hidden");
    loadingOverlay.classList.remove("hidden");

    if (!map) {
      map = L.map("leafletMap").setView([0, 0], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        userCoords = [latitude, longitude];
        map.setView(userCoords, 16);
        updateUserMarker("me", latitude, longitude, username);
        channel.publish("update", { id: ably.connection.id, name: username, lat: latitude, lon: longitude });
        atualizarClima(latitude, longitude);
        loadingOverlay.classList.add("hidden");

        navigator.geolocation.watchPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          userCoords = [latitude, longitude];
          map.setView(userCoords, 16);
          updateUserMarker("me", latitude, longitude, username);
          channel.publish("update", { id: ably.connection.id, name: username, lat: latitude, lon: longitude });
          atualizarClima(latitude, longitude);
        });
      }, () => {
        loadingOverlay.textContent = "Erro ao obter localização.";
      });
    }
  });

  /* VOLTAR */
  btnVoltar?.addEventListener("click", () => {
    mapScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");
    btnVoltar.classList.add("hidden");
  });

  /* RECENTER */
  btnRecenter?.addEventListener("click", () => {
    if (userCoords) map.setView(userCoords, 16);
  });

  /* RECEBENDO LOCALIZAÇÕES */
  channel.subscribe("update", (msg) => {
    const { id, name, lat, lon } = msg.data;
    if (id !== ably.connection.id) {
      if (userCoords) {
        const dist = calcularDistancia(userCoords[0], userCoords[1], lat, lon);
        const isAlert = dist <= 100;
        if (isAlert) emitirAlerta();
        updateUserMarker(id, lat, lon, name, isAlert);
      } else {
        updateUserMarker(id, lat, lon, name);
      }
    }
  });
});
