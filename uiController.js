const NARIM_HOURS_IN_DAY = 30.0;

const mapRange = (value, inMin, inMax, outMin, outMax) => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

export const updateTimeControlsUI = (newScale) => {
  const timeSlider = document.getElementById("time-slider");
  const timeInput = document.getElementById("time-input");
  if (timeSlider && timeInput) {
    timeSlider.value = newScale;
    timeInput.value = newScale;
  }
};

export const updateTimeDisplay = (time, yearLengthInDays) => {
  const yearsDisplay = document.getElementById("years-display");
  const daysDisplay = document.getElementById("days-display");
  const hoursDisplay = document.getElementById("hours-display");

  if (!yearsDisplay || !daysDisplay || !hoursDisplay) return;

  const currentYear = Math.floor(time / yearLengthInDays);
  const dayOfYear = Math.floor(time % yearLengthInDays);
  const fractionOfDay = time - Math.floor(time);
  const totalMinutesInDay = NARIM_HOURS_IN_DAY * 60;
  const currentMinuteOfDay = Math.floor(fractionOfDay * totalMinutesInDay);
  const currentHour = Math.floor(currentMinuteOfDay / 60);
  const currentMinute = currentMinuteOfDay % 60;
  const formattedHour = String(currentHour).padStart(2, "0");
  const formattedMinute = String(currentMinute).padStart(2, "0");
  yearsDisplay.innerText = currentYear;
  daysDisplay.innerText = dayOfYear;
  hoursDisplay.innerText = `${formattedHour}:${formattedMinute}`;
};

