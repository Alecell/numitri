// Crie um novo arquivo chamado calendarAnchorSystem.js

export class CalendarAnchorSystem {
  constructor(
    stateManager,
    uiController,
    updateSystemCallback,
    getSimulationTimeCallback,
    setSimulationTimeCallback
  ) {
    this.stateManager = stateManager;
    this.uiController = uiController;
    this.updateSystemState = updateSystemCallback;
    this.getSimulationTime = getSimulationTimeCallback;
    this.setSimulationTime = setSimulationTimeCallback;

    this.isDefiningMode = false;
    this.lockedYear = 0;
    this.pendingAnchor = {
      dayZeroTimestamp: null,
      dayLastTimestamp: null,
    };
    this.anchors = this.loadAllAnchors();

    // Referência para o callback da UI, para poder remover o listener depois.
    this.uiUpdateCallback = () =>
      this.uiController.updateAnchorList(this.anchors);
  }

  /**
   * Carrega todas as âncoras salvas do localStorage.
   */
  loadAllAnchors() {
    const loadedAnchors = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("calendarAnchor_")) {
        const year = key.split("_")[1];
        loadedAnchors[year] = JSON.parse(localStorage.getItem(key));
      }
    }
    return loadedAnchors;
  }

  /**
   * Inicia o modo de definição de ano.
   */
  startDefinition(currentYear) {
    this.isDefiningMode = true;
    this.lockedYear = currentYear;
    this.pendingAnchor = { dayZeroTimestamp: null, dayLastTimestamp: null };
    console.log(`Modo de Definição iniciado para o ano ${this.lockedYear}.`);
    this.uiController.updateAnchorControls(this.isDefiningMode);
  }

  /**
   * Define o timestamp para o Dia 0 do ano sendo definido.
   */
  setDayZero() {
    this.pendingAnchor.dayZeroTimestamp = this.getSimulationTime();
    console.log(
      `Dia 0 para o ano ${this.lockedYear} definido em: ${this.pendingAnchor.dayZeroTimestamp}`
    );
  }

  /**
   * Define o timestamp para o Último Dia do ano sendo definido.
   */
  setLastDay() {
    this.pendingAnchor.dayLastTimestamp = this.getSimulationTime();
    console.log(
      `Último Dia para o ano ${this.lockedYear} definido em: ${this.pendingAnchor.dayLastTimestamp}`
    );
  }

  /**
   * Salva a âncora atual, capturando o estado da simulação no Dia 0.
   */
  saveCurrentAnchor() {
    if (
      this.pendingAnchor.dayZeroTimestamp === null ||
      this.pendingAnchor.dayLastTimestamp === null
    ) {
      alert("Erro: Defina o Dia 0 e o Último Dia antes de salvar.");
      return;
    }

    // 1. Armazena o tempo atual para não interromper o usuário.
    const userCurrentTime = this.getSimulationTime();

    // 2. "Pula" para o momento exato do Dia 0 para capturar o estado.
    this.setSimulationTime(this.pendingAnchor.dayZeroTimestamp, true); // O 'true' evita recalculos desnecessarios
    this.updateSystemState(this.pendingAnchor.dayZeroTimestamp);

    // 3. Captura o estado completo.
    const stateAtDayZero = this.stateManager.captureState();

    // 4. Retorna a simulação ao tempo original do usuário.
    this.setSimulationTime(userCurrentTime, true);
    this.updateSystemState(userCurrentTime);

    // 5. Monta e persiste o objeto da âncora.
    const anchorData = {
      year: this.lockedYear,
      dayZeroTimestamp: this.pendingAnchor.dayZeroTimestamp,
      dayLastTimestamp: this.pendingAnchor.dayLastTimestamp,
      stateAtDayZero: stateAtDayZero,
    };

    const key = `calendarAnchor_${this.lockedYear}`;
    localStorage.setItem(key, JSON.stringify(anchorData));
    this.anchors[this.lockedYear] = anchorData;

    console.log(`Âncora para o ano ${this.lockedYear} salva com sucesso.`);
    this.isDefiningMode = false;
    this.uiController.updateAnchorControls(this.isDefiningMode);
    this.uiUpdateCallback(); // Atualiza a lista na UI
  }

  /**
   * Aplica uma âncora salva, restaurando o estado e pulando no tempo.
   */
  applyAnchor(year) {
    const anchor = this.anchors[year];
    if (!anchor) {
      console.error(`Âncora para o ano ${year} não encontrada.`);
      return;
    }

    this.stateManager.restoreState(anchor.stateAtDayZero);
    this.setSimulationTime(anchor.dayZeroTimestamp);
    console.log(
      `Âncora do ano ${year} aplicada. Saltando para o timestamp ${anchor.dayZeroTimestamp}.`
    );
  }

  /**
   * Exclui uma âncora salva.
   */
  deleteAnchor(year) {
    if (this.anchors[year]) {
      delete this.anchors[year];
      localStorage.removeItem(`calendarAnchor_${year}`);
      console.log(`Âncora para o ano ${year} excluída.`);
      this.uiUpdateCallback(); // Atualiza a lista na UI
    }
  }

  /**
   * Encontra a âncora mais relevante para um dado timestamp e retorna a duração do ano.
   */
  getYearDurationForTime(time) {
    let activeAnchor = null;
    let closestAnchorTime = -1;

    for (const year in this.anchors) {
      const anchor = this.anchors[year];
      // Procura a âncora cujo ano começa antes ou no tempo atual.
      if (
        anchor.dayZeroTimestamp <= time &&
        anchor.dayZeroTimestamp > closestAnchorTime
      ) {
        closestAnchorTime = anchor.dayZeroTimestamp;
        activeAnchor = anchor;
      }
    }

    if (activeAnchor) {
      // A duração do ano ancorado é a diferença entre seus timestamps.
      return activeAnchor.dayLastTimestamp - activeAnchor.dayZeroTimestamp + 1; // +1 porque o último dia está incluído
    }

    // Fallback para a duração padrão se nenhuma âncora for encontrada.
    return 754;
  }
}
