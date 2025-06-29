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

export const calculateOrbitTangent = (
  orbitData,
  scale,
  simulationTime,
  precessionAngle = 0
) => {
  const deltaT = 0.001; // Pequeno incremento de tempo

  // Posição no tempo atual
  const p1 = calculateEllipticalOrbit(
    orbitData,
    scale,
    simulationTime,
    precessionAngle
  );

  // Posição um instante à frente
  const p2 = calculateEllipticalOrbit(
    orbitData,
    scale,
    simulationTime + deltaT,
    precessionAngle
  );

  // O vetor tangente é a direção de p1 para p2
  const tangent = p2.subtract(p1);
  tangent.normalize();

  return tangent;
};

function getAbsoluteBodyPosition(
  bodyName,
  time,
  binarySystem,
  orbitData,
  systemMatrix,
  scale
) {
  const componentData = binarySystem.components.find(
    (c) => c.name === bodyName
  );
  const componentIndex = binarySystem.components.indexOf(componentData);
  if (!componentData) return BABYLON.Vector3.Zero();

  // 1. Posição do baricentro
  const barycenterFlatPos = calculateEllipticalOrbit(
    orbitData,
    scale,
    time,
    orbitData.precessionAngle
  );
  const barycenterTiltedPos = BABYLON.Vector3.TransformCoordinates(
    barycenterFlatPos,
    systemMatrix
  );

  // 2. Offset da órbita mútua
  const mutualAngle = ((2 * Math.PI) / binarySystem.mutualOrbit.period) * time;
  const orbitRadius = componentData.orbitRadius * scale;
  const angleOffset = componentIndex === 0 ? 0 : Math.PI;
  const mutualOffsetFlat = new BABYLON.Vector3(
    orbitRadius * Math.cos(mutualAngle + angleOffset),
    0,
    orbitRadius * Math.sin(mutualAngle + angleOffset)
  );
  const mutualOffsetTilted = BABYLON.Vector3.TransformCoordinates(
    mutualOffsetFlat,
    systemMatrix
  );

  return barycenterTiltedPos.add(mutualOffsetTilted);
}

/**
 * Calcula uma métrica de alinhamento entre Narym e Vezmar em relação a Anavon (origem).
 * @returns {number} O produto escalar dos vetores de direção, onde 1 é alinhamento perfeito.
 */
function calculateAlignmentMetric(
  time,
  binarySystem,
  orbitData,
  systemMatrix,
  scale
) {
  const posNarym = getAbsoluteBodyPosition(
    "Narym",
    time,
    binarySystem,
    orbitData,
    systemMatrix,
    scale
  );
  const posVezmar = getAbsoluteBodyPosition(
    "Vezmar",
    time,
    binarySystem,
    orbitData,
    systemMatrix,
    scale
  );

  // CONDIÇÃO DE ECLIPSE: A distância de Narym à estrela (origem) deve ser maior que a de Vezmar.
  const isConjunction = posNarym.lengthSquared() > posVezmar.lengthSquared();

  if (!isConjunction) {
    return -1; // Ignora este ponto, não é um eclipse de Vezmar.
  }

  // Se for uma conjunção, calcula o quão bom é o alinhamento.
  posNarym.normalize();
  posVezmar.normalize();

  return BABYLON.Vector3.Dot(posNarym, posVezmar);
}

/**
 * Encontra o tempo da conjunção Narym-Vezmar para um determinado ano usando uma busca numérica.
 * @param {number} year - O ano da simulação para o qual se busca o eclipse.
 * @param {object} binarySystem - O objeto de configuração do sistema binário.
 * @param {number} scale - A escala da simulação.
 * @returns {number} O simulationTime do pico do alinhamento.
 */
export const findConjunctionTime = (year, binarySystem, scale) => {
  console.log(`[Debug | Busca] Iniciando busca para o ano ${year}.`);
  const yearLength = binarySystem.orbit.period;
  const startTime = year * yearLength;
  const endTime = (year + 1) * yearLength;

  let bestTimeGross = startTime;
  let maxAlignmentGross = -1;

  // 1. Busca Grossa (a cada dia)
  for (let t = startTime; t < endTime; t += 1) {
    // CORREÇÃO CRÍTICA: Recalcula os parâmetros para CADA ponto de tempo testado.
    const apsidalAngle =
      (t /
        (binarySystem.longTermCycles.apsidalPrecession.period * yearLength)) *
      (2 * Math.PI);
    const nodalAngle =
      (t / (binarySystem.orbit.nodalPrecessionPeriod * yearLength)) *
      (2 * Math.PI);
    const orbitData = { ...binarySystem.orbit, precessionAngle: apsidalAngle };
    const inclinationMatrix = BABYLON.Matrix.RotationX(
      BABYLON.Tools.ToRadians(orbitData.inclination)
    );
    const nodalMatrix = BABYLON.Matrix.RotationY(nodalAngle);
    const systemMatrix = inclinationMatrix.multiply(nodalMatrix);

    const alignment = calculateAlignmentMetric(
      t,
      binarySystem,
      orbitData,
      systemMatrix,
      scale
    );
    if (alignment > maxAlignmentGross) {
      maxAlignmentGross = alignment;
      bestTimeGross = t;
    }
  }
  console.log(
    `[Debug | Busca] Resultado da busca grossa: Tempo=${bestTimeGross.toFixed(
      2
    )}, Alinhamento=${maxAlignmentGross.toFixed(5)}`
  );

  let bestTimeFine = bestTimeGross;
  let maxAlignmentFine = maxAlignmentGross;
  const fineStartTime = bestTimeGross - 1;
  const fineEndTime = bestTimeGross + 1;
  const minuteStep = 1 / (30 * 60);

  // 2. Busca Fina (a cada minuto ao redor do melhor dia encontrado)
  for (let t = fineStartTime; t < fineEndTime; t += minuteStep) {
    // CORREÇÃO CRÍTICA: Recalcula os parâmetros para CADA ponto de tempo testado.
    const apsidalAngle =
      (t /
        (binarySystem.longTermCycles.apsidalPrecession.period * yearLength)) *
      (2 * Math.PI);
    const nodalAngle =
      (t / (binarySystem.orbit.nodalPrecessionPeriod * yearLength)) *
      (2 * Math.PI);
    const orbitData = { ...binarySystem.orbit, precessionAngle: apsidalAngle };
    const inclinationMatrix = BABYLON.Matrix.RotationX(
      BABYLON.Tools.ToRadians(orbitData.inclination)
    );
    const nodalMatrix = BABYLON.Matrix.RotationY(nodalAngle);
    const systemMatrix = inclinationMatrix.multiply(nodalMatrix);

    const alignment = calculateAlignmentMetric(
      t,
      binarySystem,
      orbitData,
      systemMatrix,
      scale
    );
    if (alignment > maxAlignmentFine) {
      maxAlignmentFine = alignment;
      bestTimeFine = t;
    }
  }

  console.log(
    `[Debug | Busca] Resultado final: Tempo=${bestTimeFine.toFixed(
      4
    )}, Alinhamento=${maxAlignmentFine.toFixed(5)}`
  );
  return bestTimeFine;
};