export const initializeUI = (camera, scene, config) => {
  const NARIM_HOURS_IN_DAY = 30.0;
  const menuContainer = document.getElementById("controls-menu");
  if (!menuContainer) return;
  menuContainer.innerHTML = "<h3>Controles</h3>";

  const timeDisplayGroup = document.createElement("div");
  timeDisplayGroup.className = "time-display";
  timeDisplayGroup.innerHTML = `
    <p>Ano: <span id="years-display">0</span></p>
    <p>Dia: <span id="days-display">0</span></p>
    <p>Hora: <span id="hours-display">00:00</span></p>
  `;
  menuContainer.appendChild(timeDisplayGroup);

  const createBodyControls = (bodyData) => {
    if (!bodyData.visual || bodyData.name === "Anavon") return;
    const group = document.createElement("div");
    group.className = "body-control-group";
    const button = document.createElement("button");
    button.innerText = bodyData.name;
    button.onclick = () => {
      const targetMesh = scene.getMeshByName(bodyData.name);
      if (targetMesh) {
        camera.lockedTarget = targetMesh;
        const meshRadius =
          targetMesh.getBoundingInfo().boundingSphere.radiusWorld;
        const desiredRadius = meshRadius * 6;
        const minAllowedRadius = camera.minZ * 1.1;
        camera.radius = Math.max(desiredRadius, minAllowedRadius);

        const inspectBtn = document.getElementById("inspect-mode-btn");
        if (inspectBtn) {
          inspectBtn.disabled = false;
        }
      }
    };
    group.appendChild(button);

    if (bodyData.visual && bodyData.visual.maps) {
      const label = document.createElement("label");
      label.innerText = "Mapa de Textura";
      group.appendChild(label);
      const select = document.createElement("select");
      for (const mapName in bodyData.visual.maps) {
        const option = document.createElement("option");
        option.value = mapName;
        option.innerText = mapName;
        select.appendChild(option);
      }
      select.value = bodyData.visual.defaultMap;
      select.onchange = () => {
        const mesh = scene.getMeshByName(bodyData.name);
        if (!mesh || !mesh.material) return;
        const selectedMapName = select.value;
        const newTextureUrl = bodyData.visual.maps[selectedMapName];
        mesh.material.diffuseTexture = new BABYLON.Texture(
          newTextureUrl,
          scene
        );
        if (mesh.name === config.star.name) {
          mesh.material.emissiveTexture = mesh.material.diffuseTexture;
        }
      };
      group.appendChild(select);
    }
    menuContainer.appendChild(group);
  };

  createBodyControls(config.star);
  config.planets.forEach((p) => {
    p.components.forEach((c) => {
      createBodyControls(c);
      if (c.moons) {
        c.moons.forEach((m) => createBodyControls(m));
      }
    });
  });

  const povGroup = document.createElement("div");
  povGroup.className = "control-group";
  povGroup.innerHTML = `
        <button id="pov-mode-btn">Ativar Modo POV</button>
        <button id="exit-pov-btn" style="display:none; background-color: #8c2a2a;">Sair do POV</button>
    `;
  menuContainer.appendChild(povGroup);

  const povBtn = povGroup.querySelector("#pov-mode-btn");
  const exitPovBtn = povGroup.querySelector("#exit-pov-btn");

  povBtn.addEventListener("click", () => {
    povBtn.style.display = "none";
    exitPovBtn.style.display = "block";
    window.dispatchEvent(new CustomEvent("activatePovMode"));
  });
  exitPovBtn.addEventListener("click", () => {
    povBtn.style.display = "block";
    exitPovBtn.style.display = "none";
    window.dispatchEvent(new CustomEvent("exitPovMode"));
  });

  const inspectionGroup = document.createElement("div");
  inspectionGroup.className = "control-group";
  inspectionGroup.innerHTML = `
    <button id="inspect-mode-btn" disabled>Inspecionar Alvo</button>
`;
  menuContainer.appendChild(inspectionGroup);

  const inspectBtn = inspectionGroup.querySelector("#inspect-mode-btn");

  inspectBtn.addEventListener("click", () => {
    const exitInspectBtn = document.querySelector("#exit-inspect-mode-btn");
    inspectBtn.style.display = "none";
    exitInspectBtn.style.display = "block";
    window.dispatchEvent(new CustomEvent("enterInspectMode"));
  });

  // --- GRUPO DE CONTROLES DE DEBUG ---
  const visualRefGroup = document.createElement("div");
  const title = document.createElement("h3");
  title.innerText = "Referências Visuais";
  title.style.marginTop = "15px";
  title.style.paddingTop = "10px";
  title.style.borderTop = "1px solid #555";
  visualRefGroup.appendChild(title);

  // LÓGICA DO CHECKBOX DE PINOS (RESTAURADA)
  let hasPins = false;
  config.planets.forEach((p) =>
    p.components.forEach((c) => {
      if (c.debugFeatures?.polePins) hasPins = true;
    })
  );

  if (hasPins) {
    const pinToggleLabel = document.createElement("label");
    pinToggleLabel.className = "control-group";
    pinToggleLabel.style.display = "flex";
    pinToggleLabel.style.alignItems = "center";
    pinToggleLabel.style.gap = "8px";
    pinToggleLabel.style.cursor = "pointer";
    pinToggleLabel.innerHTML = `<input type="checkbox" id="pin-toggle"> Exibir Pinos de Eixo`;

    const pinToggle = pinToggleLabel.querySelector("#pin-toggle");
    pinToggle.addEventListener("change", (event) => {
      const isVisible = event.target.checked;
      scene.meshes.forEach((mesh) => {
        if (mesh.name.endsWith("-pin")) {
          mesh.isVisible = isVisible;
        }
      });
    });
    visualRefGroup.appendChild(pinToggleLabel);
  }

  // LÓGICA DO CHECKBOX DE LINHAS DE ÓRBITA
  const orbitLineToggleLabel = document.createElement("label");
  orbitLineToggleLabel.className = "control-group";
  orbitLineToggleLabel.style.display = "flex";
  orbitLineToggleLabel.style.alignItems = "center";
  orbitLineToggleLabel.style.gap = "8px";
  orbitLineToggleLabel.style.cursor = "pointer";
  orbitLineToggleLabel.innerHTML = `<input type="checkbox" id="orbit-line-toggle"> Exibir Linhas de Órbita`;

  const orbitLineToggle =
    orbitLineToggleLabel.querySelector("#orbit-line-toggle");
  orbitLineToggle.addEventListener("change", (event) => {
    const isVisible = event.target.checked;
    scene.meshes.forEach((mesh) => {
      if (mesh.name.endsWith("-orbit-line")) {
        mesh.isVisible = isVisible;
      }
    });
  });
  visualRefGroup.appendChild(orbitLineToggleLabel);

  menuContainer.appendChild(visualRefGroup);

  // LÓGICA DO CHECKBOX DE RAIO (DEBUG)
  const rayToggleLabel = document.createElement("label");
  rayToggleLabel.className = "control-group";
  rayToggleLabel.style.display = "flex";
  rayToggleLabel.style.alignItems = "center";
  rayToggleLabel.style.gap = "8px";
  rayToggleLabel.style.cursor = "pointer";
  rayToggleLabel.innerHTML = `<input type="checkbox" id="ray-toggle"> Exibir Raios (Debug)`;

  const rayToggle = rayToggleLabel.querySelector("#ray-toggle");
  rayToggle.addEventListener("change", (event) => {
    window.dispatchEvent(
      new CustomEvent("toggleRayDebug", {
        detail: { isVisible: event.target.checked },
      })
    );
  });
  visualRefGroup.appendChild(rayToggleLabel);

  // --- GRUPO DE CONTROLES DE TEMPO E ZOOM ---
  const timeGroup = document.createElement("div");
  timeGroup.className = "control-group";
  timeGroup.innerHTML = `
        <label for="time-slider">Velocidade do Tempo (dias/seg)</label>
        <div class="slider-container">
            <input type="range" id="time-slider" min="0" max="500" value="${config.timeScale}" step="0.5">
            <input type="number" id="time-input" min="0" max="500" value="${config.timeScale}" step="0.5">
        </div>
    `;
  menuContainer.appendChild(timeGroup);
  const timeSlider = timeGroup.querySelector("#time-slider");
  const timeInput = timeGroup.querySelector("#time-input");
  const updateTimeScale = (newScale) => {
    config.timeScale = parseFloat(newScale);
  };
  timeSlider.addEventListener("input", () => {
    const scale = timeSlider.value;
    timeInput.value = scale;
    updateTimeScale(scale);
  });
  timeInput.addEventListener("input", () => {
    let scale = timeInput.value;
    if (scale < 0) scale = 0;
    timeSlider.value = scale;
    updateTimeScale(scale);
  });

  const zoomGroup = document.createElement("div");
  zoomGroup.className = "control-group";
  zoomGroup.innerHTML = `
        <label for="zoom-slider">Zoom Power</label>
        <div class="slider-container">
            <input type="range" id="zoom-slider" min="1" max="100" value="50">
            <input type="number" id="zoom-input" min="1" max="100" value="50">
        </div>
    `;
  menuContainer.appendChild(zoomGroup);
  const zoomSlider = zoomGroup.querySelector("#zoom-slider");
  const zoomInput = zoomGroup.querySelector("#zoom-input");
  const updateZoomSensitivity = (power) => {
    const precision = mapRange(power, 1, 100, 200, 1);
    camera.inputs.attached.mousewheel.wheelPrecision = precision;
  };
  zoomSlider.addEventListener("input", () => {
    const power = zoomSlider.value;
    zoomInput.value = power;
    updateZoomSensitivity(power);
  });
  zoomInput.addEventListener("input", () => {
    let power = parseInt(zoomInput.value, 10) || 1;
    if (power > 100) power = 100;
    if (power < 1) power = 1;
    zoomInput.value = power;
    zoomSlider.value = power;
    updateZoomSensitivity(power);
  });
  updateZoomSensitivity(zoomSlider.value);

  const jumpGroup = document.createElement("div");
  jumpGroup.className = "control-group";
  jumpGroup.innerHTML = `
    <label>Salto no Tempo</label>
    <div class="time-jump-container" style="display: flex; gap: 5px; align-items: center;">
        <input type="number" id="jump-year-input" placeholder="Ano" style="width: 60px;">
        <input type="number" id="jump-day-input" placeholder="Dia" style="width: 50px;">
        <input type="number" id="jump-hour-input" placeholder="Hr" style="width: 40px;">
        <input type="number" id="jump-minute-input" placeholder="Min" style="width: 40px;">
        <button id="jump-to-time-btn" style="flex-grow: 1;">Pular</button>
    </div>
`;
  menuContainer.appendChild(jumpGroup);

  const jumpButton = document.getElementById("jump-to-time-btn");
  jumpButton.addEventListener("click", () => {
    const yearInput = document.getElementById("jump-year-input");
    const dayInput = document.getElementById("jump-day-input");
    const hourInput = document.getElementById("jump-hour-input");
    const minuteInput = document.getElementById("jump-minute-input");

    const year = parseInt(yearInput.value, 10) || 0;
    const day = parseInt(dayInput.value, 10) || 0;
    const hour = parseInt(hourInput.value, 10) || 0;
    const minute = parseInt(minuteInput.value, 10) || 0;

    window.dispatchEvent(
      new CustomEvent("jumpToTime", {
        detail: { year, day, hour, minute },
      })
    );

    yearInput.value = "";
    dayInput.value = "";
    hourInput.value = "";
    minuteInput.value = "";
  });

  const inspectionPanel = document.createElement("div");
  inspectionPanel.id = "inspection-panel";
  inspectionPanel.className = "controls-menu";
  inspectionPanel.style.display = "none";
  inspectionPanel.innerHTML = `
    <h3>Modo Inspeção</h3>
    <p id="inspection-target-name" style="font-weight: bold; margin-bottom: 10px;"></p>
    <div class="control-group">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="light-dark-side-toggle"> Iluminar Lado Escuro
        </label>
    </div>
    <button id="exit-inspect-mode-btn" style="display:none; background-color: #8c2a2a;">Sair da Inspeção</button>
  `;

  document.body.appendChild(inspectionPanel);

  const exitInspectBtn = inspectionPanel.querySelector(
    "#exit-inspect-mode-btn"
  );

  exitInspectBtn.addEventListener("click", () => {
    inspectBtn.style.display = "block";
    exitInspectBtn.style.display = "none";
    window.dispatchEvent(
      new CustomEvent("exitInspectMode", { detail: { scene } })
    );
  });

  const lightToggle = document.getElementById("light-dark-side-toggle");
  lightToggle.addEventListener("change", (event) => {
    window.dispatchEvent(
      new CustomEvent("toggleDarkSideLight", {
        detail: { isEnabled: event.target.checked, scene },
      })
    );
  });
};

