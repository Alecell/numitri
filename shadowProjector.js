/**
 * Módulo para projetar sombras "falsas" usando Raycasting e Decalques.
 */

// Lista de corpos que podem receber sombras
let decalMaterial; // Guarda o material para não recriá-lo a cada frame

/**
 * Cria o material que será usado para todos os decalques de sombra.
 * @param {BABYLON.Scene} scene
 */
export const createShadowDecalMaterial = (scene) => {
  decalMaterial = new BABYLON.StandardMaterial("shadow-decal-mat", scene);
  // Usamos uma textura de um círculo com bordas suaves
  decalMaterial.diffuseTexture = new BABYLON.Texture(
    "https://assets.babylonjs.com/textures/flare.png",
    scene
  );
  decalMaterial.diffuseTexture.hasAlpha = true;
  decalMaterial.useAlphaFromDiffuseTexture = true;
  decalMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0); // Sombra é preta
  decalMaterial.alpha = 0.5; // Transparência da sombra
  decalMaterial.zOffset = -2;
  decalMaterial.disableLighting = true; // Não é afetado por outras luzes
};

/**
 * Projeta uma sombra de um corpo para outro.
 * @param {BABYLON.AbstractMesh} occluderMesh - O corpo que está na frente (ex: Vezmar)
 * @param {BABYLON.Scene} scene - A cena
 * @param {object} config - A configuração da simulação
 * @returns {BABYLON.Mesh | null} O decalque criado, ou nulo se não houver colisão.
 */
export const projectShadow = (occluderPivot, scene, config) => {
  if (!occluderPivot || !decalMaterial) return null;

  const star = scene.getMeshByName(config.star.name);
  if (!star) return null;

  const occluderConfig = occluderPivot.metadata;

  // Se este corpo não tem configuração de sombra, não faz nada
  if (!occluderConfig.shadowCasting) return null;

  // 1. O raio sai do corpo que causa a sombra, na direção oposta à estrela
  const origin = occluderPivot.getAbsolutePosition();
  const direction = origin.subtract(star.getAbsolutePosition()).normalize();
  occluderPivot.metadata.eclipseRay.origin = origin;
  occluderPivot.metadata.eclipseRay.direction = direction;

  // Predicado para o raio só atingir os corpos celestes
  const predicate = (mesh) => {
    const isBody = mesh.parent?.metadata?.kind === "body";

    const isNotSelf = !occluderPivot.name.includes(mesh.name);

    return isBody && isNotSelf;
  };
  const pickInfo = scene.pickWithRay(
    occluderPivot.metadata.eclipseRay,
    predicate
  );

  // 2. Se o raio atingiu um corpo válido
  if (pickInfo.hit) {
    const receiverMesh = pickInfo.pickedMesh;
    const receiverName = receiverMesh.name;

    const shadowSizeKm = occluderConfig.shadowCasting[receiverName].diameter;
    if (!shadowSizeKm) return null;

    // --- AJUSTE 1: AUMENTAR A PROFUNDIDADE DA PROJEÇÃO ---
    const decalWidthHeight = shadowSizeKm * config.scale;
    // O tamanho agora é um paralelepípedo, não um cubo.
    // A profundidade (eixo Z) é 4x maior que a largura e altura.
    const decalSize = new BABYLON.Vector3(
      decalWidthHeight,
      decalWidthHeight,
      decalWidthHeight * 8
    );

    // 4. Cria o decalque de sombra na superfície do corpo atingido
    const decal = BABYLON.MeshBuilder.CreateDecal("decal", receiverMesh, {
      position: pickInfo.pickedPoint,
      normal: occluderPivot.metadata.eclipseRay.direction,
      size: decalSize,
      angle: Math.random() * Math.PI * 2,
    });

    // --- AJUSTE 2: GARANTIR A VISIBILIDADE ---
    decal.alwaysSelectAsActiveMesh = true;

    decal.material = decalMaterial;
    return decal;
  }

  return null;
};
