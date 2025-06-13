import { simulationConfig } from "./config.js";
import { createPlanetarySystem } from "./sceneBuilder.js";
import {
  initializeUI,
  updateTimeControlsUI,
  updateTimeDisplay,
} from "./uiController.js";
import { calculateEllipticalOrbit } from "./orbitalMechanics.js";

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

let orbitalCamera, povCamera;
let isPovModeActive = false;

// Função enterPovMode revertida para a versão de "órbita baixa"
const enterPovMode = (targetMesh) => {
  if (!orbitalCamera || !povCamera) return;

  const pivot = targetMesh.parent;
  if (!pivot) return;

  // Vincula a câmera ao pivô
  povCamera.parent = pivot;
  // Posiciona a câmera a uma distância de 3x o raio do planeta
  const meshRadius = targetMesh.getBoundingInfo().boundingSphere.radiusWorld;
  povCamera.position = new BABYLON.Vector3(0, 0, -meshRadius * 3);
  povCamera.rotation = BABYLON.Vector3.Zero();

  // Troca as câmeras
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

const createScene = () => {
  const scene = new BABYLON.Scene(engine);

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

  scene.activeCamera = orbitalCamera;

  createPlanetarySystem(scene, simulationConfig);
  initializeUI(scene.activeCamera, scene, simulationConfig);

  return scene;
};

const scene = createScene();
window.scene = scene;

window.addEventListener("activatePovMode", () => {
  isPovModeActive = true;
  console.log("Modo POV armado. Clique em um planeta.");
});

window.addEventListener("exitPovMode", () => {
  exitPovMode();
});

scene.onPointerDown = (evt, pickResult) => {
  if (isPovModeActive && pickResult.hit) {
    const pickedMesh = pickResult.pickedMesh;
    if (pickedMesh.parent && pickedMesh.parent.name.endsWith("-pivot")) {
      // --- CORREÇÃO CRUCIAL ESTÁ AQUI ---
      // Desativa o modo de clique LOGO APÓS o primeiro clique bem-sucedido.
      isPovModeActive = false;

      enterPovMode(pickedMesh, pickResult.pickedPoint);
    }
  }
};

let simulationTime = 0;
let isPaused = false;
let lastTimeScale = simulationConfig.timeScale;

engine.runRenderLoop(() => {
  const deltaTime = engine.getDeltaTime() / 1000;
  simulationTime += deltaTime * simulationConfig.timeScale;

  const binarySystem = simulationConfig.planets.find(
    (p) => p.type === "binaryPair"
  );
  if (binarySystem) {
    const yearLength = binarySystem.orbit.period;
    updateTimeDisplay(simulationTime, yearLength);

    const systemInclination = binarySystem.orbit.inclination || 0;
    const systemInclinationMatrix = BABYLON.Matrix.RotationX(
      BABYLON.Tools.ToRadians(systemInclination)
    );
    const barycenterFlatPos = calculateEllipticalOrbit(
      binarySystem.orbit,
      simulationConfig.scale,
      simulationTime
    );
    const barycenterTiltedPos = BABYLON.Vector3.TransformCoordinates(
      barycenterFlatPos,
      systemInclinationMatrix
    );
    const mutualOrbitPeriod = binarySystem.mutualOrbit.period;
    const mutualAngle = ((2 * Math.PI) / mutualOrbitPeriod) * simulationTime;

    binarySystem.components.forEach((componentData, index) => {
      const planetPivot = scene.getTransformNodeByName(
        `${componentData.name}-pivot`
      );
      if (!planetPivot) return;

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
      const planetFinalPos = barycenterTiltedPos.add(mutualOffsetTilted);
      planetPivot.position = planetFinalPos;

      const rotationSpeed = (2 * Math.PI) / componentData.rotationPeriod;
      const rotationIncrement =
        rotationSpeed * deltaTime * simulationConfig.timeScale;
      const frameRotation = BABYLON.Quaternion.RotationAxis(
        BABYLON.Axis.Y,
        rotationIncrement
      );
      planetPivot.rotationQuaternion.multiplyInPlace(frameRotation);

      if (componentData.moons) {
        componentData.moons.forEach((moonData) => {
          const moonPivot = scene.getTransformNodeByName(
            `${moonData.name}-pivot`
          );
          const planetMesh = scene.getMeshByName(componentData.name);
          const moonMesh = scene.getMeshByName(moonData.name);
          if (!moonPivot || !moonMesh || !planetMesh) return;

          const moonFlatPos = calculateEllipticalOrbit(
            moonData.orbit,
            simulationConfig.scale,
            simulationTime
          );
          const moonInclination = moonData.orbit.inclination || 0;
          const moonInclinationMatrix = BABYLON.Matrix.RotationX(
            BABYLON.Tools.ToRadians(moonInclination)
          );
          let moonTiltedPos = BABYLON.Vector3.TransformCoordinates(
            moonFlatPos,
            moonInclinationMatrix
          );
          moonTiltedPos = BABYLON.Vector3.TransformCoordinates(
            moonTiltedPos,
            systemInclinationMatrix
          );
          const moonFinalPos = planetFinalPos.add(moonTiltedPos);
          moonPivot.position = moonFinalPos;

          moonMesh.lookAt(planetMesh.position);

          const orbitLine = scene.getMeshByName(`${moonData.name}-orbit-line`);
          if (orbitLine) {
            orbitLine.position = planetFinalPos;
          }
        });
      }
    });
  }

  scene.render();
});

window.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "Space":
      event.preventDefault();
      isPaused = !isPaused;
      if (isPaused) {
        if (simulationConfig.timeScale !== 0) {
          lastTimeScale = simulationConfig.timeScale;
        }
        simulationConfig.timeScale = 0;
      } else {
        simulationConfig.timeScale = lastTimeScale;
      }
      updateTimeControlsUI(simulationConfig.timeScale);
      break;
    case "KeyA":
      if (!isPaused) {
        isPaused = true;
        if (simulationConfig.timeScale !== 0) {
          lastTimeScale = simulationConfig.timeScale;
        }
        simulationConfig.timeScale = 0;
        updateTimeControlsUI(0);
      }
      simulationTime -= 1;
      break;
    case "KeyD":
      if (!isPaused) {
        isPaused = true;
        if (simulationConfig.timeScale !== 0) {
          lastTimeScale = simulationConfig.timeScale;
        }
        simulationConfig.timeScale = 0;
        updateTimeControlsUI(0);
      }
      simulationTime += 1;
      break;
  }
});

window.addEventListener("resize", () => {
  engine.resize();
});
