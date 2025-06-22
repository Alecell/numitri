const state = [];
let annularDecalMaterial;
let totalDecalMaterial;

const createDecalMaterial = (name, scene, alphaValue) => {
  const decalMaterial = new BABYLON.StandardMaterial(name, scene);
  const size = 256;
  const dynamicTexture = new BABYLON.DynamicTexture(
    `decal-${name}`,
    size,
    scene,
    true
  );
  const ctx = dynamicTexture.getContext();

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
  ctx.shadowColor = "black";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "black";
  ctx.fill();

  dynamicTexture.hasAlpha = true;
  dynamicTexture.update();

  decalMaterial.diffuseTexture = dynamicTexture;
  decalMaterial.useAlphaFromDiffuseTexture = true;
  decalMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
  decalMaterial.alphaMode = BABYLON.Engine.ALPHA_BLEND;
  decalMaterial.zOffset = -2;

  decalMaterial.alpha = alphaValue;

  return decalMaterial;
};

export const initializeEclipseMaterials = (scene) => {
  annularDecalMaterial = createDecalMaterial("annular-decal-mat", scene, 0.4);
  totalDecalMaterial = createDecalMaterial("total-decal-mat", scene, 0.8);
};

function hasIdObj(state, idObj) {
  for (const obj of state) {
    if (Object.keys(idObj).every((key) => obj[key] === idObj[key])) {
      return true;
    }

    if (
      obj.occluder === idObj.occluder &&
      obj.receiver === idObj.receiver &&
      obj.decal &&
      typeof obj.decal.dispose === "function"
    ) {
      obj.decal.dispose();
      const idx = state.indexOf(obj);
      if (idx !== -1) state.splice(idx, 1);
      return false;
    }
  }
  return false;
}

export const projectShadow = (occluderPivot, scene, config) => {
  if (!occluderPivot) return null;

  const star = scene.getMeshByName(config.star.name);
  if (!star) return null;

  const occluderConfig = occluderPivot.metadata;

  if (!occluderConfig.shadowCasting) return null;

  const origin = occluderPivot.getAbsolutePosition();
  const direction = origin.subtract(star.getAbsolutePosition()).normalize();
  occluderPivot.metadata.backwardRay.origin = origin;
  occluderPivot.metadata.backwardRay.direction = direction;

  const predicate = (mesh) => {
    const isBody = mesh.parent?.metadata?.kind === "body";

    const isNotSelf = !occluderPivot.name.includes(mesh.name);
    const isMesh = !mesh.name.includes("-");

    return isBody && isNotSelf && isMesh;
  };
  const pickInfo = scene.pickWithRay(
    occluderPivot.metadata.backwardRay,
    predicate
  );

  if (pickInfo.hit) {
    const receiverMesh = pickInfo.pickedMesh;
    const receiverName = receiverMesh.name;

    const id = {
      occluder: occluderPivot.name,
      receiver: receiverName,
      bu: pickInfo.bu,
      bv: pickInfo.bv,
      distance: pickInfo?.distance,
      pickedX: pickInfo?.pickedPoint.x,
      pickedY: pickInfo?.pickedPoint.y,
      pickedZ: pickInfo?.pickedPoint.z,
    };

    if (hasIdObj(state, id)) return null;

    const shadowSizeKm = occluderConfig.shadowCasting[receiverName].diameter;
    if (!shadowSizeKm) return null;

    const decalWidthHeight = shadowSizeKm * config.scale;
    const decalSize = new BABYLON.Vector3(
      decalWidthHeight,
      decalWidthHeight,
      decalWidthHeight * 8
    );

    const decal = BABYLON.MeshBuilder.CreateDecal("decal", receiverMesh, {
      position: pickInfo.pickedPoint,
      normal: occluderPivot.metadata.backwardRay.direction,
      size: decalSize,
      angle: Math.random() * Math.PI * 2,
    });

    decal.alwaysSelectAsActiveMesh = true;

    if (occluderConfig.shadowCasting[receiverName].type === "annular") {
      decal.material = annularDecalMaterial;
    } else if (
      occluderConfig.shadowCasting[receiverName].type === "total" ||
      occluderConfig.shadowCasting[receiverName].type === "partial"
    ) {
      decal.material = totalDecalMaterial;
    }

    console.log(
      `Sombra projetada de ${
        occluderPivot.getChildren()[0].name
      } para ${receiverName}`
    );

    state.push({ ...id, decal });

    return decal;
  }

  return null;
};
