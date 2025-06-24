/**
 * TODO: Identificador de estações - qual é a estação corrente no norte e no sul
 * Aqui é mencionado tambem ter um dado de intensidade de radiação solar. Colocar
 * um possivel medidor de insolação atual das trez zonas planetarias Polar, temperada e equatorial
 * IMPORTANTE: esse item na verdade são 2 itens, tanto o identificador de estações quanto o medidor de insolação
 *
 * TODO: Temperatura Média Orbital - A QUANTIDADE TOTAL de energia que o planeta como um todo está recebendo de Anavon. Ele responde à pergunta: "Narym, como um todo, está em uma fase mais quente ou mais fria de sua órbita anual?"
 *
 * TODO: Atividade de auroras - uma barrinha que tem no maximo "global" e no minimo "polar"
 * conforme se afunda no numve vai mudando a posiçào das auroras
 *
 * TODO: Medidor de pressão atmosferica - conforme se afunda no numve vai mudando a cor do medidor
 * pq no numve a parte da atmosfera CO2 poderia congelar nos polos depositando como gelo seco
 * reduzindo a pressão atmosférica temporariamente gerando uma pequena mas mensuravel variaçào
 * de pressão
 *
 * TODO: Medidor de maré - mas eu realmente não sei como eu exibiria isso. Talvez basear
 * no pino do equador, se o pino do equador possuir mares baixas, significa que onde ele
 * nào está, o mar está alto. E vice-versa. Mas como exibir isso? Indice de força de maré
 *
 *
 */

export const simulationConfig = {
  scale: 1e-6,
  timeScale: 1,

  star: {
    name: "Anavon",
    type: "F5 V",
    kind: "body",
    radius: 915000,
    axialTilt: 0,
    rotationPeriod: 25,
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
        period: 754,
        semiMajorAxis: 315500000,
        eccentricity: 0.05,
        inclination: 8,
        nodalPrecessionPeriod: 700000,
      },
      longTermCycles: {
        apsidalPrecession: {
          period: 530000,
        },
        eccentricityVariation: {
          min: 0.004,
          max: 0.07,
          period: 145000,
        },
        inclinationVariation: {
          min: 5.3,
          max: 8.6,
          period: 9000000,
        },
      },
      mutualOrbit: {
        period: 377,
      },
      components: [
        {
          name: "Narym",
          kind: "body",
          deepNebula: 53.1,
          radius: 12250,
          axialTilt: 29,
          rotationPeriod: 1,
          precessionPeriod: 21049,
          orbitRadius: 5613000,
          longTermCycles: {
            obliquityVariation: {
              min: 27.3,
              max: 36.2,
              period: 76000,
            },
          },
          debugFeatures: {
            polePins: true,
          },
          visual: {
            defaultMap: "Visão Real",
            maps: {
              "Visão Real": "./Mirt.png",
              Biomas: "https://assets.babylonjs.com/environments/roof.jpg",
            },
          },
          shadowCasting: {
            Vezmar: {
              type: "annular",
              diameter: 68000,
            },
            Tharela: {
              type: "total",
              diameter: 23150,
            },
            Ciren: {
              type: "total",
              diameter: 20700,
            },
          },
          moons: [
            {
              name: "Tharela",
              kind: "body",
              deepNebula: 53.4,
              radius: 2200,
              rotationPeriod: 4,
              orbit: {
                period: 4,
                semiMajorAxis: 234000,
                inclination: 12,
                eccentricity: 0,
                nodalPrecessionPeriod: 12,
              },
              shadowCasting: {
                Narym: {
                  type: "partial",
                  diameter: 3030,
                },
                Vezmar: {
                  type: "annular",
                  diameter: 48000,
                },
                Ciren: {
                  type: "total",
                  diameter: 1930,
                },
              },
              visual: {
                defaultMap: "Visão Real",
                maps: {
                  "Visão Real": "./tharela.png",
                  Biomas: "URL_DA_TEXTURA_DE_BIOMAS_DE_THARELA",
                },
              },
            },
            {
              name: "Ciren",
              kind: "body",
              deepNebula: 53.8,
              radius: 1400,
              rotationPeriod: 19,
              orbit: {
                period: 19,
                semiMajorAxis: 656000,
                inclination: 5,
                eccentricity: 0,
                nodalPrecessionPeriod: 80,
              },
              shadowCasting: {
                Narym: {
                  type: "annular",
                  diameter: 6655,
                },
                Vezmar: {
                  type: "annular",
                  diameter: 43500,
                },
                Tharela: {
                  type: "partial",
                  diameter: 325,
                },
              },
              visual: {
                defaultMap: "Visão Real",
                maps: {
                  "Visão Real": "./ciren.png",
                  Biomas: "URL_DA_TEXTURA_DE_BIOMAS_DE_CIREN",
                },
              },
            },
          ],
        },
        {
          name: "Vezmar",
          kind: "body",
          deepNebula: 45.7,
          radius: 129150,
          axialTilt: 4,
          rotationPeriod: 11.3 / 30,
          orbitRadius: 1947000,
          shadowCasting: {
            Narym: {
              type: "total",
              diameter: 221000,
            },
            Tharela: {
              type: "total",
              diameter: 221000,
            },
            Ciren: {
              type: "total",
              diameter: 221000,
            },
          },
          visual: {
            defaultMap: "Visão Real",
            maps: {
              "Visão Real": "./vezmar.png",
              Biomas: "URL_DA_TEXTURA_DE_BIOMAS_DE_VEZMAR",
            },
          },
        },
      ],
    },
  ],
};