export const initializeAnchorControls = (
  calendarAnchorSystem,
  getCurrentYearCallback
) => {
  const menuContainer = document.getElementById("controls-menu");

  const anchorGroup = document.createElement("div");
  anchorGroup.className = "control-group";
  anchorGroup.id = "anchor-management-group";
  anchorGroup.innerHTML = `
    <h3 style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #555;">Gerenciador de Ano</h3>
    <button id="start-define-year-btn">Iniciar Definição de Ano</button>
    <div id="defining-controls" style="display: none;">
      <button id="set-day-zero-btn">Definir Dia 0</button>
      <button id="set-last-day-btn">Definir Último Dia</button>
      <button id="save-year-config-btn" style="background-color: #2a8c4a;">Salvar Configuração do Ano</button>
    </div>
    <div id="saved-years-list-container">
      <label>Anos Salvos</label>
      <ul id="saved-years-list" style="list-style: none; padding: 0; max-height: 150px; overflow-y: auto;"></ul>
    </div>
  `;
  menuContainer.appendChild(anchorGroup);

  document.getElementById("start-define-year-btn").onclick = () => {
    calendarAnchorSystem.startDefinition(getCurrentYearCallback());
  };
  document.getElementById("set-day-zero-btn").onclick = () =>
    calendarAnchorSystem.setDayZero();
  document.getElementById("set-last-day-btn").onclick = () =>
    calendarAnchorSystem.setLastDay();
  document.getElementById("save-year-config-btn").onclick = () =>
    calendarAnchorSystem.saveCurrentAnchor();

  // Chame a atualização da lista inicial.
  updateAnchorList(calendarAnchorSystem.anchors, calendarAnchorSystem);
};

