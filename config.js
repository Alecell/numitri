/**
 * Objeto de Configuração Central
 */
export const simulationConfig = {
  scale: 1e-6,
  timeScale: 1, // 1 segundo real equivale a 1 dia narímico de simulação

  star: {
    name: "Anavon",
    type: "F5 V",
    radius: 905000,
    visual: {
      defaultMap: "Visão Real",
      maps: {
        "Visão Real": "URL_DA_TEXTURA_REAL_DE_ANAVON",
        Biomas: "URL_DA_TEXTURA_DE_BIOMAS_DE_ANAVON",
      },
    },
  },

  planets: [
    {
      name: "Narym-Vezmar System",
      type: "binaryPair",
      orbit: {
        period: 730,
        semiMajorAxis: 308000000,
        eccentricity: 0.0502,
        inclination: 8,
      },
      mutualOrbit: {
        period: 365, // dias narímicos
      },
      components: [
        {
          name: "Narym",
          radius: 12250, // km
          axialTilt: 29, // graus
          rotationPeriod: 1, // 1 dia narímico
          precessionPeriod: 21049,
          orbitRadius: 5490000, // km (distância ao baricentro)
          debugFeatures: {
            polePins: true, // Habilita a criação dos pinos para este corpo
          },
          visual: {
            defaultMap: "Visão Real",
            maps: {
              "Visão Real": "./Mirt.png",
              Biomas: "https://assets.babylonjs.com/environments/roof.jpg",
            },
          },
          moons: [
            {
              name: "Tharela",
              radius: 2200, // km
              rotationPeriod: 4, // Rotação síncrona com a órbita
              orbit: {
                period: 4, // dias narímicos
                semiMajorAxis: 234000, // km
                inclination: 12, // graus
                eccentricity: 0,
              },
              visual: {
                defaultMap: "Visão Real",
                maps: {
                  "Visão Real": "URL_DA_TEXTURA_REAL_DE_THARELA",
                  Biomas: "URL_DA_TEXTURA_DE_BIOMAS_DE_THARELA",
                },
              }, // Placeholder: alaranjado-dourado
            },
            {
              name: "Ciren",
              radius: 1400, // km
              rotationPeriod: 19, // Rotação síncrona com a órbita
              orbit: {
                period: 19, // dias narímicos
                semiMajorAxis: 656000, // km
                inclination: 5, // graus
                eccentricity: 0,
              },
              visual: {
                defaultMap: "Visão Real",
                maps: {
                  "Visão Real": "URL_DA_TEXTURA_REAL_DE_CIREN",
                  Biomas: "URL_DA_TEXTURA_DE_BIOMAS_DE_CIREN",
                },
              }, // Placeholder: branco-azulado pálido
            },
          ],
        },
        {
          name: "Vezmar",
          radius: 129150, // km
          axialTilt: 4, // Não especificado, assumindo 0
          rotationPeriod: 11.3 / 30, // 0.3766 dias narímicos
          orbitRadius: 1910000, // km (distância ao baricentro)
          visual: {
            defaultMap: "Visão Real",
            maps: {
              "Visão Real": "URL_DA_TEXTURA_REAL_DE_VEZMAR",
              Biomas: "URL_DA_TEXTURA_DE_BIOMAS_DE_VEZMAR",
            },
          }, // Placeholder: âmbar-creme gasoso
        },
      ],
    },
  ],
};

export const nebulaConfig = {
  name: "O Véu de Numitri",
  enabled: true,
  path: [
    { x: 400 - 131, y: 0, z: 350 },
    { x: 390 - 131, y: 10, z: 250 },
    { x: 400 - 131, y: -15, z: 150 },
    { x: 410 - 131, y: 0, z: 50 },
    { x: 400 - 131, y: 5, z: -50 },
    { x: 390 - 131, y: -5, z: -150 },
    { x: 400 - 131, y: 10, z: -250 },
    { x: 410 - 131, y: -10, z: -350 },
    { x: 400 - 131, y: 0, z: -450 },
  ],

  // Configurações do "tubo" que forma o rio
  tubeSettings: {
    radius: 30000000, // Raio do tubo em km
    tessellation: 64, // Suavidade do tubo (mais = mais suave)
  },

  // Configurações do material luminoso e gasoso
  material: {
    // Use uma textura de nuvem/fumaça aqui. Procure por "seamless smoke texture png"
    textureUrl: "./smoke.png",
    emissiveColor: "#00CED1", // Um tom de roxo para a emissão de luz
    alpha: 0.15, // Transparência geral da nebulosa
  },

  fog: {
    color: "#006c6d", // Cor da névoa quando Narym está dentro do Véu
    density: 0.01, // Densidade da névoa
  },

  debug: {
    showPath: false, // Mude para true para ver a linha central do tubo
  },
};
