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

  let map, userCoords = null;
  let username = "Usuário";
  const userMarkers = {};

  // Lista de cores para usuários diferentes
  const colors = ["#00BFFF", "#FF4500", "#32CD32", "#FFD700", "#FF69B4", "#8A2BE2"];
  const userColors = {};

  /* Atualizar hora */
  setInterval(() => {
    const now = new Date();
    horaAtual.textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
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

  /* Botão Mapa */
  if (btnMapa) {
    btnMapa.addEventListener("click", () => {
      mainScreen.classList.add("hidden");
      mapScreen.classList.remove("hidden");

      if (!map) {
        map = L.map("leafletMap").setView([0, 0], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors"
        }).addTo(map);
      }

      if (navigator.geolocation) {
        navigator.geolocation.watchPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          userCoords = [latitude, longitude];
          map.setView(userCoords, 15);

          // Atualiza marcador local
          updateUserMarker("me", latitude, longitude, username);

          // Envia para o Ably
          channel.publish("update", { id: ably.connection.id, name: username, lat: latitude, lon: longitude });

          // Atualiza clima
          atualizarClima(latitude, longitude);
        });
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
        map.setView(userCoords, 15);
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
