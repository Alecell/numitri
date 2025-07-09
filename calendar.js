// NOVO ARQUIVO: calendar.js

import { simulationConfig as config } from "./config.js";
import {
  calculateAlignmentMetric,
  findConjunctionTime,
} from "./orbitalMechanics.js";

// --- MÓDULO PRIVADO: EclipsePredictor ---
// Responsável por encontrar o tempo exato do eclipse de forma performática.

const eclipseCache = new Map();
const NARIM_HOURS_IN_DAY = 30.0;

const EclipsePredictor = {
  /**
   * Encontra o simulationTime exato do eclipse de Narym por Vezmar para um dado "ciclo orbital".
   * ATENÇÃO: Esta função agora delega o cálculo para a função original 'findConjunctionTime'
   * para garantir 100% de sincronia com a lógica de posicionamento da nebulosa.
   * O cache é mantido para garantir a performance e evitar chamadas repetidas à função lenta.
   * @param {number} orbitalCycle - O número do ciclo orbital (ano) a ser calculado.
   * @returns {number} O simulationTime exato do eclipse.
   */
  findEclipseTimeForCycle: function (orbitalCycle) {
    if (eclipseCache.has(orbitalCycle)) {
      return eclipseCache.get(orbitalCycle);
    }

    const binarySystem = config.planets.find((p) => p.type === "binaryPair");
    // Delega o cálculo pesado para a função já existente e validada.
    const eclipseTime = findConjunctionTime(
      orbitalCycle,
      binarySystem,
      config.scale
    );

    eclipseCache.set(orbitalCycle, eclipseTime);
    console.log(
      `%c[EclipsePredictor] Cache miss. Armazenado eclipse para ciclo ${orbitalCycle} em t=${eclipseTime.toFixed(
        4
      )}`,
      "color: orange"
    );
    return eclipseTime;
  },
};

// --- API PÚBLICA: CalendarSystem ---
// Exporta as funções que a aplicação usará.

export const CalendarSystem = {
  /**
   * Inicializa o sistema de calendário com as dependências necessárias.
   * @param {object} simulationConfig - O objeto de configuração principal.
   * @param {object} orbitalMechanicsModule - O módulo orbitalMechanics importado.
   */
  initialize: function () {
    console.log("Sistema de Calendário Analítico inicializado.");
  },

  getCalendarState: function (simulationTime) {
    if (simulationTime < 0) simulationTime = 0;

    const binarySystem = config.planets.find((p) => p.type === "binaryPair");
    const avgYearDuration = binarySystem.orbit.period;

    const estimatedCycle = Math.floor(simulationTime / avgYearDuration);
    const eclipseTimeForEstimatedCycle =
      EclipsePredictor.findEclipseTimeForCycle(estimatedCycle);

    // REGRA: O Ano Novo (Dia 1) começa no início do dia seguinte ao do eclipse.
    const startOfNewYearDay1 = Math.floor(eclipseTimeForEstimatedCycle) + 1;

    let startOfYearTime;
    let currentYear;

    if (simulationTime >= startOfNewYearDay1) {
      // Já estamos no novo ano.
      currentYear = estimatedCycle + 1;
      startOfYearTime = startOfNewYearDay1;
    } else {
      // Ainda estamos no ano anterior.
      currentYear = estimatedCycle;
      const previousEclipseTime = EclipsePredictor.findEclipseTimeForCycle(
        estimatedCycle - 1
      );
      startOfYearTime = Math.floor(previousEclipseTime) + 1;
    }

    if (currentYear <= 0) currentYear = 1;

    const timeElapsedInYear = simulationTime - startOfYearTime;
    const dayOfYear = Math.floor(timeElapsedInYear) + 1; // Dia 1 a N
    const fractionOfDay = timeElapsedInYear - Math.floor(timeElapsedInYear);

    const totalMinutesInDay = NARIM_HOURS_IN_DAY * 60;
    const currentMinuteOfDay = Math.floor(fractionOfDay * totalMinutesInDay);

    const hour = Math.floor(currentMinuteOfDay / 60);
    const minute = currentMinuteOfDay % 60;

    return { ano: currentYear, dia: dayOfYear, hora: hour, minuto: minute };
  },

  /**
   * Converte uma data {ano, dia, ...} para o simulationTime correspondente.
   * @param {{year: number, day: number, hour: number, minute: number}} date
   * @returns {number} O simulationTime correspondente.
   */
  getSimulationTimeFromDate: function ({ year, day, hour, minute }) {
    // O "Ciclo N-1" define o início do "Ano N".
    const eclipseTimeForPreviousCycle =
      EclipsePredictor.findEclipseTimeForCycle(year - 1);

    // REGRA: O Ano N começa no início do dia seguinte ao dia do eclipse do ciclo N-1.
    const startOfTargetYearTime = Math.floor(eclipseTimeForPreviousCycle) + 1;

    const timeFromDays = day > 0 ? day - 1 : 0;
    const timeFromHours = hour / NARIM_HOURS_IN_DAY;
    const timeFromMinutes = minute / (NARIM_HOURS_IN_DAY * 60);

    return (
      startOfTargetYearTime + timeFromDays + timeFromHours + timeFromMinutes
    );
  },
};
