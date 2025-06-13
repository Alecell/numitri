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
      // Esta é a definição do sistema binário como um todo.
      name: "Narym-Vezmar System",
      type: "binaryPair",

      // Órbita do Baricentro ao redor de Anavon
      orbit: {
        period: 730, // dias narímicos
        semiMajorAxis: 308000000, // km
        // e = (afelio - periélio) / (afelio + periélio)
        // e = (324M - 293M) / (324M + 293M) = 0.0502
        eccentricity: 0.0502,
        inclination: 8,
      },

      // Órbita mútua dos componentes ao redor do baricentro
      mutualOrbit: {
        period: 365, // dias narímicos
      },

      // Definição dos corpos que compõem o par
      components: [
        {
          name: "Narym",
          radius: 12250, // km
          axialTilt: 29, // graus
          rotationPeriod: 1, // 1 dia narímico
          orbitRadius: 5490000, // km (distância ao baricentro)
          debugFeatures: {
            polePins: true, // Habilita a criação dos pinos para este corpo
          },
          visual: {
            defaultMap: "Visão Real",
            maps: {
              "Visão Real": "asdasd",
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
