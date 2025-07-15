// Crie um novo arquivo chamado stateManager.js

/**
 * Orquestra a captura e a restauração do estado completo da simulação.
 */
export class StateManager {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Captura o estado essencial de todos os corpos celestes dinâmicos.
   * @returns {Object} Um objeto JSON serializável representando o estado da simulação.
   */
  captureState() {
    const state = {
      pivots: [],
    };

    this.scene.transformNodes.forEach((node) => {
      // Capturamos apenas os pivôs orbitais, que são a raiz da hierarquia de cada corpo.
      if (node.metadata && node.metadata.nodeType === "orbital") {
        const bodyRotationPivot = node.metadata.bodyRotationPivot || node;

        state.pivots.push({
          name: node.name,
          position: node.position.asArray(),
          rotationQuaternion: bodyRotationPivot.rotationQuaternion.asArray(),
        });
      }
    });

    return state;
  }

  /**
   * Restaura o estado da simulação a partir de um objeto de estado capturado.
   * @param {Object} stateObject - O objeto de estado a ser aplicado.
   */
  restoreState(stateObject) {
    if (!stateObject || !stateObject.pivots) {
      console.error("StateManager: Objeto de estado inválido ou ausente.");
      return;
    }

    stateObject.pivots.forEach((pState) => {
      const pivotNode = this.scene.getTransformNodeByName(pState.name);
      if (pivotNode) {
        pivotNode.position = BABYLON.Vector3.FromArray(pState.position);

        const bodyRotationPivot =
          pivotNode.metadata.bodyRotationPivot || pivotNode;
        if (!bodyRotationPivot.rotationQuaternion) {
          bodyRotationPivot.rotationQuaternion = new BABYLON.Quaternion();
        }
        bodyRotationPivot.rotationQuaternion = BABYLON.Quaternion.FromArray(
          pState.rotationQuaternion
        );
      } else {
        console.warn(
          `StateManager: Pivô "${pState.name}" não encontrado na cena durante a restauração.`
        );
      }
    });
  }
}
