import { getOrbitPathPoints } from "./orbitalMechanics.js";
import { simulationConfig, nebulaConfig } from "./config.js";

const setupMaterial = (mesh, visualConfig, config) => {
  const material = new BABYLON.StandardMaterial(
    `${mesh.name}-material`,
    mesh.getScene()
  );

  // --- LÓGICA AJUSTADA PARA A ESTRELA ---
  if (mesh.name === config.star.name) {
    // Para a estrela, não usamos textura, apenas uma cor emissiva forte
    material.emissiveColor = new BABYLON.Color3(1, 1, 0.9); // Branco levemente amarelado
    material.disableLighting = true; // A estrela não é iluminada, ela emite luz
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
  material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  mesh.material = material;
};

const createNebula = (scene, config) => {
  if (!config.enabled) return;

  // 1. Cria o caminho a partir dos pontos da configuração
  const path = config.path.map((p) => new BABYLON.Vector3(p.x, p.y, p.z));

  // 2. Cria a malha procedural do tubo
  const nebulaMesh = BABYLON.MeshBuilder.CreateTube(
    "nebula-mesh",
    {
      path: path,
      radius: config.tubeSettings.radius * simulationConfig.scale,
      tessellation: config.tubeSettings.tessellation,
      cap: BABYLON.Mesh.NO_CAP, // Extremidades abertas
    },
    scene
  );
  nebulaMesh.isPickable = false; // Otimização, não podemos clicar nela por enquanto

  // 3. Cria o material emissivo e transparente
  const material = new BABYLON.StandardMaterial("nebula-mat", scene);
  // Usaremos a mesma textura para cor e para transparência
  material.emissiveTexture = new BABYLON.Texture(
    config.material.textureUrl,
    scene
  );
  material.opacityTexture = material.emissiveTexture;

  // Configurações para o efeito de gás
  material.disableLighting = true; // Não é afetado pela luz da estrela, brilha sozinho
  material.emissiveColor = BABYLON.Color3.FromHexString(
    config.material.emissiveColor
  );
  material.alpha = config.material.alpha; // Transparência geral

  // Importante para a renderização correta de objetos transparentes
  material.backFaceCulling = false;
  material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
  material.needDepthPrePass = true;

  material.diffuseTexture = new BABYLON.Texture("./smoke.png", scene);
  material.diffuseTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  material.diffuseTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

  nebulaMesh.material = material;

  // 4. Cria uma linha de debug para ver o caminho
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
      // Só cria mesh se tiver raio
      const mesh = BABYLON.MeshBuilder.CreateSphere(
        bodyData.name,
        { diameter: bodyData.radius * config.scale * 2 },
        scene
      );

      mesh.parent = pivot;

      if (!pivot.metadata) {
        pivot.metadata = {};
      }

      pivot.metadata.rays = [
        new BABYLON.Ray(pivot.position, new BABYLON.Vector3(0, 0, 0), 1000),
        new BABYLON.Ray(pivot.position, new BABYLON.Vector3(0, 0, 0), 1000),
        new BABYLON.Ray(pivot.position, new BABYLON.Vector3(0, 0, 0), 1000),
        new BABYLON.Ray(pivot.position, new BABYLON.Vector3(0, 0, 0), 1000),
        new BABYLON.Ray(pivot.position, new BABYLON.Vector3(0, 0, 0), 1000),
      ];
      pivot.metadata.eclipseRay = new BABYLON.Ray(
        pivot.position,
        new BABYLON.Vector3(0, 0, 0),
        1000
      );

      pivot.metadata.raysHelper = [
        new BABYLON.RayHelper(pivot.metadata.eclipseRay),
        new BABYLON.RayHelper(pivot.metadata.rays[0]),
        new BABYLON.RayHelper(pivot.metadata.rays[1]),
        new BABYLON.RayHelper(pivot.metadata.rays[2]),
        new BABYLON.RayHelper(pivot.metadata.rays[3]),
        new BABYLON.RayHelper(pivot.metadata.rays[4]),
      ];

      setupMaterial(mesh, bodyData.visual, config);

      // LÓGICA DOS PINOS RESTAURADA AQUI
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
      // 1. Desenha a órbita principal (do baricentro)
      const barycenterPath = getOrbitPathPoints(bodyData.orbit, config.scale);
      const systemInclinationMatrix = BABYLON.Matrix.RotationX(
        BABYLON.Tools.ToRadians(bodyData.orbit.inclination || 0)
      );
      const finalBarycenterPath = barycenterPath.map((p) =>
        BABYLON.Vector3.TransformCoordinates(p, systemInclinationMatrix)
      );
      const barycenterLine = BABYLON.MeshBuilder.CreateLines(
        `${bodyData.name}-orbit-line`,
        { points: finalBarycenterPath },
        scene
      );
      barycenterLine.color = new BABYLON.Color3(0.7, 0.7, 0.7);
      barycenterLine.isVisible = false;

      // 2. Cria os componentes visuais (Narym, Vezmar) e suas luas
      bodyData.components.forEach((componentData) => {
        createBodyWithPivot(componentData);

        // 3. Desenha as órbitas de Narym e Vezmar em torno do baricentro
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
  // Define a cor da luz para um branco-amarelado, como uma estrela F5V
  starLight.diffuse = BABYLON.Color3.FromHexString("#FFF5E1");
  starLight.specular = BABYLON.Color3.FromHexString("#FFF5E1");

  createNebula(scene, nebulaConfig);

  console.log("Sistema Planetário reconstruído com Pinos de Eixo restaurados.");
};
