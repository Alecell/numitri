const solveKeplerEquation = (e, M) => {
  let E = M;
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

// --- ALTERAÇÃO AQUI: Adicionado o parâmetro precessionAngle ---
export const calculateEllipticalOrbit = (
  orbitData,
  scale,
  simulationTime,
  precessionAngle = 0
) => {
  const a = orbitData.semiMajorAxis * scale;
  const e = orbitData.eccentricity;
  const T = orbitData.period;

  if (e === 0) {
    // Órbita circular (precessão não tem efeito visível na forma)
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

  // --- ALTERAÇÃO AQUI: Aplica a rotação da precessão ---
  const x = r * Math.cos(v);
  const z = r * Math.sin(v);

  // Se houver um ângulo de precessão, rotaciona o ponto no plano XZ
  if (precessionAngle !== 0) {
    const cosP = Math.cos(precessionAngle);
    const sinP = Math.sin(precessionAngle);
    const rotatedX = x * cosP - z * sinP;
    const rotatedZ = x * sinP + z * cosP;
    return new BABYLON.Vector3(rotatedX, 0, rotatedZ);
  }

  return new BABYLON.Vector3(x, 0, z);
};

export const getOrbitPathPoints = (orbitData, scale, segments = 360) => {
  const points = [];
  // --- ALTERAÇÃO AQUI: Lê o ângulo de precessão dos dados da órbita ---
  const precessionAngle = orbitData.precessionAngle || 0;

  for (let i = 0; i <= segments; i++) {
    const simulationTime = (orbitData.period / segments) * i;
    // Passa o ângulo para a função de cálculo
    const point = calculateEllipticalOrbit(
      orbitData,
      scale,
      simulationTime,
      precessionAngle
    );
    points.push(point);
  }
  return points;
};

export const getCyclicValue = (
  cycleData,
  simulationTimeInDays,
  yearLengthInDays
) => {
  const { min, max, period } = cycleData;
  const periodInDays = period * yearLengthInDays;

  const amplitude = (max - min) / 2;
  const average = (max + min) / 2;
  const angularFrequency = (2 * Math.PI) / periodInDays;

  const currentValue =
    average + amplitude * Math.sin(angularFrequency * simulationTimeInDays);

  return currentValue;
};
