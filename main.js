import { simulationConfig, nebulaConfig } from "./config.js";
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
let isNarymInNebula = false;

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
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

  // --- LÓGICA DO SKYBOX CORRIGIDA E ISOLADA ---
  // 1. Criamos uma CubeTexture APENAS para o skybox.
  // Usando a versão de alta qualidade que já sabemos que funciona.
  const skyboxTexture = BABYLON.CubeTexture.CreateFromImages(
    [
      "./skybox/teste_right1.png",
      "./skybox/teste_left2.png",
      "./skybox/teste_top3.png",
      "./skybox/teste_bottom4.png",
      "./skybox/teste_front5.png",
      "./skybox/teste_back6.png",
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
  glowLayer.intensity = 1.5;

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

  // O resto das chamadas permanece o mesmo
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

          // --- CORREÇÃO DO MOVIMENTO DA LUA ---
          // O offset da lua é calculado com sua própria inclinação, e depois somado à posição
          // final e já inclinada do seu planeta pai. Sem dupla inclinação.
          const moonOffsetTilted = BABYLON.Vector3.TransformCoordinates(
            moonFlatPos,
            moonInclinationMatrix
          );
          const moonFinalPos = planetFinalPos.add(moonOffsetTilted);
          moonPivot.position = moonFinalPos;

          moonMesh.lookAt(planetMesh.position);

          const orbitLine = scene.getMeshByName(`${moonData.name}-orbit-line`);
          if (orbitLine) {
            orbitLine.position = planetFinalPos;
          }
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
