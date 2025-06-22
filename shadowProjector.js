/**
 * Módulo para projetar sombras "falsas" usando Raycasting e Decalques.
 */

// Lista de corpos que podem receber sombras
const state = [];
let annularDecalMaterial;
let totalDecalMaterial;

const createDecalMaterial = (name, scene, alphaValue) => {
  const decalMaterial = new BABYLON.StandardMaterial(name, scene);
  const size = 256; // Diminuí o tamanho da textura para ser mais leve
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

  // A transparência agora é controlada pelo parâmetro
  decalMaterial.alpha = alphaValue;

  return decalMaterial;
};

// Esta função de inicialização agora cria NOSSOS DOIS materiais.
export const initializeEclipseMaterials = (scene) => {
  annularDecalMaterial = createDecalMaterial("annular-decal-mat", scene, 0.4);
  totalDecalMaterial = createDecalMaterial("total-decal-mat", scene, 0.8);
};

/**
 * Verifica se um objeto igual a idObj já está presente no array state.
 * Se encontrar um objeto com occluder e receiver iguais, mas diferente nos outros campos,
 * remove o decal antigo chamando dispose e retorna false.
 * @param {Array<object>} state
 * @param {object} idObj
 * @returns {boolean}
 */
function hasIdObj(state, idObj) {
  for (const obj of state) {
    // Se todos os campos são iguais, retorna true
    if (Object.keys(idObj).every((key) => obj[key] === idObj[key])) {
      return true;
    }
    // Se apenas occluder e receiver são iguais, remove o decal antigo
    if (
      obj.occluder === idObj.occluder &&
      obj.receiver === idObj.receiver &&
      obj.decal &&
      typeof obj.decal.dispose === "function"
    ) {
      obj.decal.dispose();
      // Remove o objeto antigo do state
      const idx = state.indexOf(obj);
      if (idx !== -1) state.splice(idx, 1);
      return false;
    }
  }
  return false;
}

/**
 * Projeta uma sombra de um corpo para outro.
 * @param {BABYLON.AbstractMesh} occluderMesh - O corpo que está na frente (ex: Vezmar)
 * @param {BABYLON.Scene} scene - A cena
 * @param {object} config - A configuração da simulação
 * @returns {BABYLON.Mesh | null} O decalque criado, ou nulo se não houver colisão.
 */
export const projectShadow = (occluderPivot, scene, config) => {
  if (!occluderPivot) return null;

  const star = scene.getMeshByName(config.star.name);
  if (!star) return null;

  const occluderConfig = occluderPivot.metadata;

  // Se este corpo não tem configuração de sombra, não faz nada
  if (!occluderConfig.shadowCasting) return null;

  // 1. O raio sai do corpo que causa a sombra, na direção oposta à estrela
  const origin = occluderPivot.getAbsolutePosition();
  const direction = origin.subtract(star.getAbsolutePosition()).normalize();
  occluderPivot.metadata.backwardRay.origin = origin;
  occluderPivot.metadata.backwardRay.direction = direction;

  // Predicado para o raio só atingir os corpos celestes
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

  // 2. Se o raio atingiu um corpo válido
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

    // --- AJUSTE 1: AUMENTAR A PROFUNDIDADE DA PROJEÇÃO ---
    const decalWidthHeight = shadowSizeKm * config.scale;
    const decalSize = new BABYLON.Vector3(
      decalWidthHeight,
      decalWidthHeight,
      decalWidthHeight * 8
    );

    // 4. Cria o decalque de sombra na superfície do corpo atingido
    const decal = BABYLON.MeshBuilder.CreateDecal("decal", receiverMesh, {
      position: pickInfo.pickedPoint,
      normal: occluderPivot.metadata.backwardRay.direction,
      size: decalSize,
      angle: Math.random() * Math.PI * 2,
    });

    // --- AJUSTE 2: GARANTIR A VISIBILIDADE ---
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
      `Sombra projetada de ${occluderPivot.name} para ${receiverName})`
    );

    state.push({ ...id, decal });

    return decal;
  }

  return null;
};
