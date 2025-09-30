document.addEventListener("DOMContentLoaded", () => {
  const mainScreen = document.getElementById("mainScreen");
  const mapScreen = document.getElementById("mapScreen");
  const leafletMapDiv = document.getElementById("leafletMap");

  const btnMapa = document.getElementById("btnMapa");
  const btnVoltar = document.getElementById("btnVoltar");
  const btnRecenter = document.getElementById("btnRecenter");
  const btnLogin = document.getElementById("btnLogin");
  const btnSite = document.getElementById("btnSite");

  const loginModal = document.getElementById("loginModal");
  const closeLogin = document.getElementById("closeLogin");
  const loginConfirm = document.getElementById("loginConfirm");
  const usernameInput = document.getElementById("usernameInput");
  const usernameDisplay = document.getElementById("usernameDisplay");

  const horaAtual = document.getElementById("horaAtual");
  const climaTexto = document.getElementById("climaTexto");
  const climaIcon = document.getElementById("climaIcon");

  const loadingOverlay = document.getElementById("loadingOverlay");

  let map, userCoords = null;
  let username = "Usuário";
  const userMarkers = {};

  // Lista de cores para diferenciar usuários
  const colors = ["#00BFFF", "#FF4500", "#32CD32", "#FFD700", "#FF69B4", "#8A2BE2"];
  const userColors = {};

  /* Atualizar hora */
  setInterval(() => {
    const now = new Date();
    if (horaAtual) {
      horaAtual.textContent = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }, 1000);

  /* Atualizar clima */
  function atualizarClima(lat, lon) {
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=8a60b2de14f7a17c7a11706b2cfcd87c`)
      .then(res => res.json())
      .then(data => {
        climaTexto.textContent = `${Math.round(data.main.temp)}°C`;
        climaIcon.textContent = data.weather[0].icon.includes("d") ? "☀️" : "🌙";
      })
      .catch(() => climaTexto.textContent = "Erro clima");
  }

  /* Botão Site */
  if (btnSite) {
    btnSite.addEventListener("click", () => {
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
  }

  /* Botão Login */
  if (btnLogin) {
    btnLogin.addEventListener("click", () => loginModal.classList.remove("hidden"));
  }
  if (closeLogin) {
    closeLogin.addEventListener("click", () => loginModal.classList.add("hidden"));
  }
  if (loginConfirm) {
    loginConfirm.addEventListener("click", () => {
      if (usernameInput.value.trim()) {
        username = usernameInput.value;
        usernameDisplay.textContent = username;
      }
      loginModal.classList.add("hidden");
    });
  }

  /* Ably setup */
  const ably = new Ably.Realtime("k8KGvw.DMPcTg:DCJCRov283jjdnvtNwp1nF37-w2mvZsiRHUTx9L47OU");
  const channel = ably.channels.get("syl-locations");

  // Criar marcador pulsante customizado
  function createPulseIcon(color, label) {
    return L.divIcon({
      className: "custom-marker",
      html: `
        <div class="pulse-marker" style="background:${color}">
          <div class="pulse-ring" style="background:${color}33"></div>
        </div>
        <div class="marker-label">${label}</div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 18],
      popupAnchor: [0, -18]
    });
  }

  // Atualizar/exibir marcador de usuário
  function updateUserMarker(userId, lat, lon, name) {
    if (!userColors[userId]) {
      userColors[userId] = colors[Object.keys(userColors).length % colors.length];
    }
    const color = userColors[userId];

    if (userMarkers[userId]) {
      userMarkers[userId].setLatLng([lat, lon]);
    } else {
      const marker = L.marker([lat, lon], {
        icon: createPulseIcon(color, name)
      }).addTo(map);
      userMarkers[userId] = marker;
    }
  }

  // Calcular distância entre dois pontos
  function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371000; // raio da Terra em metros
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Alerta sonoro + vibratório
  function dispararAlerta() {
    try {
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
      audio.play();
    } catch (e) {
      console.warn("Falha ao tocar som:", e);
    }
    if (navigator.vibrate) {
      navigator.vibrate([500, 300, 500]);
    }
  }

  /* Botão Mapa */
  if (btnMapa) {
    btnMapa.addEventListener("click", () => {
      mainScreen.classList.add("hidden");
      mapScreen.classList.remove("hidden");
      loadingOverlay.classList.remove("hidden"); // exibe tela de carregamento

      if (!map) {
        map = L.map("leafletMap").setView([0, 0], 16); // Zoom inicial 16
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors"
        }).addTo(map);
      }

      if (navigator.geolocation) {
        navigator.geolocation.watchPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          userCoords = [latitude, longitude];
          map.setView(userCoords, 16);

          // Oculta a tela de carregamento após obter a primeira posição
          loadingOverlay.classList.add("hidden");

          // Atualiza marcador local
          updateUserMarker("me", latitude, longitude, username);

          // Envia para o Ably
          channel.publish("update", {
            id: ably.connection.id,
            name: username,
            lat: latitude,
            lon: longitude
          });

          // Atualiza clima
          atualizarClima(latitude, longitude);

          // Verificar proximidade
          Object.entries(userMarkers).forEach(([id, marker]) => {
            if (id !== "me") {
              const pos = marker.getLatLng();
              const dist = calcularDistancia(latitude, longitude, pos.lat, pos.lng);
              if (dist <= 100) {
                dispararAlerta();
              }
            }
          });
        }, (err) => {
          console.error("Erro ao obter localização:", err);
          loadingOverlay.classList.add("hidden");
        }, {
          enableHighAccuracy: false, // pega mais rápido inicialmente
          maximumAge: 0,
          timeout: 5000
        });

        // Depois de 5s, ativa precisão alta
        setTimeout(() => {
          navigator.geolocation.watchPosition(() => {}, () => {}, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
          });
        }, 5000);
      }
    });
  }

  /* Botão Voltar */
  if (btnVoltar) {
    btnVoltar.addEventListener("click", () => {
      mapScreen.classList.add("hidden");
      mainScreen.classList.remove("hidden");
    });
  }

  /* Botão Recentrar */
  if (btnRecenter) {
    btnRecenter.addEventListener("click", () => {
      if (userCoords) {
        map.setView(userCoords, 16);
      }
    });
  }

  /* Receber posições dos outros usuários */
  channel.subscribe("update", (msg) => {
    const { id, name, lat, lon } = msg.data;
    if (id !== ably.connection.id) {
      updateUserMarker(id, lat, lon, name);
    }
  });
});
