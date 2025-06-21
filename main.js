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

const updateEclipseStatusUI = (message) => {
  const span = document.getElementById("eclipse-status-text");
  if (span) span.innerText = message;
};

const enterInspectMode = () => {
  // 1. A FONTE DA VERDADE: Pega o alvo diretamente da câmera orbital.
  const targetMesh = orbitalCamera.lockedTarget;

  // 2. VERIFICAÇÃO: Se não houver alvo, ou se já estivermos no modo, não faz nada.
  if (!targetMesh || isInInspectMode) {
    console.warn("Modo Inspeção: Nenhum alvo selecionado.");
    // Opcional: podemos desabilitar o botão de sair da UI aqui por segurança.
    return;
  }

  isInInspectMode = true;
  inspectedTarget = targetMesh;

  // Pausa a simulação (lógica que já tínhamos)
  if (!isPaused) {
    lastTimeScale = simulationConfig.timeScale;
    simulationConfig.timeScale = 0;
    isPaused = true;
    updateTimeControlsUI(0);
  }

  // Configura a câmera de inspeção (lógica que já tínhamos)
  const meshRadius = targetMesh.getBoundingInfo().boundingSphere.radiusWorld;
  inspectionCamera.target = targetMesh.getAbsolutePosition();
  inspectionCamera.radius = meshRadius * 3;
  inspectionCamera.lowerRadiusLimit = meshRadius * 0.8;
  inspectionCamera.upperRadiusLimit = meshRadius * 1.5;

  // Troca as câmeras ativas (lógica que já tínhamos)
  scene.activeCamera.detachControl();
  scene.activeCamera = inspectionCamera;
  inspectionCamera.setEnabled(true);
  scene.activeCamera.attachControl(canvas, true);

  // Atualiza a UI para mostrar o painel de inspeção
  document.getElementById("controls-menu").style.display = "none";
  const inspectionPanel = document.getElementById("inspection-panel");
  inspectionPanel.style.display = "block";
  // Atualiza o nome do alvo no painel
  document.getElementById("inspection-target-name").innerText = targetMesh.name;
};