export const nebulaConfig = {
  name: "O Véu de Numitri",
  enabled: true,
  path: [
    {
      x: 263.98,
      y: -18.74,
      z: 40000,
    },
    {
      x: 287.03,
      y: 5.46,
      z: 39191.92,
    },
    {
      x: 278.28,
      y: -7.43,
      z: 38383.84,
    },
    {
      x: 272.95,
      y: 0.34,
      z: 37575.76,
    },
    {
      x: 255.24,
      y: 16.3,
      z: 36767.68,
    },
    {
      x: 255.24,
      y: -10.03,
      z: 35959.6,
    },
    {
      x: 251.32,
      y: -3.58,
      z: 35151.52,
    },
    {
      x: 283.65,
      y: 10.22,
      z: 34343.43,
    },
    {
      x: 273.04,
      y: -10.85,
      z: 33535.35,
    },
    {
      x: 277.32,
      y: -16.92,
      z: 32727.27,
    },
    {
      x: 249.82,
      y: -8.41,
      z: 31919.19,
    },
    {
      x: 287.8,
      y: -13.55,
      z: 31111.11,
    },
    {
      x: 282.3,
      y: 17.19,
      z: 30303.03,
    },
    {
      x: 257.49,
      y: 12.32,
      z: 29494.95,
    },
    {
      x: 256.27,
      y: 5.34,
      z: 28686.87,
    },
    {
      x: 256.34,
      y: 14.86,
      z: 27878.79,
    },
    {
      x: 261.17,
      y: 12.15,
      z: 27070.71,
    },
    {
      x: 269.99,
      y: -12.54,
      z: 26262.63,
    },
    {
      x: 266.28,
      y: 15.7,
      z: 25454.55,
    },
    {
      x: 260.65,
      y: 1.57,
      z: 24646.46,
    },
    {
      x: 273.47,
      y: 12.3,
      z: 23838.38,
    },
    {
      x: 254.58,
      y: 15.84,
      z: 23030.3,
    },
    {
      x: 260.69,
      y: -7.28,
      z: 22222.22,
    },
    {
      x: 263.65,
      y: -15.6,
      z: 21414.14,
    },
    {
      x: 267.24,
      y: -10.88,
      z: 20606.06,
    },
    {
      x: 280.41,
      y: -2.92,
      z: 19797.98,
    },
    {
      x: 256.99,
      y: 12.72,
      z: 18989.9,
    },
    {
      x: 269.57,
      y: 14.43,
      z: 18181.82,
    },
    {
      x: 272.7,
      y: -19.72,
      z: 17373.74,
    },
    {
      x: 250.86,
      y: 0.43,
      z: 16565.66,
    },
    {
      x: 273.3,
      y: -3.3,
      z: 15757.58,
    },
    {
      x: 255.82,
      y: -11.12,
      z: 14949.49,
    },
    {
      x: 251.6,
      y: -15.21,
      z: 14141.41,
    },
    {
      x: 286.96,
      y: -6.5,
      z: 13333.33,
    },
    {
      x: 287.63,
      y: 17.72,
      z: 12525.25,
    },
    {
      x: 281.34,
      y: -7.07,
      z: 11717.17,
    },
    {
      x: 261.18,
      y: 0.75,
      z: 10909.09,
    },
    {
      x: 252.91,
      y: 8.12,
      z: 10101.01,
    },
    {
      x: 276.37,
      y: -5.45,
      z: 9292.93,
    },
    {
      x: 266.61,
      y: 18.87,
      z: 8484.85,
    },
    {
      x: 253.88,
      y: 18.5,
      z: 7676.77,
    },
    {
      x: 268.81,
      y: -9.93,
      z: 6868.69,
    },
    {
      x: 250.38,
      y: -0.11,
      z: 6060.61,
    },
    {
      x: 285.37,
      y: -7.96,
      z: 5252.53,
    },
    {
      x: 259.35,
      y: -8.61,
      z: 4444.44,
    },
    {
      x: 275.5,
      y: -18.52,
      z: 3636.36,
    },
    {
      x: 261.47,
      y: 4.38,
      z: 2828.28,
    },
    {
      x: 269.8,
      y: 0.11,
      z: 2020.2,
    },
    {
      x: 270.87,
      y: -17.94,
      z: 1212.12,
    },
    {
      x: 256.39,
      y: -8.85,
      z: 404.04,
    },
    {
      x: 292.38,
      y: 11.73,
      z: -404.04,
    },
    {
      x: 280.01,
      y: -10.42,
      z: -1212.12,
    },
    {
      x: 286.58,
      y: -14.2,
      z: -2020.2,
    },
    {
      x: 284.79,
      y: -0.42,
      z: -2828.28,
    },
    {
      x: 272.92,
      y: 19.43,
      z: -3636.36,
    },
    {
      x: 285.87,
      y: -10.32,
      z: -4444.44,
    },
    {
      x: 252.54,
      y: 6.89,
      z: -5252.53,
    },
    {
      x: 256.84,
      y: 10.46,
      z: -6060.61,
    },
    {
      x: 250.81,
      y: -10.49,
      z: -6868.69,
    },
    {
      x: 262.01,
      y: 9.13,
      z: -7676.77,
    },
    {
      x: 264.55,
      y: -5.29,
      z: -8484.85,
    },
    {
      x: 259.85,
      y: 5.29,
      z: -9292.93,
    },
    {
      x: 282.15,
      y: 5.34,
      z: -10101.01,
    },
    {
      x: 263.27,
      y: 1.43,
      z: -10909.09,
    },
    {
      x: 260.24,
      y: -16.39,
      z: -11717.17,
    },
    {
      x: 270.71,
      y: 13.41,
      z: -12525.25,
    },
    {
      x: 254.64,
      y: -7.17,
      z: -13333.33,
    },
    {
      x: 281.09,
      y: -12.54,
      z: -14141.41,
    },
    {
      x: 251.98,
      y: -18.37,
      z: -14949.49,
    },
    {
      x: 288.48,
      y: 3.64,
      z: -15757.58,
    },
    {
      x: 279.89,
      y: 7.1,
      z: -16565.66,
    },
    {
      x: 256.95,
      y: -19.34,
      z: -17373.74,
    },
    {
      x: 249.22,
      y: 0.48,
      z: -18181.82,
    },
    {
      x: 281.62,
      y: -10.94,
      z: -18989.9,
    },
    {
      x: 277.27,
      y: 5.81,
      z: -19797.98,
    },
    {
      x: 278.16,
      y: -13.03,
      z: -20606.06,
    },
    {
      x: 279.85,
      y: 7.64,
      z: -21414.14,
    },
    {
      x: 251.96,
      y: -4.53,
      z: -22222.22,
    },
    {
      x: 263.34,
      y: 17.47,
      z: -23030.3,
    },
    {
      x: 253.63,
      y: -14.5,
      z: -23838.38,
    },
    {
      x: 283.52,
      y: -6.36,
      z: -24646.46,
    },
    {
      x: 273.93,
      y: -15.46,
      z: -25454.55,
    },
    {
      x: 262.24,
      y: 16.99,
      z: -26262.63,
    },
    {
      x: 251.54,
      y: 15.09,
      z: -27070.71,
    },
    {
      x: 261.44,
      y: -9.68,
      z: -27878.79,
    },
    {
      x: 262.01,
      y: 6.4,
      z: -28686.87,
    },
    {
      x: 278.18,
      y: 12.69,
      z: -29494.95,
    },
    {
      x: 274.5,
      y: 2.21,
      z: -30303.03,
    },
    {
      x: 284.49,
      y: 1.19,
      z: -31111.11,
    },
    {
      x: 267.89,
      y: -10.33,
      z: -31919.19,
    },
    {
      x: 253.78,
      y: -16.28,
      z: -32727.27,
    },
    {
      x: 277.53,
      y: 15.89,
      z: -33535.35,
    },
    {
      x: 279.43,
      y: 16.02,
      z: -34343.43,
    },
    {
      x: 271.45,
      y: 5.32,
      z: -35151.52,
    },
    {
      x: 279.84,
      y: -6.44,
      z: -35959.6,
    },
    {
      x: 268.75,
      y: -6.03,
      z: -36767.68,
    },
    {
      x: 269.91,
      y: 9.04,
      z: -37575.76,
    },
    {
      x: 266.1,
      y: 15.88,
      z: -38383.84,
    },
    {
      x: 250.02,
      y: 15.48,
      z: -39191.92,
    },
    {
      x: 253.32,
      y: 11.2,
      z: -40000,
    },
  ],

  tubeSettings: {
    radius: 30_000_000,
    tessellation: 10,
  },

  material: {
    textureUrl: "./smoke.png",
    emissiveColor: "#00CED1",
    alpha: 0.15,
  },

  fog: {
    color: "#006c6d",
    density: 0.01,
  },

  debug: {
    showPath: false,
  },
};
