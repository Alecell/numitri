/**
 * Controlador da UI
 * Gerencia todos os elementos de interface, como menus e sliders.
 */

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

export const updateTimeDisplay = (simulationTime, yearLengthInDays) => {
  const daysDisplay = document.getElementById("days-display");
  const yearsDisplay = document.getElementById("years-display");

  if (daysDisplay && yearsDisplay) {
    const years = simulationTime / yearLengthInDays;
    daysDisplay.innerText = simulationTime.toFixed(2);
    yearsDisplay.innerText = years.toFixed(2);
  }
};

export const initializeUI = (camera, scene, config) => {
  const menuContainer = document.getElementById("controls-menu");
  if (!menuContainer) return;
  menuContainer.innerHTML = "<h3>Controles</h3>";

  const timeDisplayGroup = document.createElement("div");
  timeDisplayGroup.className = "time-display";
  timeDisplayGroup.innerHTML = `
        <p>Anos: <span id="years-display">0.00</span></p>
        <p>Dias: <span id="days-display">0.00</span></p>
    `;
  menuContainer.appendChild(timeDisplayGroup);

  const createBodyControls = (bodyData) => {
    if (!bodyData.visual) return; // Só cria controles para corpos visuais
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
};
