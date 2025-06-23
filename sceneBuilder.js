import { getOrbitPathPoints } from "./orbitalMechanics.js";
import { simulationConfig, nebulaConfig } from "./config.js";

export const updateOrbitLine = (lineName, newOrbitData, scene) => {
  const line = scene.getMeshByName(lineName);
  if (!line) return;

  // Gera os novos pontos com os dados atualizados
  const newPoints = getOrbitPathPoints(newOrbitData, simulationConfig.scale);

  // Aplica a inclinação do sistema
  const systemInclinationMatrix = BABYLON.Matrix.RotationX(
    BABYLON.Tools.ToRadians(newOrbitData.inclination || 0)
  );
  const finalPath = newPoints.map((p) =>
    BABYLON.Vector3.TransformCoordinates(p, systemInclinationMatrix)
  );

  // Atualiza a malha existente com os novos pontos
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

  // --- LÓGICA AJUSTADA PARA A ESTRELA ---
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

  const path = config.path.map((p) => new BABYLON.Vector3(p.x, p.y, p.z));

  const nebulaMesh = BABYLON.MeshBuilder.CreateTube(
    "nebula-mesh",
    {
      path: path,
      radius: config.tubeSettings.radius * simulationConfig.scale,
      tessellation: config.tubeSettings.tessellation,
      cap: BABYLON.Mesh.NO_CAP,
    },
    scene
  );
  nebulaMesh.isPickable = false;

  const material = new BABYLON.StandardMaterial("nebula-mat", scene);
  material.emissiveTexture = new BABYLON.Texture(
    config.material.textureUrl,
    scene
  );
  material.opacityTexture = material.emissiveTexture;

  material.disableLighting = true;
  material.emissiveColor = BABYLON.Color3.FromHexString(
    config.material.emissiveColor
  );
  material.alpha = config.material.alpha;

  material.backFaceCulling = false;
  material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
  material.needDepthPrePass = true;

  material.diffuseTexture = new BABYLON.Texture("./smoke.png", scene);
  material.diffuseTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  material.diffuseTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

  nebulaMesh.material = material;

  if (config.debug.showPath) {
    BABYLON.MeshBuilder.CreateLines(
      "nebula-path-line",
      { points: path },
      scene
    ).color = BABYLON.Color3.Teal();
  }
};

export const createPlanetarySystem = (scene, config) => {
  const createBodyWithPivot = (bodyData, parentPivot = null) => {
    const pivot = new BABYLON.TransformNode(`${bodyData.name}-pivot`, scene);
    pivot.metadata = { ...bodyData };

    if (bodyData.radius && bodyData.visual) {
      const mesh = BABYLON.MeshBuilder.CreateSphere(
        bodyData.name,
        { diameter: bodyData.radius * config.scale * 2 },
        scene
      );

      mesh.parent = pivot;

      if (!pivot.metadata) {
        pivot.metadata = {};
      }

      pivot.metadata.forwardRay = new BABYLON.Ray(
        pivot.position,
        new BABYLON.Vector3(0, 0, 0),
        1000
      );
      pivot.metadata.backwardRay = new BABYLON.Ray(
        pivot.position,
        new BABYLON.Vector3(0, 0, 0),
        1000
      );

      pivot.metadata.raysHelper = [
        new BABYLON.RayHelper(pivot.metadata.forwardRay),
        new BABYLON.RayHelper(pivot.metadata.backwardRay),
      ];

      setupMaterial(mesh, bodyData.visual, config);

      if (bodyData.debugFeatures?.polePins) {
        const scaledRadius = bodyData.radius * config.scale;
        const northPin = BABYLON.MeshBuilder.CreateCylinder(
          `${bodyData.name}-north-pin`,
          { height: scaledRadius * 0.5, diameter: scaledRadius * 0.05 },
          scene
        );
        northPin.parent = pivot;
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
        equatorPin.parent = pivot;
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

    pivot.rotationQuaternion = new BABYLON.Quaternion();
    const tilt = bodyData.axialTilt || 0;
    const tiltQuaternion = BABYLON.Quaternion.RotationAxis(
      new BABYLON.Vector3(0, 0, 1),
      BABYLON.Tools.ToRadians(tilt)
    );
    pivot.rotationQuaternion = tiltQuaternion;
    pivot.metadata.baseTiltQuaternion = tiltQuaternion.clone();

    if (bodyData.orbit && !bodyData.components) {
      const orbitPath = getOrbitPathPoints(bodyData.orbit, config.scale);
      const orbitInclination = bodyData.orbit.inclination || 0;
      const inclinationMatrix = BABYLON.Matrix.RotationX(
        BABYLON.Tools.ToRadians(orbitInclination)
      );
      const finalPath = orbitPath.map((p) =>
        BABYLON.Vector3.TransformCoordinates(p, inclinationMatrix)
      );
      const orbitLine = BABYLON.MeshBuilder.CreateLines(
        `${bodyData.name}-orbit-line`,
        { points: finalPath },
        scene
      );
      orbitLine.color = new BABYLON.Color3(0.5, 0.5, 0.5);
      orbitLine.isVisible = false;
    }

    if (bodyData.moons) {
      bodyData.moons.forEach((moonData) =>
        createBodyWithPivot(moonData, pivot)
      );
    }
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
        const finalMutualPath = mutualOrbitPoints.map((p) =>
          BABYLON.Vector3.TransformCoordinates(p, systemInclinationMatrix)
        );
        const mutualLine = BABYLON.MeshBuilder.CreateLines(
          `${componentData.name}-orbit-line`,
          { points: finalMutualPath },
          scene
        );
        mutualLine.color = new BABYLON.Color3(0.4, 0.4, 0.4);
        mutualLine.isVisible = false;
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

  console.log("Sistema Planetário reconstruído com Pinos de Eixo restaurados.");
};
