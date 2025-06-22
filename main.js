import { simulationConfig, nebulaConfig } from "./config.js";
import { createPlanetarySystem } from "./sceneBuilder.js";
import {
  initializeUI,
  updateTimeControlsUI,
  updateTimeDisplay,
} from "./uiController.js";
import { calculateEllipticalOrbit } from "./orbitalMechanics.js";
import {
  initializeEclipseMaterials,
  projectShadow,
} from "./shadowProjector.js";

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let orbitalCamera, povCamera, inspectionCamera;
let isPovModeActive = false;
let isNarymInNebula = false;
let displayRays = false;
let isInInspectMode = false;
let inspectedTarget = null;
let isPaused = false;
let lastTimeScale = simulationConfig.timeScale;
let simulationTime = 0;

const NARIM_HOURS_IN_DAY = 30.0;
const OCCLUDING_BODIES = ["Narym", "Vezmar", "Tharela", "Ciren"];

// =======================================================
// FUNÇÕES DE CONTROLE DE ESTADO (POV, Inspeção)
// =======================================================
const enterPovMode = (targetMesh) => {
  if (!orbitalCamera || !povCamera) return;

  const pivot = targetMesh.parent;
  if (!pivot) return;

  povCamera.parent = pivot;
  const meshRadius = targetMesh.getBoundingInfo().boundingSphere.radiusWorld;
  povCamera.position = new BABYLON.Vector3(0, 0, -meshRadius * 3);
  povCamera.rotation = BABYLON.Vector3.Zero();

  orbitalCamera.detachControl();
  povCamera.setEnabled(true);
  scene.activeCamera = povCamera;
  scene.activeCamera.attachControl(canvas, true);
};

const exitPovMode = () => {
  if (!orbitalCamera || !povCamera) return;
  isPovModeActive = false;

  povCamera.parent = null;
  povCamera.detachControl();
  povCamera.setEnabled(false);

  scene.activeCamera = orbitalCamera;
  scene.activeCamera.attachControl(canvas, true);
};

const enterInspectMode = () => {
  const targetMesh = orbitalCamera.lockedTarget;

  if (!targetMesh || isInInspectMode) {
    console.warn("Modo Inspeção: Nenhum alvo selecionado.");
    return;
  }

  isInInspectMode = true;
  inspectedTarget = targetMesh;

  if (!isPaused) {
    lastTimeScale = simulationConfig.timeScale;
    simulationConfig.timeScale = 0;
    isPaused = true;
    updateTimeControlsUI(0);
  }

  const meshRadius = targetMesh.getBoundingInfo().boundingSphere.radiusWorld;
  inspectionCamera.target = targetMesh.getAbsolutePosition();
  inspectionCamera.radius = meshRadius * 3;
  inspectionCamera.lowerRadiusLimit = meshRadius * 0.8;
  inspectionCamera.upperRadiusLimit = meshRadius * 1.5;

  scene.activeCamera.detachControl();
  scene.activeCamera = inspectionCamera;
  inspectionCamera.setEnabled(true);
  scene.activeCamera.attachControl(canvas, true);

  document.getElementById("controls-menu").style.display = "none";
  const inspectionPanel = document.getElementById("inspection-panel");
  inspectionPanel.style.display = "block";

  document.getElementById("inspection-target-name").innerText = targetMesh.name;
};

const exitInspectMode = (detail) => {
  if (!isInInspectMode) return;

  toggleDarkSideLight(detail);
  document.getElementById("light-dark-side-toggle").checked = false;

  isInInspectMode = false;
  inspectedTarget = null;

  simulationConfig.timeScale = lastTimeScale;
  isPaused = false;
  updateTimeControlsUI(simulationConfig.timeScale);

  scene.activeCamera.detachControl();
  scene.activeCamera = orbitalCamera;
  orbitalCamera.setEnabled(true);
  scene.activeCamera.attachControl(canvas, true);

  document.getElementById("inspection-panel").style.display = "none";
  document.getElementById("controls-menu").style.display = "block";
};

const toggleDarkSideLight = ({ isEnabled, scene }) => {
  const hemiLight = scene.getLightByName("hemi");

  if (isNarymInNebula && isEnabled) {
    hemiLight.intensity = 1;
  } else if (!isNarymInNebula && isEnabled) {
    hemiLight.intensity = 0.8;
  } else {
    hemiLight.intensity = 0;
  }
};

