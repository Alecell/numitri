import { simulationConfig, nebulaConfig } from "./config.js";
import { createPlanetarySystem, updateOrbitLine } from "./sceneBuilder.js";
import {
  initializeUI,
  updateTimeControlsUI,
  updateTimeDisplay,
} from "./uiController.js";
import {
  calculateEllipticalOrbit,
  getCyclicValue,
  getOrbitPathPoints,
  calculateOrbitTangent,
  findConjunctionTime,
} from "./orbitalMechanics.js";
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
let isPaused = false;
let lastTimeScale = simulationConfig.timeScale;
let simulationTime = 0;
let timeJustJumped = true;
let lastCalculatedEclipseYear = -1;
let cachedEclipseTime = 0;
let vezmarEclipseActive = false;
let wasNarymInNebula = false;
let lastLoggedNebulaRecalcYear = -1;

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
  const meshes = pivot.getChildMeshes(false);
  const mesh = meshes[0];

  const bodyData = pivot.metadata;
  const centralRay = pivot.metadata.forwardRay;

  if (!mesh || !mesh.material) {
    return;
  }

  if (!isNarymInNebula || !bodyData.deepNebula || !centralRay) {
    mesh.material.diffuseColor.set(1, 1, 1);
    return;
  }

  const maxDistance = bodyData.deepNebula;
  const nebulaPredicate = (m) => m.name === "nebula-mesh";
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

const isNarymInsideNebula = (narymPivot, nebulaPivot, scene) => {
  if (!narymPivot || !nebulaPivot) return false;

  const collisionTube = scene.getMeshByName("nebula-mesh");
  const narymMesh = scene.getMeshByName("Narym");

  if (!collisionTube || !narymMesh) {
    return false;
  }

  const isIntersecting = collisionTube.intersectsMesh(narymMesh, true); // Usar precise check

  // Log apenas quando a intersecção for detectada
  if (isIntersecting) {
    const narymPos = narymMesh.getAbsolutePosition();
    const nebulaPos = collisionTube.getAbsolutePosition();
    const distance = BABYLON.Vector3.Distance(narymPos, nebulaPos);
  }

  return isIntersecting;
};