const exitInspectMode = (detail) => {
  if (!isInInspectMode) return;

  // Desativa a luz do lado escuro, se estiver ligada
  toggleDarkSideLight(detail);
  document.getElementById("light-dark-side-toggle").checked = false;

  isInInspectMode = false;
  inspectedTarget = null;

  // 1. Retoma a simulação
  simulationConfig.timeScale = lastTimeScale;
  isPaused = false;
  updateTimeControlsUI(simulationConfig.timeScale);

  // 2. Troca as câmeras de volta
  scene.activeCamera.detachControl();
  scene.activeCamera = orbitalCamera;
  orbitalCamera.setEnabled(true);
  scene.activeCamera.attachControl(canvas, true);

  // 3. Atualiza a UI
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

const getEclipseStatusMessage = (hitResults) => {
  const { norte, sul, centro, leste, oeste } = hitResults;
  const allHits = [norte, sul, centro, leste, oeste].filter(Boolean); // Filtra apenas os que colidiram

  if (allHits.length === 0) {
    return "Nenhum";
  }

  // Pega o nome do primeiro corpo que está causando o eclipse
  const occluderName = allHits[0];

  // Verifica se todos os raios atingiram o mesmo corpo
  const isTotal =
    allHits.length === 5 && allHits.every((name) => name === occluderName);
  if (isTotal) {
    return `Total por ${occluderName}`;
  }

  // Lógica para os eclipses parciais
  if (leste && oeste) {
    return `Parcial Central por ${occluderName}`;
  }
  if (leste) {
    return `Parcial começando pelo Oeste por ${occluderName}`;
  }
  if (oeste) {
    return `Parcial terminando para Leste por ${occluderName}`;
  }

  // Se só os raios verticais ou o centro atingiram
  return `Parcial por ${occluderName}`;
};

/**
 * Atualiza o decaimento da iluminação de um corpo celeste ao entrar no Véu.
 * Usa o raio central para medir a profundidade e interpola o diffuseColor.
 * @param {BABYLON.TransformNode} pivot - O pivô do corpo celeste.
 */
const updateNebulaDecay = (pivot) => {
  const mesh = pivot.getChildren()[0]; // Pega a malha visível (esfera)
  if (!mesh || !mesh.material || !isNarymInNebula) return; // Sai se não houver malha ou material

  const bodyData = pivot.metadata;
  const centralRay = pivot.metadata.rays?.[2]; // Usa o ? para acesso seguro

  // Verifica se o corpo tem configuração para interação e um raio central
  if (!bodyData.deepNebula || !centralRay) {
    // Se não, garante que a cor esteja no padrão e sai
    mesh.material.diffuseColor.set(1, 1, 1);
    return;
  }

  const maxDistance = bodyData.deepNebula;
  const nebulaPredicate = (mesh) => mesh.name === "nebula-mesh";
  const hitInfo = scene.pickWithRay(centralRay, nebulaPredicate);

  if (hitInfo.hit) {
    // ESTAMOS DENTRO DO VÉU
    const distance = hitInfo.distance;

    // 1. Calcula a proporção da penetração (0.0 a 1.0)
    // Usamos Math.min para "clampar" o valor em 1.0 se a distância exceder a máxima.
    const ratio = Math.min(distance / maxDistance, 1.0);

    // 2. Interpola linearmente o valor do diffuse
    // A fórmula é: start + ratio * (end - start)
    // start = 1.0 (brilho total), end = 0.1 (brilho mínimo)
    // 1.0 + ratio * (0.1 - 1.0)  =>  1.0 - (ratio * 0.9)
    const diffuseValue = 1.0 - ratio * 0.9;

    // 3. Aplica a cor no material
    mesh.material.diffuseColor.set(diffuseValue, diffuseValue, diffuseValue);
  } else {
    // ESTAMOS FORA DO VÉU, restaura para o brilho total
    mesh.material.diffuseColor.set(1, 1, 1);
  }
};

const applyRays = (
  pivot,
  componentData,
  simulationConfig,
  systemInclinationMatrix
) => {
  if (pivot.metadata.rays) {
    const starPosition = BABYLON.Vector3.Zero();
    const worldCenter = pivot.getAbsolutePosition();
    const scaledRadius = componentData.radius * simulationConfig.scale;

    const forward = BABYLON.Vector3.Zero().subtract(worldCenter).normalize();

    const systemUp = BABYLON.Vector3.TransformNormal(
      BABYLON.Axis.Y,
      systemInclinationMatrix
    );

    const right = BABYLON.Vector3.Cross(systemUp, forward).normalize();
    const up = BABYLON.Vector3.Cross(forward, right).normalize();

    const worldOrigins = {
      centro: worldCenter,
      norte: worldCenter.add(up.scale(scaledRadius)),
      sul: worldCenter.add(up.scale(-scaledRadius)),
      leste: worldCenter.add(right.scale(scaledRadius)),
      oeste: worldCenter.add(right.scale(-scaledRadius)),
    };

    // 3. Itera para atualizar e usar cada um dos seus 5 raios
    const hitResults = {
      norte: null,
      sul: null,
      centro: null,
      leste: null,
      oeste: null,
    };
    const predicate = (mesh) => {
      const isBody = mesh.parent?.metadata?.kind === "body";

      const isNotSelf = !pivot.name.includes(mesh.name);

      return isNotSelf && isBody;
    };

    // Itera para atualizar e testar cada um dos 5 raios
    Object.keys(worldOrigins).forEach((originName, index) => {
      const pivotRay = pivot.metadata.rays[index];
      if (pivotRay) {
        const rayOrigin = worldOrigins[originName];
        const rayDirection = starPosition.subtract(rayOrigin).normalize();
        pivotRay.origin = rayOrigin;
        pivotRay.direction = rayDirection;
        pivotRay.length = 2000;

        const hitInfo = scene.pickWithRay(pivotRay, predicate);

        // Se o raio atingiu um corpo oclusor, guarda o nome do corpo
        if (hitInfo.hit && OCCLUDING_BODIES.includes(hitInfo.pickedMesh.name)) {
          hitResults[originName] = hitInfo.pickedMesh.name;
        }
      }
    });

    const statusMessage = getEclipseStatusMessage(hitResults);
    updateEclipseStatusUI(statusMessage);
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

const createScene = () => {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

  // --- LÓGICA DO SKYBOX CORRIGIDA E ISOLADA ---
  // 1. Criamos uma CubeTexture APENAS para o skybox.
  // Usando a versão de alta qualidade que já sabemos que funciona.
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

  // 2. Criamos o material do skybox.
  const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
  skyboxMaterial.backFaceCulling = false;
  // A textura é aplicada como uma "reflectionTexture" para o efeito de infinito.
  skyboxMaterial.reflectionTexture = skyboxTexture;
  skyboxMaterial.reflectionTexture.coordinatesMode =
    BABYLON.Texture.SKYBOX_MODE;
  // Garantimos que o material do skybox não reaja a outras luzes.
  skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

  // 3. Criamos a caixa e aplicamos o material.
  const skybox = BABYLON.MeshBuilder.CreateBox(
    "skybox",
    { size: 9000.0 },
    scene
  );
  skybox.material = skyboxMaterial;
  skybox.infiniteDistance = true; // Garante que ele fique sempre no fundo.

  // A GlowLayer agora só será afetada pela estrela, como deveria.
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

  inspectionCamera = new BABYLON.ArcRotateCamera(
    "inspectionCamera",
    -Math.PI / 2, // Ângulo inicial
    Math.PI / 2.5, // Inclinação inicial
    1, // Raio/zoom inicial (será ajustado dinamicamente)
    BABYLON.Vector3.Zero(), // Alvo inicial (será ajustado dinamicamente)
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

  // O resto das chamadas permanece o mesmo
  createPlanetarySystem(scene, simulationConfig);
  initializeUI(scene.activeCamera, scene, simulationConfig);
  initializeEclipseMaterials(scene);

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

window.addEventListener("toggleRayDebug", (event) => {
  displayRays = event.detail.isVisible;
});

// --- EVENT LISTENERS ---
window.addEventListener("enterInspectMode", enterInspectMode);
window.addEventListener("exitInspectMode", (event) => {
  exitInspectMode(event.detail);
});
window.addEventListener("toggleDarkSideLight", (event) =>
  toggleDarkSideLight(event.detail)
);

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

const OCCLUDING_BODIES = ["Narym", "Vezmar", "Tharela", "Ciren"];
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

      const componentOrbitLine = scene.getMeshByName(
        `${componentData.name}-orbit-line`
      );
      if (componentOrbitLine) {
        componentOrbitLine.position = barycenterTiltedPos;
      }

      const rotationSpeed = (2 * Math.PI) / componentData.rotationPeriod;
      const rotationIncrement =
        rotationSpeed * deltaTime * simulationConfig.timeScale;

      // Cria uma rotação em torno do eixo Y LOCAL do pivô
      const frameRotation = BABYLON.Quaternion.RotationAxis(
        BABYLON.Axis.Y, // O eixo Y padrão
        rotationIncrement
      );

      applyRays(
        planetPivot,
        componentData,
        simulationConfig,
        systemInclinationMatrix
      );

      updateNebulaDecay(planetPivot);

      // Acumula a rotação. Como o pivô já está inclinado, ele girará no eixo inclinado.
      if (planetPivot.rotationQuaternion) {
        planetPivot.rotationQuaternion.multiplyInPlace(frameRotation);
      }

      if (componentData.precessionPeriod) {
        const precessionPeriodInDays =
          componentData.precessionPeriod * yearLength;
        const precessionSpeed = (2 * Math.PI) / precessionPeriodInDays;
        const precessionIncrement =
          precessionSpeed * deltaTime * simulationConfig.timeScale;

        // Cria uma rotação em torno do eixo Y DO MUNDO (o eixo "vertical" do sistema)
        const precessionRotation = BABYLON.Quaternion.RotationAxis(
          BABYLON.Axis.Y,
          precessionIncrement
        );

        // Aplica a rotação de precessão ANTES da rotação atual do pivô.
        // Isso faz com que todo o sistema inclinado do pivô "bamboleie"
        planetPivot.rotationQuaternion = precessionRotation.multiply(
          planetPivot.rotationQuaternion
        );
      }

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

          const moonOffsetTilted = BABYLON.Vector3.TransformCoordinates(
            moonFlatPos,
            moonInclinationMatrix
          );
          const moonFinalPos = planetFinalPos.add(moonOffsetTilted);
          moonPivot.position = moonFinalPos;

          const orbitalAngle =
            ((2 * Math.PI) / moonData.orbit.period) * simulationTime;

          const spinRotation = BABYLON.Quaternion.RotationAxis(
            BABYLON.Axis.Y,
            -orbitalAngle
          );

          moonPivot.rotationQuaternion = spinRotation;

          const orbitLine = scene.getMeshByName(`${moonData.name}-orbit-line`);
          if (orbitLine) {
            orbitLine.position = planetFinalPos;
          }

          applyRays(
            moonPivot,
            moonData,
            simulationConfig,
            systemInclinationMatrix
          );

          updateNebulaDecay(moonPivot);
        });
      }
    });

    if (nebulaConfig.enabled) {
      const narymPivot = scene.getTransformNodeByName("Narym-pivot");
      const nebulaMesh = scene.getMeshByName("nebula-mesh"); // Pega a malha do Véu

      if (narymPivot && nebulaMesh) {
        const narymPosition = narymPivot.getAbsolutePosition();

        // Verifica se o ponto da posição de Narym intercepta a geometria do Véu
        const currentlyInside = nebulaMesh.intersectsPoint(narymPosition);

        // Se o estado mudou (entrou ou saiu), aplica o efeito
        if (currentlyInside && !isNarymInNebula) {
          isNarymInNebula = true;
          // Ativa o efeito de névoa (fog)
          scene.fogColor = BABYLON.Color3.FromHexString(nebulaConfig.fog.color);
          scene.fogDensity = nebulaConfig.fog.density;
          console.log("Narym ENTROU no Véu de Numitri.");
        } else if (!currentlyInside && isNarymInNebula) {
          isNarymInNebula = false;
          // Desativa a névoa
          scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
          console.log("Narym SAIU do Véu de Numitri.");
        }
      }
    }
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