// =======================================================
// FUNÇÕES DE ATUALIZAÇÃO E CÁLCULO
// =======================================================
const updateNebulaDecay = (pivot) => {
  const mesh = pivot.getChildren()[0];
  const bodyData = pivot.metadata;
  const centralRay = pivot.metadata.forwardRay;

  if (
    !mesh ||
    !mesh.material ||
    !isNarymInNebula ||
    !bodyData.deepNebula ||
    !centralRay
  ) {
    mesh.material.diffuseColor.set(1, 1, 1);
    return;
  }

  const maxDistance = bodyData.deepNebula;
  const nebulaPredicate = (mesh) => mesh.name === "nebula-mesh";
  const hitInfo = scene.pickWithRay(centralRay, nebulaPredicate);

  if (hitInfo.hit) {
    const distance = hitInfo.distance;
    const ratio = Math.min(distance / maxDistance, 1.0);
    const diffuseValue = 1.0 - ratio * 0.9;

    mesh.material.diffuseColor.set(diffuseValue, diffuseValue, diffuseValue);
  } else {
    mesh.material.diffuseColor.set(1, 1, 1);
  }
};

const applyRays = (pivot, simulationConfig) => {
  if (pivot.metadata.forwardRay) {
    const starPosition = BABYLON.Vector3.Zero();
    const worldCenter = pivot.getAbsolutePosition();

    const rayOrigin = worldCenter;
    const rayDirection = starPosition.subtract(rayOrigin).normalize();
    const forwardRay = pivot.metadata.forwardRay;
    forwardRay.origin = rayOrigin;
    forwardRay.direction = rayDirection;
    forwardRay.length = 2000;

    projectShadow(pivot, scene, simulationConfig);
  }

  if (pivot.metadata.raysHelper && displayRays) {
    pivot.metadata.raysHelper.forEach((rayHelper) => {
      if (rayHelper) {
        rayHelper.show(scene);
      }
    });
  } else {
    pivot.metadata.raysHelper.forEach((rayHelper) => {
      if (rayHelper) {
        rayHelper.hide(scene);
      }
    });
  }
};