export const updateAnchorControls = (isDefining) => {
  document.getElementById("start-define-year-btn").style.display = isDefining
    ? "none"
    : "block";
  document.getElementById("defining-controls").style.display = isDefining
    ? "block"
    : "none";
};

export const updateAnchorList = (anchors, calendarAnchorSystem) => {
  const list = document.getElementById("saved-years-list");
  list.innerHTML = ""; // Limpa a lista

  const sortedYears = Object.keys(anchors).sort((a, b) => a - b);

  if (sortedYears.length === 0) {
    list.innerHTML = `<li style="font-style: italic; color: #888; padding: 5px;">Nenhuma âncora salva.</li>`;
    return;
  }

  sortedYears.forEach((year) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.padding = "4px";
    li.style.marginBottom = "2px";
    li.style.backgroundColor = "rgba(255, 255, 255, 0.05)";

    const yearLabel = document.createElement("span");
    yearLabel.innerText = `Ano ${year}`;
    li.appendChild(yearLabel);

    const buttonsDiv = document.createElement("div");
    const applyBtn = document.createElement("button");
    applyBtn.innerText = "Aplicar";
    applyBtn.style.width = "auto";
    applyBtn.style.padding = "2px 8px";
    applyBtn.style.fontSize = "12px";
    applyBtn.style.marginBottom = "0";
    applyBtn.style.marginRight = "5px";
    applyBtn.onclick = () => calendarAnchorSystem.applyAnchor(year);
    buttonsDiv.classList.add("anchor-buttons");
    buttonsDiv.appendChild(applyBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "X";
    deleteBtn.style.width = "auto";
    deleteBtn.style.padding = "2px 6px";
    deleteBtn.style.fontSize = "12px";
    deleteBtn.style.marginBottom = "0";
    deleteBtn.style.backgroundColor = "#8c2a2a";
    deleteBtn.onclick = () => calendarAnchorSystem.deleteAnchor(year);
    buttonsDiv.appendChild(deleteBtn);

    li.appendChild(buttonsDiv);
    list.appendChild(li);
  });
};
