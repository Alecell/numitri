import { getOrbitPathPoints } from "./orbitalMechanics.js";
import { simulationConfig, nebulaConfig } from "./config.js";

export const updateOrbitLine = (lineName, newOrbitData, scene) => {
  const line = scene.getMeshByName(lineName);
  if (!line) return;

  const newPoints = getOrbitPathPoints(newOrbitData, simulationConfig.scale);

  const inclination = newOrbitData.inclination || 0;
  const nodalPrecessionAngle = newOrbitData.nodalPrecessionAngle || 0;

  const inclinationMatrix = BABYLON.Matrix.RotationX(
    BABYLON.Tools.ToRadians(inclination)
  );
  const nodalPrecessionMatrix = BABYLON.Matrix.RotationY(nodalPrecessionAngle);

  const combinedMatrix = inclinationMatrix.multiply(nodalPrecessionMatrix);

  const finalPath = newPoints.map((p) =>
    BABYLON.Vector3.TransformCoordinates(p, combinedMatrix)
  );

  BABYLON.MeshBuilder.CreateLines(lineName, {
    points: finalPath,
    instance: line,
  });
};

const setupMaterial = (mesh, visualConfig, config) => {
  const material = new BABYLON.StandardMaterial(
    `${mesh.name}-material`,
    mesh.getScene()
  );

  if (mesh.name === config.star.name) {
    material.emissiveColor = new BABYLON.Color3(1, 1, 0.9);
    material.disableLighting = true;
  } else if (visualConfig && visualConfig.maps) {
    const textureUrl = visualConfig.maps[visualConfig.defaultMap];
    const diffuseTexture = new BABYLON.Texture(textureUrl, mesh.getScene());

    diffuseTexture.vScale = -1;

    material.diffuseTexture = diffuseTexture;

    if (mesh.name === config.star.name) {
      material.emissiveTexture = diffuseTexture;
    }
  }

  material.metadata = {
    originalDiffuse: material.diffuseColor.clone(),
    originalSpecular: material.specularColor.clone(),
  };
  material.specularColor = new BABYLON.Color3(0, 0, 0);
  mesh.material = material;
};

const createNebula = (scene, config) => {
  if (!config.enabled) return;

  const nebulaSystemPivot = new BABYLON.TransformNode(
    "Nebula-System-Pivot",
    scene
  );

  const nebulaMesh = BABYLON.MeshBuilder.CreateCylinder(
    "nebula-mesh",
    {
      height: config.tubeSettings.height,
      diameter: config.tubeSettings.diameter,
      tessellation: config.tubeSettings.tessellation,
    },
    scene
  );
  nebulaMesh.parent = nebulaSystemPivot;
  nebulaMesh.isPickable = false;
  nebulaMesh.rotation.x = Math.PI / 2;
  nebulaMesh.scaling = new BABYLON.Vector3(1, 1, 1);

  const material = new BABYLON.StandardMaterial("nebula-mat", scene);
  const emissiveTex = new BABYLON.Texture(config.material.textureUrl, scene);
  emissiveTex.uScale = 0.1;
  emissiveTex.vScale = 1;
  const diffuseTex = new BABYLON.Texture("./smoke.png", scene);
  diffuseTex.uScale = 10;
  diffuseTex.vScale = 1000;
  diffuseTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  diffuseTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  material.emissiveTexture = emissiveTex;
  material.opacityTexture = emissiveTex;
  material.diffuseTexture = diffuseTex;
  material.disableLighting = true;
  material.emissiveColor = BABYLON.Color3.FromHexString(
    config.material.emissiveColor
  );
  material.alpha = config.material.alpha;
  material.backFaceCulling = false;
  material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
  material.needDepthPrePass = true;
  nebulaMesh.material = material;
};