const updateSystemState = (time) => {
  const binarySystem = simulationConfig.planets.find(
    (p) => p.type === "binaryPair"
  );
  if (!binarySystem) return;

  // --- POSIÇÃO E LÓGICA DO SISTEMA ---
  const systemInclination = binarySystem.orbit.inclination || 0;
  const systemInclinationMatrix = BABYLON.Matrix.RotationX(
    BABYLON.Tools.ToRadians(systemInclination)
  );
  const barycenterFlatPos = calculateEllipticalOrbit(
    binarySystem.orbit,
    simulationConfig.scale,
    time
  );
  const barycenterTiltedPos = BABYLON.Vector3.TransformCoordinates(
    barycenterFlatPos,
    systemInclinationMatrix
  );
  const mutualOrbitPeriod = binarySystem.mutualOrbit.period;
  const mutualAngle = ((2 * Math.PI) / mutualOrbitPeriod) * time;

  // --- ATUALIZAÇÃO DOS COMPONENTES (Planetas e Luas) ---
  binarySystem.components.forEach((componentData, index) => {
    const planetPivot = scene.getTransformNodeByName(
      `${componentData.name}-pivot`
    );
    if (!planetPivot) return;

    // Posição Orbital
    const orbitRadius = componentData.orbitRadius * simulationConfig.scale;
    const angleOffset = index === 0 ? 0 : Math.PI;
    const mutualOffsetFlat = new BABYLON.Vector3(
      orbitRadius * Math.cos(mutualAngle + angleOffset),
      0,
      orbitRadius * Math.sin(mutualAngle + angleOffset)
    );
    const mutualOffsetTilted = BABYLON.Vector3.TransformCoordinates(
      mutualOffsetFlat,
      systemInclinationMatrix
    );
    planetPivot.position = barycenterTiltedPos.add(mutualOffsetTilted);

    const componentOrbitLine = scene.getMeshByName(
      `${componentData.name}-orbit-line`
    );
    if (componentOrbitLine) componentOrbitLine.position = barycenterTiltedPos;

    // ROTAÇÃO E PRECESSÃO (LÓGICA ABSOLUTA)
    const rotationSpeed = (2 * Math.PI) / componentData.rotationPeriod;
    const totalRotationAngle = rotationSpeed * time;
    const dailySpinQuat = BABYLON.Quaternion.RotationAxis(
      BABYLON.Axis.Y,
      totalRotationAngle
    );

    let finalCombinedRotation;
    const baseTiltQuat = planetPivot.metadata.baseTiltQuaternion;
    if (componentData.precessionPeriod && baseTiltQuat) {
      const yearLength = binarySystem.orbit.period;
      const precessionPeriodInDays =
        componentData.precessionPeriod * yearLength;
      const precessionSpeed = (2 * Math.PI) / precessionPeriodInDays;
      const totalPrecessionAngle = precessionSpeed * time;
      const precessionQuat = BABYLON.Quaternion.RotationAxis(
        BABYLON.Axis.Y,
        totalPrecessionAngle
      );
      const tiltedAndPrecessedQuat = precessionQuat.multiply(baseTiltQuat);
      finalCombinedRotation = tiltedAndPrecessedQuat.multiply(dailySpinQuat);
    } else if (baseTiltQuat) {
      finalCombinedRotation = baseTiltQuat.multiply(dailySpinQuat);
    } else {
      finalCombinedRotation = dailySpinQuat;
    }
    planetPivot.rotationQuaternion = finalCombinedRotation;

    // ATUALIZAÇÃO DE EFEITOS (para este planeta)
    applyRays(planetPivot, simulationConfig);
    updateNebulaDecay(planetPivot);

    // ATUALIZAÇÃO DAS LUAS
    if (componentData.moons) {
      componentData.moons.forEach((moonData) => {
        const moonPivot = scene.getTransformNodeByName(
          `${moonData.name}-pivot`
        );
        if (!moonPivot) return;

        const moonFlatPos = calculateEllipticalOrbit(
          moonData.orbit,
          simulationConfig.scale,
          time
        );
        const moonInclinationMatrix = BABYLON.Matrix.RotationX(
          BABYLON.Tools.ToRadians(moonData.orbit.inclination || 0)
        );
        const moonOffsetTilted = BABYLON.Vector3.TransformCoordinates(
          moonFlatPos,
          moonInclinationMatrix
        );
        moonPivot.position = planetPivot
          .getAbsolutePosition()
          .add(moonOffsetTilted);

        const orbitalAngle = ((2 * Math.PI) / moonData.orbit.period) * time;
        moonPivot.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
          BABYLON.Axis.Y,
          -orbitalAngle
        );

        const orbitLine = scene.getMeshByName(`${moonData.name}-orbit-line`);
        if (orbitLine) orbitLine.position = planetPivot.getAbsolutePosition();

        applyRays(moonPivot, simulationConfig);
        updateNebulaDecay(moonPivot);
      });
    }
  });

  // --- LÓGICA DE EFEITOS GLOBAIS ---
  if (nebulaConfig.enabled) {
    const narymPivot = scene.getTransformNodeByName("Narym-pivot");
    const nebulaMesh = scene.getMeshByName("nebula-mesh");
    if (narymPivot && nebulaMesh) {
      const narymPosition = narymPivot.getAbsolutePosition();
      const currentlyInside = nebulaMesh.intersectsPoint(narymPosition);
      if (currentlyInside && !isNarymInNebula) {
        isNarymInNebula = true;
        scene.fogColor = BABYLON.Color3.FromHexString(nebulaConfig.fog.color);
        scene.fogDensity = nebulaConfig.fog.density;
        console.log("Narym ENTROU no Véu de Numitri.");
      } else if (!currentlyInside && isNarymInNebula) {
        isNarymInNebula = false;
        console.log("Narym SAIU do Véu de Numitri.");
      }
    }
  }
};

const handleJumpToTime = ({ year, day, hour, minute }) => {
  console.log(
    `Recebido pedido de salto para Ano: ${year}, Dia: ${day}, Hora: ${hour}, Minuto: ${minute}`
  );

  const binarySystem = simulationConfig.planets.find(
    (p) => p.type === "binaryPair"
  );
  if (!binarySystem) return;

  const yearLengthInDays = binarySystem.orbit.period;

  const timeFromYears = year * yearLengthInDays;
  const timeFromDays = day;
  const timeFromHours = hour / NARIM_HOURS_IN_DAY;
  const timeFromMinutes = minute / (NARIM_HOURS_IN_DAY * 60);

  const newSimulationTime =
    timeFromYears + timeFromDays + timeFromHours + timeFromMinutes;

  simulationTime = newSimulationTime < 0 ? 0 : newSimulationTime;

  updateSystemState(simulationTime);
  updateTimeDisplay(simulationTime, yearLengthInDays);
};