const updateSystemState = (time) => {
  const binarySystem = simulationConfig.planets.find(
    (p) => p.type === "binaryPair"
  );
  if (!binarySystem) return;

  const yearLength = binarySystem.orbit.period;
  const currentYear = Math.floor(simulationTime / yearLength);

  // --- LÓGICA DO SISTEMA BINÁRIO (sem alterações) ---
  let currentEccentricity = binarySystem.orbit.eccentricity;
  let currentInclination = binarySystem.orbit.inclination;
  let currentApsidalAngle = 0;
  let currentNodalAngle = 0;

  if (binarySystem?.longTermCycles?.eccentricityVariation) {
    currentEccentricity = getCyclicValue(
      binarySystem.longTermCycles.eccentricityVariation,
      time,
      yearLength
    );
  }
  if (binarySystem?.longTermCycles?.inclinationVariation) {
    currentInclination = getCyclicValue(
      binarySystem.longTermCycles.inclinationVariation,
      time,
      yearLength
    );
  }
  if (binarySystem?.longTermCycles?.apsidalPrecession) {
    const cycle = binarySystem.longTermCycles.apsidalPrecession;
    const periodInDays = cycle.period * yearLength;
    if (periodInDays > 0) {
      currentApsidalAngle = (time / periodInDays) * (2 * Math.PI);
    }
  }
  if (binarySystem.orbit.nodalPrecessionPeriod) {
    const periodInDays = binarySystem.orbit.nodalPrecessionPeriod * yearLength;
    if (periodInDays > 0) {
      currentNodalAngle = (time / periodInDays) * (2 * Math.PI);
    }
  }

  const currentOrbitData = {
    ...binarySystem.orbit,
    eccentricity: currentEccentricity,
    inclination: currentInclination,
    precessionAngle: currentApsidalAngle,
    nodalPrecessionAngle: currentNodalAngle,
  };

  const line = scene.getMeshByName(`${binarySystem.name}-orbit-line`);
  if (line) {
    updateOrbitLine(line.name, currentOrbitData, scene);
  }

  const inclinationMatrix = BABYLON.Matrix.RotationX(
    BABYLON.Tools.ToRadians(currentOrbitData.inclination)
  );
  const nodalMatrix = BABYLON.Matrix.RotationY(currentNodalAngle);
  const combinedSystemMatrix = inclinationMatrix.multiply(nodalMatrix);

  const systemInclinationQuaternion =
    BABYLON.Quaternion.FromRotationMatrix(combinedSystemMatrix);

  // REPOSICIONA A NEBULOSA
  if (nebulaConfig.enabled) {
    const nebulaPivot = scene.getTransformNodeByName("Nebula-System-Pivot");
    if (nebulaPivot) {
      if (currentYear !== lastCalculatedEclipseYear) {
        cachedEclipseTime = findConjunctionTime(
          currentYear,
          binarySystem,
          simulationConfig.scale
        );
        lastCalculatedEclipseYear = currentYear;
      }

      const tempoDeReferencia = cachedEclipseTime;

      let refEccentricity = getCyclicValue(
        binarySystem.longTermCycles.eccentricityVariation,
        tempoDeReferencia,
        yearLength
      );
      let refInclination = getCyclicValue(
        binarySystem.longTermCycles.inclinationVariation,
        tempoDeReferencia,
        yearLength
      );
      let refApsidalAngle =
        (tempoDeReferencia /
          (binarySystem.longTermCycles.apsidalPrecession.period * yearLength)) *
        (2 * Math.PI);
      let refNodalAngle =
        (tempoDeReferencia /
          (binarySystem.orbit.nodalPrecessionPeriod * yearLength)) *
        (2 * Math.PI);

      const refOrbitData = {
        ...binarySystem.orbit,
        eccentricity: refEccentricity,
        inclination: refInclination,
      };
      const refInclinationMatrix = BABYLON.Matrix.RotationX(
        BABYLON.Tools.ToRadians(refOrbitData.inclination)
      );
      const refNodalMatrix = BABYLON.Matrix.RotationY(refNodalAngle);
      const refCombinedSystemMatrix =
        refInclinationMatrix.multiply(refNodalMatrix);

      const barycenterFlatPos_Ref = calculateEllipticalOrbit(
        refOrbitData,
        simulationConfig.scale,
        tempoDeReferencia,
        refApsidalAngle
      );
      const tangentFlat_Ref = calculateOrbitTangent(
        refOrbitData,
        simulationConfig.scale,
        tempoDeReferencia,
        refApsidalAngle
      );

      const barycenterTiltedPos_Ref = BABYLON.Vector3.TransformCoordinates(
        barycenterFlatPos_Ref,
        refCombinedSystemMatrix
      );
      const tangentTilted_Ref = BABYLON.Vector3.TransformNormal(
        tangentFlat_Ref,
        refCombinedSystemMatrix
      ).normalize();

      const orbitalUp_Ref = BABYLON.Vector3.TransformNormal(
        BABYLON.Axis.Y,
        refCombinedSystemMatrix
      ).normalize();
      const offsetNormal = BABYLON.Vector3.Cross(
        tangentTilted_Ref,
        orbitalUp_Ref
      ).normalize();

      const offsetDistance =
        nebulaConfig.offsetDistance * simulationConfig.scale;
      nebulaPivot.position = barycenterTiltedPos_Ref.add(
        offsetNormal.scale(offsetDistance)
      );

      if (!nebulaPivot.rotationQuaternion) {
        nebulaPivot.rotationQuaternion = new BABYLON.Quaternion();
      }
      BABYLON.Quaternion.FromLookDirectionLHToRef(
        tangentTilted_Ref,
        orbitalUp_Ref,
        nebulaPivot.rotationQuaternion
      );
    }
  }

  const barycenterFlatPos = calculateEllipticalOrbit(
    currentOrbitData,
    simulationConfig.scale,
    simulationTime,
    currentApsidalAngle
  );
  const barycenterTiltedPos = BABYLON.Vector3.TransformCoordinates(
    barycenterFlatPos,
    combinedSystemMatrix
  );

  const barycenterOrbitLine = scene.getMeshByName(
    `${binarySystem.name}-orbit-line`
  );
  if (barycenterOrbitLine) {
    barycenterOrbitLine.position = BABYLON.Vector3.Zero();
  }

  const mutualOrbitPeriod = binarySystem.mutualOrbit.period;
  const mutualAngle = ((2 * Math.PI) / mutualOrbitPeriod) * simulationTime;

  binarySystem.components.forEach((componentData, index) => {
    const planetPivot = scene.getTransformNodeByName(
      `${componentData.name}-pivot`
    );
    if (!planetPivot) return;

    // POSICIONAMENTO E ROTAÇÃO DO PLANETA (sem alterações)
    const orbitRadius = componentData.orbitRadius * simulationConfig.scale;
    const angleOffset = index === 0 ? 0 : Math.PI;
    const mutualOffsetFlat = new BABYLON.Vector3(
      orbitRadius * Math.cos(mutualAngle + angleOffset),
      0,
      orbitRadius * Math.sin(mutualAngle + angleOffset)
    );
    const mutualOffsetTilted = BABYLON.Vector3.TransformCoordinates(
      mutualOffsetFlat,
      combinedSystemMatrix
    );
    planetPivot.position = barycenterTiltedPos.add(mutualOffsetTilted);

    const componentOrbitLine = scene.getMeshByName(
      `${componentData.name}-orbit-line`
    );
    if (componentOrbitLine) {
      componentOrbitLine.position = barycenterTiltedPos;
      componentOrbitLine.rotationQuaternion = systemInclinationQuaternion;
    }

    const bodyRotationPivot =
      planetPivot.metadata.bodyRotationPivot || planetPivot;
    const rotationSpeed = (2 * Math.PI) / componentData.rotationPeriod;
    const totalRotationAngle = rotationSpeed * time;
    const dailySpinQuat = BABYLON.Quaternion.RotationAxis(
      BABYLON.Axis.Y,
      totalRotationAngle
    );
    let currentTiltQuat = planetPivot.metadata.baseTiltQuaternion;
    if (componentData.longTermCycles?.obliquityVariation) {
      const obliquityCycle = componentData.longTermCycles.obliquityVariation;
      const currentObliquity = getCyclicValue(obliquityCycle, time, yearLength);
      currentTiltQuat = BABYLON.Quaternion.RotationAxis(
        new BABYLON.Vector3(0, 0, 1),
        BABYLON.Tools.ToRadians(currentObliquity)
      );
    }
    let finalCombinedRotation;
    if (componentData.precessionPeriod && currentTiltQuat) {
      const precessionPeriodInDays =
        componentData.precessionPeriod * yearLength;
      const precessionSpeed = (2 * Math.PI) / precessionPeriodInDays;
      const totalPrecessionAngle = precessionSpeed * time;
      const precessionQuat = BABYLON.Quaternion.RotationAxis(
        BABYLON.Axis.Y,
        totalPrecessionAngle
      );
      const tiltedAndPrecessedQuat = precessionQuat.multiply(currentTiltQuat);
      finalCombinedRotation = tiltedAndPrecessedQuat.multiply(dailySpinQuat);
    } else if (currentTiltQuat) {
      finalCombinedRotation = currentTiltQuat.multiply(dailySpinQuat);
    } else {
      finalCombinedRotation = dailySpinQuat;
    }
    bodyRotationPivot.rotationQuaternion = finalCombinedRotation;

    applyRays(planetPivot, simulationConfig);
    updateNebulaDecay(planetPivot);

    if (componentData.moons) {
      componentData.moons.forEach((moonData) => {
        const moonPivot = scene.getTransformNodeByName(
          `${moonData.name}-pivot`
        );
        if (!moonPivot) return;

        // --- 1. CALCULAR PARÂMETROS ORBITAIS DINÂMICOS DA LUA ---
        let currentMoonEccentricity = moonData.orbit.eccentricity;
        if (moonData.longTermCycles?.eccentricityVariation) {
          currentMoonEccentricity = getCyclicValue(
            moonData.longTermCycles.eccentricityVariation,
            time,
            yearLength
          );
        }
        let currentMoonInclination = moonData.orbit.inclination;
        if (moonData.longTermCycles?.inclinationVariation) {
          currentMoonInclination = getCyclicValue(
            moonData.longTermCycles.inclinationVariation,
            time,
            yearLength
          );
        }
        let currentMoonApsidalAngle = 0;
        if (moonData.longTermCycles?.apsidalPrecession) {
          const cycle = moonData.longTermCycles.apsidalPrecession;
          const periodInDays = cycle.period * yearLength;
          if (periodInDays > 0) {
            currentMoonApsidalAngle = (time / periodInDays) * (2 * Math.PI);
          }
        }
        let moonNodalAngle = 0;
        if (moonData.orbit.nodalPrecessionPeriod > 0) {
          const periodInDays =
            moonData.orbit.nodalPrecessionPeriod * yearLength;
          moonNodalAngle = (time / periodInDays) * (2 * Math.PI);
        }

        const currentMoonOrbitData = {
          ...moonData.orbit,
          eccentricity: currentMoonEccentricity,
        };

        // --- 2. CÁLCULO DA POSIÇÃO E ORIENTAÇÃO ---
        const moonFlatPos = calculateEllipticalOrbit(
          currentMoonOrbitData,
          simulationConfig.scale,
          time,
          0 // PrecessionAngle = 0 para obter a forma base
        );

        const apsidalQuat = BABYLON.Quaternion.RotationAxis(
          BABYLON.Axis.Y,
          currentMoonApsidalAngle
        );
        const inclinationQuat = BABYLON.Quaternion.RotationAxis(
          BABYLON.Axis.X,
          BABYLON.Tools.ToRadians(currentMoonInclination)
        );
        const nodalQuat = BABYLON.Quaternion.RotationAxis(
          BABYLON.Axis.Y,
          moonNodalAngle
        );
        const finalMoonOrientationQuat = nodalQuat.multiply(
          inclinationQuat.multiply(apsidalQuat)
        );

        const moonOrientationMatrix = new BABYLON.Matrix();
        finalMoonOrientationQuat.toRotationMatrix(moonOrientationMatrix);

        const finalMoonPosition = BABYLON.Vector3.TransformCoordinates(
          moonFlatPos,
          moonOrientationMatrix
        );

        moonPivot.position = finalMoonPosition;
        const moonMesh = moonPivot.getChildren()[0];
        if (moonMesh) {
          if (!moonMesh.rotationQuaternion) {
            moonMesh.rotationQuaternion = new BABYLON.Quaternion();
          }

          if (moonData.rotationPeriod === moonData.orbit.period) {
            const toPlanet = moonPivot.position.scale(-1).normalize();

            if (toPlanet.lengthSquared() > 0) {
              const correctUp = BABYLON.Vector3.TransformCoordinates(
                BABYLON.Axis.Y,
                moonOrientationMatrix
              );

              const tidalLockQuat = BABYLON.Quaternion.FromLookDirectionLH(
                toPlanet,
                correctUp
              );
              moonMesh.rotationQuaternion.copyFrom(tidalLockQuat);
            }
          } else {
            const moonRotationSpeed = (2 * Math.PI) / moonData.rotationPeriod;
            BABYLON.Quaternion.RotationAxisToRef(
              BABYLON.Axis.Y,
              moonRotationSpeed * time,
              moonMesh.rotationQuaternion
            );
          }
        }

        // 4. ATUALIZAR A LINHA ORBITAL (MÉTODO ANTERIOR, QUE JÁ ESTAVA CORRETO)
        const orbitLine = scene.getMeshByName(`${moonData.name}-orbit-line`);
        if (orbitLine) {
          const pureShapePoints = getOrbitPathPoints(
            { ...moonData.orbit, eccentricity: currentMoonEccentricity },
            simulationConfig.scale
          );
          BABYLON.MeshBuilder.CreateLines(orbitLine.name, {
            points: pureShapePoints,
            instance: orbitLine,
          });
          orbitLine.position = BABYLON.Vector3.Zero();
          orbitLine.rotationQuaternion = finalMoonOrientationQuat;
        }

        applyRays(moonPivot, simulationConfig);
        updateNebulaDecay(moonPivot);
      });
    }
  });

  // --- LÓGICA DE LOG DE VALIDAÇÃO (2) ---
  const vezmarPivot = scene.getTransformNodeByName("Vezmar-pivot");
  // O flag 'isEclipsingNarym' será setado em projectShadow
  const isEclipseNow = vezmarPivot?.metadata?.isEclipsingNarym ?? false;

  if (isEclipseNow && !vezmarEclipseActive) {
    vezmarEclipseActive = true;
    const narymPivot = scene.getTransformNodeByName("Narym-pivot");
    const nebulaPivot = scene.getTransformNodeByName("Nebula-System-Pivot");
    const star = scene.getMeshByName("Anavon");

    const distToNebulaCenter = BABYLON.Vector3.Distance(
      narymPivot.getAbsolutePosition(),
      nebulaPivot.getAbsolutePosition()
    );
    const distToStar = BABYLON.Vector3.Distance(
      narymPivot.getAbsolutePosition(),
      star.getAbsolutePosition()
    );
  } else if (!isEclipseNow && vezmarEclipseActive) {
    vezmarEclipseActive = false;
  }

  // --- LÓGICA DE LOG DE VALIDAÇÃO (3) ---
  if (nebulaConfig.enabled) {
    const narymPivot = scene.getTransformNodeByName("Narym-pivot");
    const nebulaPivot = scene.getTransformNodeByName("Nebula-System-Pivot");

    if (narymPivot && nebulaPivot) {
      const currentlyInside = isNarymInsideNebula(
        narymPivot,
        nebulaPivot,
        scene
      );

      if (currentlyInside && !wasNarymInNebula) {
        const dayOfYear = Math.floor(simulationTime % yearLength);
        console.log(
          `TRAJETO: Narym ENTROU na nebulosa no Ano ${currentYear}, Dia ${dayOfYear}.`
        );
      } else if (!currentlyInside && wasNarymInNebula) {
        const dayOfYear = Math.floor(simulationTime % yearLength);
        console.log(
          `TRAJETO: Narym SAIU da nebulosa no Ano ${currentYear}, Dia ${dayOfYear}.`
        );
      }
      wasNarymInNebula = currentlyInside;

      // Substitui a lógica de fog anterior
      if (currentlyInside && !isNarymInNebula) {
        isNarymInNebula = true;
        scene.fogColor = BABYLON.Color3.FromHexString(nebulaConfig.fog.color);
        scene.fogDensity = nebulaConfig.fog.density;
      } else if (!currentlyInside && isNarymInNebula) {
        isNarymInNebula = false;
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
  updateTimeDisplay(simulationTime, binarySystem.orbit.period);
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
