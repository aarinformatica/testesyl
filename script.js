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
  let firstLocation = true;

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
        <div class="pulse-marker" style="background:${color}">
          <div class="pulse-ring"></div>
        </div>
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

  /* MAPA */
  btnMapa?.addEventListener("click", () => {
    mainScreen.classList.add("hidden");
    mapScreen.classList.remove("hidden");
    btnVoltar.classList.remove("hidden");

    if (!map) {
      map = L.map("leafletMap").setView([0, 0], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        userCoords = [latitude, longitude];

        if (firstLocation) {
          map.setView(userCoords, 16);
          firstLocation = false;
        }

        updateUserMarker("me", latitude, longitude, username);
        channel.publish("update", { id: ably.connection.id, name: username, lat: latitude, lon: longitude });
        atualizarClima(latitude, longitude);
        loadingOverlay.classList.add("hidden");
      }, () => alert("Erro ao obter localização"), { enableHighAccuracy: true });

      channel.subscribe("update", (msg) => {
        const { id, name, lat, lon } = msg.data;
        if (id !== ably.connection.id) {
          updateUserMarker(id, lat, lon, name);
          if (userCoords) {
            const dist = calcularDistancia(userCoords[0], userCoords[1], lat, lon);
            if (dist <= 20) {
              updateUserMarker(id, lat, lon, name, true);
              if (alertMode === "sound" || alertMode === "both") new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg").play();
              if (alertMode === "vibrate" || alertMode === "both") navigator.vibrate([200, 100, 200]);
            }
          }
        }
      });
    }
  });

  btnVoltar?.addEventListener("click", () => {
    mapScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");
    btnVoltar.classList.add("hidden");
  });

  btnRecenter?.addEventListener("click", () => {
    if (userCoords) map.setView(userCoords, 16);
  });
});