// =======================================================
// INICIALIZAÇÃO DA CENA E LOOPS
// =======================================================
const createScene = () => {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

  const skyboxTexture = BABYLON.CubeTexture.CreateFromImages(
    [
      "./skybox/numitri_right1.png",
      "./skybox/numitri_left2.png",
      "./skybox/numitri_top3.png",
      "./skybox/numitri_bottom4.png",
      "./skybox/numitri_front5.png",
      "./skybox/numitri_back6.png",
    ],
    scene
  );

  const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.reflectionTexture = skyboxTexture;
  skyboxMaterial.reflectionTexture.coordinatesMode =
    BABYLON.Texture.SKYBOX_MODE;
  skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

  const skybox = BABYLON.MeshBuilder.CreateBox(
    "skybox",
    { size: 9000.0 },
    scene
  );
  skybox.material = skyboxMaterial;
  skybox.infiniteDistance = true;

  const glowLayer = new BABYLON.GlowLayer("glow", scene, {
    mainTextureRatio: 0.5,
  });
  glowLayer.intensity = 5;

  orbitalCamera = new BABYLON.ArcRotateCamera(
    "orbitalCamera",
    -Math.PI / 2,
    Math.PI / 2.5,
    150,
    BABYLON.Vector3.Zero(),
    scene
  );
  orbitalCamera.attachControl(canvas, true);
  orbitalCamera.minZ = 0.1;
  orbitalCamera.maxZ = 10000;

  povCamera = new BABYLON.UniversalCamera(
    "povCamera",
    new BABYLON.Vector3(0, 0, 0),
    scene
  );
  povCamera.minZ = 0.1;
  povCamera.maxZ = 10000;
  povCamera.setEnabled(false);
  povCamera.fov = orbitalCamera.fov;

  inspectionCamera = new BABYLON.ArcRotateCamera(
    "inspectionCamera",
    -Math.PI / 2,
    Math.PI / 2.5,
    1,
    BABYLON.Vector3.Zero(),
    scene
  );

  inspectionCamera.minZ = 0.001;
  inspectionCamera.maxZ = 10;
  inspectionCamera.setEnabled(false);

  const hemiLight = new BABYLON.HemisphericLight(
    "hemi",
    new BABYLON.Vector3(0, 0, 0),
    scene
  );
  hemiLight.intensity = 0;
  hemiLight.diffuse = new BABYLON.Color3(1, 1, 1);

  scene.activeCamera = orbitalCamera;

  createPlanetarySystem(scene, simulationConfig);
  initializeUI(scene.activeCamera, scene, simulationConfig);
  initializeEclipseMaterials(scene);

  return scene;
};

const scene = createScene();
window.scene = scene;

engine.runRenderLoop(() => {
  if (isInInspectMode) {
    scene.render();
    return;
  }

  if (!isPaused) {
    const deltaTime = engine.getDeltaTime() / 1000;
    simulationTime += deltaTime * simulationConfig.timeScale;
  }

  updateSystemState(simulationTime);

  const binarySystem = simulationConfig.planets.find(
    (p) => p.type === "binaryPair"
  );
  if (binarySystem)
    updateTimeDisplay(simulationTime, binarySystem.orbit.period);

  scene.render();
});

// =======================================================
// EVENT LISTENERS
// =======================================================
scene.onPointerDown = (evt, pickResult) => {
  if (isPovModeActive && pickResult.hit) {
    const pickedMesh = pickResult.pickedMesh;
    if (pickedMesh.parent && pickedMesh.parent.name.endsWith("-pivot")) {
      isPovModeActive = false;
      enterPovMode(pickedMesh, pickResult.pickedPoint);
    }
  }
};

window.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "Space":
      event.preventDefault();
      isPaused = !isPaused;
      if (isPaused) {
        if (simulationConfig.timeScale !== 0)
          lastTimeScale = simulationConfig.timeScale;
        simulationConfig.timeScale = 0;
      } else {
        simulationConfig.timeScale = lastTimeScale;
      }
      updateTimeControlsUI(simulationConfig.timeScale);
      break;

    case "KeyA":
    case "KeyD":
      if (!isPaused) {
        isPaused = true;
        if (simulationConfig.timeScale !== 0)
          lastTimeScale = simulationConfig.timeScale;
        simulationConfig.timeScale = 0;
        updateTimeControlsUI(0);
      }

      simulationTime += event.code === "KeyD" ? 1 : -1;
      updateSystemState(simulationTime);
      break;
  }
});

window.addEventListener("resize", () => {
  engine.resize();
});

window.addEventListener("activatePovMode", () => {
  isPovModeActive = true;
  console.log("Modo POV armado. Clique em um planeta.");
});

window.addEventListener("exitPovMode", () => {
  exitPovMode();
});

window.addEventListener("toggleRayDebug", (event) => {
  displayRays = event.detail.isVisible;
});

window.addEventListener("enterInspectMode", enterInspectMode);
window.addEventListener("exitInspectMode", (event) => {
  exitInspectMode(event.detail);
});
window.addEventListener("toggleDarkSideLight", (event) =>
  toggleDarkSideLight(event.detail)
);

window.addEventListener("jumpToTime", (event) =>
  handleJumpToTime(event.detail)
);