export const createPlanetarySystem = (scene, config) => {
  const createBodyWithPivot = (bodyData, parentPivot = null) => {
    const orbitalPivot = new BABYLON.TransformNode(
      `${bodyData.name}-pivot`,
      scene
    );
    orbitalPivot.metadata = { ...bodyData, nodeType: "orbital" };

    if (parentPivot) {
      orbitalPivot.parent = parentPivot;
    }

    // 2. PIVÔ DE ROTAÇÃO: Por padrão, é o mesmo que o pivô orbital.
    let bodyRotationPivot = orbitalPivot;

    // SE O CORPO TEM LUAS, criamos um pivô separado SÓ para a rotação axial.
    if (bodyData.moons && bodyData.moons.length > 0) {
      bodyRotationPivot = new BABYLON.TransformNode(
        `${bodyData.name}-body-rotation-pivot`,
        scene
      );
      bodyRotationPivot.parent = orbitalPivot; // Aninhado dentro do pivô orbital.
      bodyRotationPivot.metadata = { nodeType: "body-rotation" };

      // Armazenamos a referência para fácil acesso em main.js
      orbitalPivot.metadata.bodyRotationPivot = bodyRotationPivot;
    }

    // 3. CRIAÇÃO DA MALHA E OUTROS ELEMENTOS VISUAIS
    if (bodyData.radius && bodyData.visual) {
      const mesh = BABYLON.MeshBuilder.CreateSphere(
        bodyData.name,
        { diameter: bodyData.radius * config.scale * 2 },
        scene
      );

      // A malha é SEMPRE filha do pivô de rotação para herdar inclinação e giro.
      mesh.parent = bodyRotationPivot;
      mesh.position = BABYLON.Vector3.Zero();

      // Metadados importantes como raios para sombras são colocados no pivô orbital, que define a posição mundial.
      if (!orbitalPivot.metadata) orbitalPivot.metadata = {};
      orbitalPivot.metadata.forwardRay = new BABYLON.Ray(
        orbitalPivot.position,
        new BABYLON.Vector3(0, 0, 0),
        1000
      );
      orbitalPivot.metadata.backwardRay = new BABYLON.Ray(
        orbitalPivot.position,
        new BABYLON.Vector3(0, 0, 0),
        1000
      );
      orbitalPivot.metadata.raysHelper = [
        new BABYLON.RayHelper(orbitalPivot.metadata.forwardRay),
        new BABYLON.RayHelper(orbitalPivot.metadata.backwardRay),
      ];

      setupMaterial(mesh, bodyData.visual, config);

      if (bodyData.debugFeatures?.polePins) {
        const scaledRadius = bodyData.radius * config.scale;
        // Pinos são visuais do corpo, então são filhos do pivô de rotação.
        const northPin = BABYLON.MeshBuilder.CreateCylinder(
          `${bodyData.name}-north-pin`,
          { height: scaledRadius * 0.5, diameter: scaledRadius * 0.05 },
          scene
        );
        northPin.parent = bodyRotationPivot;
        northPin.position.y = scaledRadius;
        northPin.material = new BABYLON.StandardMaterial(
          "north-pin-mat",
          scene
        );
        northPin.material.emissiveColor = new BABYLON.Color3(1, 0, 0);
        northPin.isVisible = false;
        const equatorPin = BABYLON.MeshBuilder.CreateCylinder(
          `${bodyData.name}-equator-pin`,
          { height: scaledRadius * 0.5, diameter: scaledRadius * 0.05 },
          scene
        );
        equatorPin.parent = bodyRotationPivot;
        equatorPin.position.x = scaledRadius;
        equatorPin.rotation.z = Math.PI / 2;
        equatorPin.material = new BABYLON.StandardMaterial(
          "equator-pin-mat",
          scene
        );
        equatorPin.material.emissiveColor = new BABYLON.Color3(0, 1, 0);
        equatorPin.isVisible = false;
      }
    }

    // 4. APLICAÇÃO DA INCLINAÇÃO AXIAL INICIAL
    // A inclinação é SEMPRE aplicada ao pivô de rotação do corpo.
    bodyRotationPivot.rotationQuaternion = new BABYLON.Quaternion();
    const tilt = bodyData.axialTilt || 0;
    const tiltQuaternion = BABYLON.Quaternion.RotationAxis(
      new BABYLON.Vector3(0, 0, 1),
      BABYLON.Tools.ToRadians(tilt)
    );
    bodyRotationPivot.rotationQuaternion = tiltQuaternion;

    // Guardamos a inclinação base nos metadados do pivô orbital principal para acesso global.
    orbitalPivot.metadata.baseTiltQuaternion = tiltQuaternion.clone();

    // 5. CRIAÇÃO DA ÓRBITA (LÓGICA ESPECÍFICA PARA LUAS)
    if (bodyData.orbit && !bodyData.components) {
      const orbitPath = getOrbitPathPoints(bodyData.orbit, config.scale);
      const orbitLine = BABYLON.MeshBuilder.CreateLines(
        `${bodyData.name}-orbit-line`,
        { points: orbitPath },
        scene
      );
      orbitLine.color = new BABYLON.Color3(0.5, 0.5, 0.5);
      orbitLine.isVisible = false;
      orbitLine.rotationQuaternion = new BABYLON.Quaternion();

      // PONTO CRÍTICO: A linha orbital da lua é filha do pivô ORBITAL do seu planeta.
      // Isso a sincroniza com a posição do planeta, mas NÃO com sua rotação axial.
      if (parentPivot) {
        orbitLine.parent = parentPivot;
      }
    }

    // 6. RECURSÃO PARA AS LUAS
    if (bodyData.moons) {
      // PONTO CRÍTICO: As luas são filhas do pivô ORBITAL do planeta, isolando-as da rotação axial.
      bodyData.moons.forEach((moonData) =>
        createBodyWithPivot(moonData, orbitalPivot)
      );
    }
    // ================== FIM DA NOVA ARQUITETURA ==================
  };

  createBodyWithPivot(config.star);

  config.planets.forEach((bodyData) => {
    if (bodyData.type === "binaryPair") {
      const barycenterPath = getOrbitPathPoints(bodyData.orbit, config.scale);
      const systemInclinationMatrix = BABYLON.Matrix.RotationX(
        BABYLON.Tools.ToRadians(bodyData.orbit.inclination || 0)
      );
      const finalBarycenterPath = barycenterPath.map((p) =>
        BABYLON.Vector3.TransformCoordinates(p, systemInclinationMatrix)
      );
      const barycenterLine = BABYLON.MeshBuilder.CreateLines(
        `${bodyData.name}-orbit-line`,
        { points: finalBarycenterPath, updatable: true },
        scene
      );
      barycenterLine.color = new BABYLON.Color3(0.7, 0.7, 0.7);
      barycenterLine.isVisible = false;

      bodyData.components.forEach((componentData) => {
        // A chamada recursiva agora constrói a hierarquia correta para cada componente
        createBodyWithPivot(componentData);

        const mutualOrbitPoints = [];
        const radius = componentData.orbitRadius * config.scale;
        const segments = 180;
        for (let i = 0; i <= segments; i++) {
          const angle = ((2 * Math.PI) / segments) * i;
          mutualOrbitPoints.push(
            new BABYLON.Vector3(
              radius * Math.cos(angle),
              0,
              radius * Math.sin(angle)
            )
          );
        }
        const mutualLine = BABYLON.MeshBuilder.CreateLines(
          `${componentData.name}-orbit-line`,
          { points: mutualOrbitPoints },
          scene
        );
        mutualLine.color = new BABYLON.Color3(0.4, 0.4, 0.4);
        mutualLine.isVisible = false;
        mutualLine.rotationQuaternion = new BABYLON.Quaternion();
      });
    }
  });

  const starLight = new BABYLON.PointLight(
    `${config.star.name}-light`,
    BABYLON.Vector3.Zero(),
    scene
  );
  starLight.intensity = 2;
  starLight.diffuse = BABYLON.Color3.FromHexString("#FFF5E1");
  starLight.specular = BABYLON.Color3.FromHexString("#FFF5E1");

  createNebula(scene, nebulaConfig);

  console.log("Sistema Planetário.");
};
