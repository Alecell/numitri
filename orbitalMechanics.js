/**
 * Módulo de Mecânica Orbital
 * Contém as funções matemáticas para calcular posições em órbitas elípticas.
 */

/**
 * Resolve a Equação de Kepler M = E - e*sin(E) para encontrar E.
 * Usa o método iterativo de Newton-Raphson.
 * @param {number} e - Excentricidade da órbita.
 * @param {number} M - Anomalia Média em radianos.
 * @returns {number} A Anomalia Excêntrica (E) em radianos.
 */
const solveKeplerEquation = (e, M) => {
  let E = M; // Chute inicial
  const maxIterations = 10;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tolerance) {
      break;
    }
  }
  return E;
};

/**
 * Calcula a posição 2D de um corpo em sua órbita elíptica.
 * A responsabilidade de aplicar a inclinação foi movida para o chamador.
 * @returns {BABYLON.Vector3} A posição 2D (x, 0, z) relativa ao corpo central.
 */
export const calculateEllipticalOrbit = (orbitData, scale, simulationTime) => {
  const a = orbitData.semiMajorAxis * scale;
  const e = orbitData.eccentricity;
  const T = orbitData.period;

  if (e === 0) {
    const angle = ((2 * Math.PI) / T) * simulationTime;
    const radius = a;
    return new BABYLON.Vector3(
      radius * Math.cos(angle),
      0,
      radius * Math.sin(angle)
    );
  }

  const M = ((2 * Math.PI) / T) * simulationTime;
  const E = solveKeplerEquation(e, M);
  const v =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
  const r = a * (1 - e * Math.cos(E));

  return new BABYLON.Vector3(r * Math.cos(v), 0, r * Math.sin(v));
};

/**
 * Gera um array de pontos Vector3 que descrevem uma trajetória orbital.
 * @param {object} orbitData - Objeto com os dados da órbita.
 * @param {number} scale - O fator de escala da simulação.
 * @param {number} segments - O número de pontos para gerar a linha.
 * @returns {BABYLON.Vector3[]} Um array de pontos para a linha.
 */
export const getOrbitPathPoints = (orbitData, scale, segments = 360) => {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const simulationTime = (orbitData.period / segments) * i;
    // Usamos a mesma função que move os planetas para garantir que o trilho seja perfeito
    const point = calculateEllipticalOrbit(orbitData, scale, simulationTime);
    points.push(point);
  }
  return points;
};
