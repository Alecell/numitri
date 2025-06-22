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

export const getOrbitPathPoints = (orbitData, scale, segments = 360) => {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const simulationTime = (orbitData.period / segments) * i;
    const point = calculateEllipticalOrbit(orbitData, scale, simulationTime);
    points.push(point);
  }
  return points;
};
