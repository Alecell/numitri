/**
 * TODOS OS MEDIDORES E INDICADORES DEVEM SER FEITOS COM BASE NO MESMO SISTEMA
 * DE DEFINIÇÃO DE ANCORAS NO TEMPO, SEM CALCULO NEM NADA, ASSIM COMO O AJUSTE
 * NO CONTINUO ESPAÇO-TEMPO
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
 * TODO: Adicionar linhas equatoriais em vezmar de eclipse para uma maior precisão de Numve
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
          deepNebula: 85.61,
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
          debugFeatures: {
            polePins: true,
          },
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
  offsetDistance: 35000000,
  tubeSettings: {
    height: 10000,
    diameter: 90,
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
