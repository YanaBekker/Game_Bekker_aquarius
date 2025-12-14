const Game = (function () {
  const config = {
    easy: {
      vessels: 3,
      time: 300,
      maxVolume: 10,
      scoreMultiplier: 1,
      tasksPerLevel: 3,
    },
    medium: {
      vessels: 4,
      time: 240,
      maxVolume: 15,
      scoreMultiplier: 1.5,
      tasksPerLevel: 4,
    },
    hard: {
      vessels: 5,
      time: 180,
      maxVolume: 20,
      scoreMultiplier: 2,
      tasksPerLevel: 5,
    },
  };

  const secondLevelVessels = {
    easy: 4,
    medium: 5,
    hard: 6,
  };

  const state = {
    playerName: "Игрок",
    difficulty: "medium",
    currentLevel: 1,
    score: 0,
    timeLeft: 0,
    timerInterval: null,
    selectedSource: null,
    selectedTarget: null,
    vessels: [],
    targetAmount: 0,
    tasksCompleted: 0,
    gameActive: false,
    levelCompleted: false,
    showFinalResults: false,
    usedTargets: [],
    acidPresent: false,
    acidVessels: [],
    acidAmounts: [],
    glitchInterval: null,
    originalVesselCount: 0,
    minVessels: 0,
  };

  let ranking = JSON.parse(localStorage.getItem("waterSortRanking")) || [];

  const saveRanking = () => {
    const validRanking = ranking.filter(
      (item) => item && item.player && item.player.toString().trim() !== ""
    );
    localStorage.setItem("waterSortRanking", JSON.stringify(validRanking));
    ranking = validRanking;
  };

  const startGameFromMenu = () => {
    const playerName =
      document.getElementById("player-name").value.trim() || "Игрок";
    const difficulty = document.getElementById("difficulty").value;

    localStorage.setItem(
      "waterSortGameData",
      JSON.stringify({
        playerName,
        difficulty,
        action: "start",
      })
    );

    navigateTo("game");
  };

  const startGame = () => {
    const gameData = JSON.parse(localStorage.getItem("waterSortGameData"));
    if (!gameData || gameData.action !== "start") return navigateTo("start");

    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state.glitchInterval) clearInterval(state.glitchInterval);

    Object.assign(state, {
      playerName: gameData.playerName,
      difficulty: gameData.difficulty,
      currentLevel: 1,
      score: 0,
      tasksCompleted: 0,
      levelCompleted: false,
      selectedSource: null,
      selectedTarget: null,
      showFinalResults: false,
      usedTargets: [],
      gameActive: true,
      timeLeft: config[gameData.difficulty].time,
      acidPresent: false,
      acidVessels: [],
      acidAmounts: [],
      glitchInterval: null,
      originalVesselCount: 0,
      minVessels: config[gameData.difficulty].vessels,
    });

    document.getElementById("player-display").textContent = state.playerName;
    document.getElementById("difficulty-display").textContent =
      state.difficulty === "easy"
        ? "Легкий"
        : state.difficulty === "medium"
        ? "Средний"
        : "Сложный";

    updateTimerDisplay();
    initLevel();
    startTimer();
    startSpaceAnimations();
  };

  const initLevel = () => {
    state.selectedSource = null;
    state.selectedTarget = null;
    state.targetAmount = 0;
    state.acidPresent = false;
    state.acidVessels = [];
    state.acidAmounts = [];

    document.getElementById("current-level").textContent = state.currentLevel;
    document.getElementById("selected-source").textContent = "Не выбрана";
    document.getElementById("selected-target").textContent = "Не выбрана";

    updateLevelIndicators();
    generateVessels();
    generateTarget();
    updateScoreDisplay();
    unblockVesselControls();

    const nextLevelBtn = document.getElementById("next-level");
    if (nextLevelBtn) nextLevelBtn.disabled = true;

    const messageElement = document.getElementById("game-message");
    if (messageElement) {
      messageElement.classList.remove("show");
      messageElement.innerHTML = "";
    }

    setTimeout(() => {
      showMessage(`Уровень ${state.currentLevel}!`, true, "info", 2000);

      setTimeout(() => {
        if (state.currentLevel === 1) {
          showMessage(
            "Отмеряйте заданное количество воды, переливая её между сосудами",
            true,
            "info",
            3000
          );
        } else if (state.currentLevel === 2) {
          showMessage(
            "ВНИМАНИЕ: Появилась ядовитая кислота (зелёная жидкость)! Её нельзя сливать и смешивать с водой. Также добавлены новые емкости.",
            true,
            "warning",
            4000
          );
        } else if (state.currentLevel === 3) {
          showMessage(
            "УРОВЕНЬ 3: Кислота возвращается! Будьте осторожны - емкости могут появляться и исчезать каждые 10 секунд!",
            true,
            "warning",
            4000
          );

          startGlitchEffect();
        }
      }, 2100);
    }, 500);
  };

  const startGlitchEffect = () => {
    if (state.glitchInterval) clearInterval(state.glitchInterval);

    state.glitchInterval = setInterval(() => {
      if (
        !state.gameActive ||
        state.levelCompleted ||
        state.currentLevel !== 3
      ) {
        clearInterval(state.glitchInterval);
        return;
      }

      if (Math.random() < 1.3) {
        if (Math.random() > 0.5 && state.vessels.length > state.minVessels) {
          removeRandomVessel();
        } else {
          addRandomVessel();
        }
      }
    }, 1000);
  };

  const removeRandomVessel = () => {
    if (state.vessels.length <= state.minVessels) {
      showMessage(
        "Достигнуто минимальное количество емкостей",
        true,
        "info",
        3000
      );
      return;
    }

    const removableIndices = [];
    for (let i = 0; i < state.vessels.length; i++) {
      if (state.selectedSource !== i && state.selectedTarget !== i) {
        removableIndices.push(i);
      }
    }

    if (removableIndices.length === 0) return;

    const indexToRemove =
      removableIndices[Math.floor(Math.random() * removableIndices.length)];
    const vesselToRemove = state.vessels[indexToRemove];

    vesselToRemove.element.classList.add("glitch");

    setTimeout(() => {
      vesselToRemove.element.remove();

      const acidIndex = state.acidVessels.indexOf(indexToRemove);
      if (acidIndex !== -1) {
        state.acidVessels.splice(acidIndex, 1);
        for (let i = 0; i < state.acidVessels.length; i++) {
          if (state.acidVessels[i] > indexToRemove) {
            state.acidVessels[i]--;
          }
        }
      }

      state.vessels.splice(indexToRemove, 1);

      for (let i = indexToRemove; i < state.vessels.length; i++) {
        state.vessels[i].id = i;
        state.vessels[i].element.dataset.id = i;
        state.vessels[i].element.querySelector("h3").textContent = `Емкость ${
          i + 1
        }`;

        const vesselElement = state.vessels[i].element;
        const newIndex = i;
        vesselElement.replaceWith(vesselElement.cloneNode(true));
        const newElement = document.querySelector(
          `.vessel[data-id="${newIndex}"]`
        );
        newElement.addEventListener("click", (e) =>
          handleVesselClick(newIndex, e)
        );
        newElement.addEventListener("dblclick", () => quickTransfer(newIndex));
        state.vessels[i].element = newElement;
      }

      if (
        state.selectedSource !== null &&
        state.selectedSource >= indexToRemove
      ) {
        state.selectedSource--;
      }
      if (
        state.selectedTarget !== null &&
        state.selectedTarget >= indexToRemove
      ) {
        state.selectedTarget--;
      }

      showMessage(
        "Емкость исчезла из-за глюка пространства!",
        true,
        "warning",
        3500
      );
    }, 1000);
  };

  const addRandomVessel = () => {
    const difficultyConfig = config[state.difficulty];
    const vesselsContainer = document.getElementById("vessels-container");

    const newIndex = state.vessels.length;
    const hasAcid = Math.random() > 0.7;
    const capacity =
      Math.floor(Math.random() * (difficultyConfig.maxVolume - 2)) + 2;

    let initialAmount = 0;
    let acidAmount = 0;

    if (hasAcid) {
      acidAmount = Math.floor(Math.random() * (capacity * 0.7)) + 1;
      acidAmount = Math.min(acidAmount, capacity);
      initialAmount = 0;
      state.acidVessels.push(newIndex);
    } else {
      initialAmount = Math.floor(Math.random() * (capacity + 1));
    }

    const vessel = {
      id: newIndex,
      capacity,
      amount: initialAmount,
      acidAmount: acidAmount,
      element: null,
      isSource: false,
      isTarget: false,
    };

    state.vessels.push(vessel);
    if (acidAmount > 0) {
      state.acidAmounts[newIndex] = acidAmount;
    }

    const vesselElement = document.createElement("div");
    vesselElement.className = "vessel glitch-appear";
    vesselElement.dataset.id = newIndex;

    if (acidAmount > 0) {
      vesselElement.classList.add("has-acid");
    }

    vesselElement.innerHTML = `
      <div class="vessel-content">
        <div class="vessel-shape">
          ${
            initialAmount > 0
              ? `<div class="vessel-fill" style="height: ${
                  (initialAmount / capacity) * 100
                }%"></div>`
              : ""
          }
          ${
            acidAmount > 0
              ? `<div class="acid-fill" style="height: ${
                  (acidAmount / capacity) * 100
                }%"></div>`
              : ""
          }
        </div>
        <div class="vessel-info">
          <h3>Емкость ${newIndex + 1}</h3>
          <p>Вместимость: <strong>${capacity} л</strong></p>
          ${
            initialAmount > 0
              ? `<p>Вода: <strong>${initialAmount} л</strong></p>`
              : ""
          }
          ${
            acidAmount > 0
              ? `<p>Кислота: <strong class="acid-text">${acidAmount} л</strong></p>`
              : ""
          }
          <div class="vessel-status"></div>
        </div>
      </div>
    `;

    vesselElement.addEventListener("click", (e) =>
      handleVesselClick(newIndex, e)
    );
    vesselElement.addEventListener("dblclick", () => quickTransfer(newIndex));

    vesselsContainer.appendChild(vesselElement);
    vessel.element = vesselElement;

    setTimeout(() => {
      vesselElement.classList.remove("glitch-appear");
    }, 1000);

    showMessage(
      "Появилась новая емкость из-за глюка пространства!",
      true,
      "warning",
      3500
    );
  };

  const generateVessels = () => {
    const difficultyConfig = config[state.difficulty];
    const vesselsContainer = document.getElementById("vessels-container");
    vesselsContainer.innerHTML = "";
    state.vessels = [];
    state.acidVessels = [];
    state.acidAmounts = [];

    let numVessels = difficultyConfig.vessels;
    if (state.currentLevel === 2 || state.currentLevel === 3) {
      numVessels = secondLevelVessels[state.difficulty];
      state.acidPresent = true;
    } else {
      state.acidPresent = false;
    }

    state.originalVesselCount = numVessels;
    state.minVessels = numVessels;

    const baseVolumes = [];
    let maxVolume = difficultyConfig.maxVolume;

    for (let i = 0; i < numVessels; i++) {
      let volume;
      do {
        if (i === 0) {
          volume = Math.floor(Math.random() * (maxVolume - 8)) + 8;
        } else if (i === 1) {
          volume = Math.floor(Math.random() * 6) + 3;
        } else {
          const simpleVolumes = [
            2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20,
          ];
          volume =
            simpleVolumes[Math.floor(Math.random() * simpleVolumes.length)];
        }
      } while (
        baseVolumes.includes(volume) ||
        volume > maxVolume ||
        volume < 2
      );
      baseVolumes.push(volume);
    }

    baseVolumes.sort((a, b) => b - a);

    if (state.acidPresent) {
      const acidCount =
        state.difficulty === "easy" ? 1 : state.difficulty === "medium" ? 1 : 2;

      for (let i = 0; i < acidCount; i++) {
        let acidIndex;
        do {
          acidIndex = Math.floor(Math.random() * (numVessels - 2)) + 2;
        } while (state.acidVessels.includes(acidIndex));
        state.acidVessels.push(acidIndex);
      }
    }

    const targetAmount =
      state.targetAmount ||
      generateGuaranteedTarget(numVessels, baseVolumes, difficultyConfig);

    for (let i = 0; i < numVessels; i++) {
      const capacity = baseVolumes[i];
      const hasAcid = state.acidVessels.includes(i);

      let initialAmount = 0;
      let acidAmount = 0;

      if (hasAcid) {
        acidAmount = Math.min(
          Math.floor(capacity * (0.3 + Math.random() * 0.4)),
          capacity - 1
        );
        initialAmount = 0;
      } else {
        if (state.tasksCompleted === 0) {
          if (i === 0 && targetAmount <= capacity) {
            initialAmount = targetAmount;
          } else if (i === 1 && targetAmount > capacity) {
            initialAmount = Math.min(capacity, Math.floor(capacity * 0.7));
          } else {
            initialAmount = Math.floor(Math.random() * (capacity + 1));
          }
        } else {
          initialAmount =
            state.vessels[i]?.amount ||
            Math.floor(Math.random() * (capacity + 1));
        }
      }

      const vessel = {
        id: i,
        capacity,
        amount: initialAmount,
        acidAmount: acidAmount,
        element: null,
        isSource: false,
        isTarget: false,
      };
      state.vessels.push(vessel);
      if (acidAmount > 0) {
        state.acidAmounts[i] = acidAmount;
      }

      const vesselElement = document.createElement("div");
      vesselElement.className = "vessel";
      vesselElement.dataset.id = i;

      if (acidAmount > 0) {
        vesselElement.classList.add("has-acid");
      }

      vesselElement.innerHTML = `
            <div class="vessel-content">
                <div class="vessel-shape">
                    ${
                      initialAmount > 0
                        ? `<div class="vessel-fill" style="height: ${
                            (initialAmount / capacity) * 100
                          }%"></div>`
                        : ""
                    }
                    ${
                      acidAmount > 0
                        ? `<div class="acid-fill" style="height: ${
                            (acidAmount / capacity) * 100
                          }%"></div>`
                        : ""
                    }
                </div>
                <div class="vessel-info">
                    <h3>Емкость ${i + 1}</h3>
                    <p>Вместимость: <strong>${capacity} л</strong></p>
                    ${
                      initialAmount > 0
                        ? `<p>Вода: <strong>${initialAmount} л</strong></p>`
                        : ""
                    }
                    ${
                      acidAmount > 0
                        ? `<p>Кислота: <strong class="acid-text">${acidAmount} л</strong></p>`
                        : ""
                    }
                    <div class="vessel-status"></div>
                </div>
            </div>
        `;

      vesselElement.addEventListener("click", (e) => handleVesselClick(i, e));
      vesselElement.addEventListener("dblclick", () => quickTransfer(i));

      vesselsContainer.appendChild(vesselElement);
      vessel.element = vesselElement;
      updateVesselDisplay(i);
    }

    if (state.tasksCompleted === 0) {
      state.targetAmount = targetAmount;
      document.getElementById("target-amount").textContent = state.targetAmount;
      document.getElementById("target-fill").style.height = "0%";
    }
  };

  const generateGuaranteedTarget = (
    numVessels,
    capacities,
    difficultyConfig
  ) => {
    const possibleTargets = new Set();

    capacities.forEach((capacity) => {
      possibleTargets.add(capacity);
      if (capacity % 2 === 0) possibleTargets.add(capacity / 2);
      if (capacity % 3 === 0) possibleTargets.add(capacity / 3);
    });

    if (capacities.length >= 2) {
      const sum = capacities[0] + capacities[1];
      possibleTargets.add(sum);
      possibleTargets.add(Math.abs(capacities[0] - capacities[1]));
    }

    const targetArray = Array.from(possibleTargets).filter(
      (v) => v > 0 && v <= difficultyConfig.maxVolume
    );

    return targetArray.length > 0
      ? targetArray[Math.floor(Math.random() * targetArray.length)]
      : Math.floor(Math.random() * (difficultyConfig.maxVolume - 1)) + 1;
  };

  const generateTarget = () => {
    const difficultyConfig = config[state.difficulty];

    const possibleTargets = new Set();
    const validVessels = state.vessels.filter((v) => v.acidAmount === 0);

    validVessels.forEach((v) => {
      if (v.amount > 0) possibleTargets.add(v.amount);
    });

    validVessels.forEach((v) => {
      if (v.capacity > 0) possibleTargets.add(v.capacity);
    });

    for (let i = 0; i < validVessels.length; i++) {
      for (let j = i + 1; j < validVessels.length; j++) {
        const sum = validVessels[i].amount + validVessels[j].amount;
        if (sum <= difficultyConfig.maxVolume) possibleTargets.add(sum);

        const diff = Math.abs(validVessels[i].amount - validVessels[j].amount);
        if (diff > 0) possibleTargets.add(diff);

        if (
          validVessels[i].amount > 0 &&
          validVessels[j].capacity > validVessels[j].amount
        ) {
          const transfer = Math.min(
            validVessels[i].amount,
            validVessels[j].capacity - validVessels[j].amount
          );
          if (transfer > 0) {
            possibleTargets.add(validVessels[j].amount + transfer);
          }
        }
      }
    }

    const possibleValues = Array.from(possibleTargets)
      .filter((v) => v > 0 && v <= difficultyConfig.maxVolume)
      .sort((a, b) => a - b);

    const availableValues = possibleValues.filter(
      (v) => !state.usedTargets.includes(v)
    );
    const finalValues =
      availableValues.length > 0 ? availableValues : possibleValues;

    let targetAmount;
    if (finalValues.length > 0) {
      if (state.tasksCompleted < difficultyConfig.tasksPerLevel / 2) {
        const easyTargets = finalValues.filter(
          (v) => v <= difficultyConfig.maxVolume / 2
        );
        targetAmount =
          easyTargets.length > 0
            ? easyTargets[Math.floor(Math.random() * easyTargets.length)]
            : finalValues[0];
      } else {
        const hardTargets = finalValues.filter(
          (v) => v > difficultyConfig.maxVolume / 2
        );
        targetAmount =
          hardTargets.length > 0
            ? hardTargets[Math.floor(Math.random() * hardTargets.length)]
            : finalValues[finalValues.length - 1];
      }
    } else {
      targetAmount =
        Math.floor(Math.random() * (difficultyConfig.maxVolume - 1)) + 1;
    }

    state.targetAmount = targetAmount;
    if (!state.usedTargets.includes(state.targetAmount)) {
      state.usedTargets.push(state.targetAmount);
    }

    document.getElementById("target-amount").textContent = state.targetAmount;
    document.getElementById("target-fill").style.height = "0%";

    if (!isTargetAchievable()) {
      adjustVesselsForTarget();
    }
  };

  const isTargetAchievable = () => {
    const validVessels = state.vessels.filter((v) => v.acidAmount === 0);

    if (validVessels.some((v) => v.amount === state.targetAmount)) return true;
    if (
      validVessels.some(
        (v) => v.capacity === state.targetAmount && v.amount === 0
      )
    )
      return true;

    for (let i = 0; i < validVessels.length; i++) {
      for (let j = 0; j < validVessels.length; j++) {
        if (i === j) continue;

        const source = validVessels[i];
        const target = validVessels[j];

        if (source.amount > 0) {
          const availableSpace = target.capacity - target.amount;
          const transferAmount = Math.min(source.amount, availableSpace);

          if (target.amount + transferAmount === state.targetAmount)
            return true;
          if (source.amount - transferAmount === state.targetAmount)
            return true;
        }
      }
    }

    return false;
  };

  const adjustVesselsForTarget = () => {
    const validVessels = state.vessels.filter((v) => v.acidAmount === 0);

    if (validVessels.length === 0) return;

    const suitableVessel = validVessels.find(
      (v) => v.capacity >= state.targetAmount
    );
    if (suitableVessel) {
      suitableVessel.amount = state.targetAmount;
      updateVesselDisplay(suitableVessel.id);
    } else {
      const firstVessel = validVessels[0];
      const secondVessel = validVessels[1] || validVessels[0];

      if (firstVessel && secondVessel) {
        firstVessel.amount = Math.min(state.targetAmount, firstVessel.capacity);
        secondVessel.amount = state.targetAmount - firstVessel.amount;

        updateVesselDisplay(firstVessel.id);
        updateVesselDisplay(secondVessel.id);
      }
    }
  };

  const handleVesselClick = (index, event) => {
    if (event.ctrlKey || event.metaKey) selectTarget(index);
    else selectSource(index);
  };

  const selectSource = (index) => {
    if (state.selectedSource !== null) clearVessel(state.selectedSource);
    if (state.selectedTarget === index) clearVessel(index, true);

    state.selectedSource = index;
    state.vessels[index].isSource = true;
    state.vessels[index].element.classList.add("selected-source");
    updateVesselStatus(index);

    const vessel = state.vessels[index];
    const acidText =
      vessel.acidAmount > 0 ? `, кислота: ${vessel.acidAmount} л` : "";
    document.getElementById("selected-source").textContent = `Емкость ${
      index + 1
    } (${vessel.amount} л${acidText})`;
    animateVessel(index);
  };

  const selectTarget = (index) => {
    if (state.selectedTarget !== null) clearVessel(state.selectedTarget, true);
    if (state.selectedSource === index) clearVessel(index);

    state.selectedTarget = index;
    state.vessels[index].isTarget = true;
    state.vessels[index].element.classList.add("selected-target");
    updateVesselStatus(index);

    const vessel = state.vessels[index];
    const acidText =
      vessel.acidAmount > 0 ? `, кислота: ${vessel.acidAmount} л` : "";
    document.getElementById("selected-target").textContent = `Емкость ${
      index + 1
    } (${vessel.amount} л${acidText})`;
    animateVessel(index);
  };

  const clearVessel = (index, isTarget = false) => {
    state.vessels[index].isSource = false;
    state.vessels[index].isTarget = false;
    state.vessels[index].element.classList.remove(
      "selected-source",
      "selected-target"
    );
    updateVesselStatus(index);

    if (isTarget)
      document.getElementById("selected-target").textContent = "Не выбрана";
    else document.getElementById("selected-source").textContent = "Не выбрана";
  };

  const clearSelection = () => {
    if (state.selectedSource !== null) clearVessel(state.selectedSource);
    if (state.selectedTarget !== null) clearVessel(state.selectedTarget, true);
    showMessage("Выбор сброшен", true, "info", 2500);
  };

  const updateVesselStatus = (index) => {
    const statusElement =
      state.vessels[index].element.querySelector(".vessel-status");
    statusElement.className = "vessel-status";
    statusElement.textContent = "";

    if (state.vessels[index].isSource) {
      statusElement.textContent = "Источник";
      statusElement.classList.add("status-source");
    } else if (state.vessels[index].isTarget) {
      statusElement.textContent = "Цель";
      statusElement.classList.add("status-target");
    }
  };

  const swapSelection = () => {
    if (state.selectedSource === null || state.selectedTarget === null) {
      showMessage(
        "Выберите и источник, и цель для обмена",
        true,
        "error",
        3000
      );
      return;
    }

    const temp = state.selectedSource;
    state.selectedSource = state.selectedTarget;
    state.selectedTarget = temp;

    state.vessels[state.selectedSource].isSource = true;
    state.vessels[state.selectedSource].isTarget = false;
    state.vessels[state.selectedTarget].isSource = false;
    state.vessels[state.selectedTarget].isTarget = true;

    state.vessels[state.selectedSource].element.classList.replace(
      "selected-target",
      "selected-source"
    );
    state.vessels[state.selectedTarget].element.classList.replace(
      "selected-source",
      "selected-target"
    );

    updateVesselStatus(state.selectedSource);
    updateVesselStatus(state.selectedTarget);

    const sourceVessel = state.vessels[state.selectedSource];
    const targetVessel = state.vessels[state.selectedTarget];
    const sourceAcidText =
      sourceVessel.acidAmount > 0
        ? `, кислота: ${sourceVessel.acidAmount} л`
        : "";
    const targetAcidText =
      targetVessel.acidAmount > 0
        ? `, кислота: ${targetVessel.acidAmount} л`
        : "";

    document.getElementById("selected-source").textContent = `Емкость ${
      state.selectedSource + 1
    } (${sourceVessel.amount} л${sourceAcidText})`;
    document.getElementById("selected-target").textContent = `Емкость ${
      state.selectedTarget + 1
    } (${targetVessel.amount} л${targetAcidText})`;

    showMessage("Источник и цель поменялись местами", true, "info", 2500);
  };

  const quickTransfer = (targetIndex) => {
    if (state.selectedSource === null) {
      showMessage("Сначала выберите источник переливания", true, "error", 3000);
      return;
    }
    if (state.selectedSource === targetIndex) {
      showMessage(
        "Нельзя переливать воду в ту же самую емкость",
        true,
        "error",
        3000
      );
      return;
    }
    transferWaterBetweenVessels(state.selectedSource, targetIndex);
  };

  const fillSelectedVessel = () => {
    const vesselIndex =
      state.selectedSource !== null
        ? state.selectedSource
        : state.selectedTarget;
    if (vesselIndex === null)
      return showMessage("Сначала выберите емкость", true, "error", 3000);

    const vessel = state.vessels[vesselIndex];

    if (vessel.acidAmount > 0) {
      showMessage(
        "Нельзя заполнить сосуд, содержащий кислоту!",
        true,
        "error",
        3500
      );
      return;
    }

    vessel.amount = vessel.capacity;
    updateVesselDisplay(vesselIndex);
    state.score = Math.max(0, state.score - 2);
    updateScoreDisplay();
    showMessage(`Емкость ${vesselIndex + 1} заполнена`, true, "info", 2500);
  };

  const emptySelectedVessel = () => {
    const vesselIndex =
      state.selectedSource !== null
        ? state.selectedSource
        : state.selectedTarget;
    if (vesselIndex === null)
      return showMessage("Сначала выберите емкость", true, "error", 3000);

    const vessel = state.vessels[vesselIndex];

    if (vessel.acidAmount > 0) {
      showMessage("Нельзя опустошить сосуд с кислотой!", true, "error", 3500);
      return;
    }

    vessel.amount = 0;
    updateVesselDisplay(vesselIndex);
    state.score = Math.max(0, state.score - 2);
    updateScoreDisplay();
    showMessage(`Емкость ${vesselIndex + 1} опустошена`, true, "info", 2500);
  };

  const transferWater = () => {
    if (state.selectedSource === null || state.selectedTarget === null) {
      showMessage(
        "Выберите и источник, и цель для переливания",
        true,
        "error",
        3000
      );
      return;
    }
    if (state.selectedSource === state.selectedTarget) {
      showMessage(
        "Источник и цель не могут быть одной емкостью",
        true,
        "error",
        3000
      );
      return;
    }
    transferWaterBetweenVessels(state.selectedSource, state.selectedTarget);
  };

  let isTransferring = false;
  const transferWaterBetweenVessels = (sourceIndex, targetIndex) => {
    if (isTransferring) return;
    isTransferring = true;

    const source = state.vessels[sourceIndex];
    const target = state.vessels[targetIndex];

    const sourceHasAcid = source.acidAmount > 0;
    const targetHasAcid = target.acidAmount > 0;

    if (sourceHasAcid && !targetHasAcid && source.amount === 0) {
      if (target.amount > 0) {
        showMessage(
          "Нельзя переливать кислоту в сосуд с водой!",
          true,
          "error",
          3500
        );
        isTransferring = false;
        return;
      }

      const acidTransfer = Math.min(source.acidAmount, target.capacity);
      if (acidTransfer === 0) {
        showMessage("В источнике нет кислоты", true, "error", 3000);
        isTransferring = false;
        return;
      }

      source.acidAmount -= acidTransfer;
      target.acidAmount = (target.acidAmount || 0) + acidTransfer;

      updateVesselAcidDisplay(targetIndex, target.acidAmount);
      updateVesselAcidDisplay(sourceIndex, source.acidAmount);

      showMessage(`Перелито ${acidTransfer} л кислоты`, true, "warning", 3000);
    } else if (!sourceHasAcid && targetHasAcid) {
      showMessage(
        "Нельзя переливать воду в сосуд с кислотой!",
        true,
        "error",
        3500
      );
      isTransferring = false;
      return;
    } else if (sourceHasAcid && targetHasAcid) {
      const acidTransfer = Math.min(
        source.acidAmount,
        target.capacity - target.acidAmount
      );
      if (acidTransfer === 0) {
        showMessage("Недостаточно места для кислоты", true, "error", 3000);
        isTransferring = false;
        return;
      }

      source.acidAmount -= acidTransfer;
      target.acidAmount += acidTransfer;

      updateVesselAcidDisplay(targetIndex, target.acidAmount);
      updateVesselAcidDisplay(sourceIndex, source.acidAmount);

      showMessage(`Перелито ${acidTransfer} л кислоты`, true, "info", 3000);
    } else {
      if (source.amount === 0) {
        showMessage("В источнике нет воды", true, "error", 3000);
        isTransferring = false;
        return;
      }

      const availableSpace =
        target.capacity - target.amount - (target.acidAmount || 0);
      const transferAmount = Math.min(source.amount, availableSpace);

      if (transferAmount === 0) {
        showMessage("Недостаточно места", true, "error", 3000);
        isTransferring = false;
        return;
      }

      source.amount -= transferAmount;
      target.amount += transferAmount;

      showMessage(
        `Перелито ${transferAmount} л из емкости ${sourceIndex + 1} в емкость ${
          targetIndex + 1
        }`,
        true,
        "info",
        3000
      );
    }

    updateVesselDisplay(sourceIndex);
    updateVesselDisplay(targetIndex);

    animateVessel(sourceIndex, "shake");
    animateVessel(targetIndex, "bounce");

    if (state.selectedSource === sourceIndex) {
      const acidText =
        source.acidAmount > 0 ? `, кислота: ${source.acidAmount} л` : "";
      document.getElementById("selected-source").textContent = `Емкость ${
        sourceIndex + 1
      } (${source.amount} л${acidText})`;
    }
    if (state.selectedTarget === targetIndex) {
      const acidText =
        target.acidAmount > 0 ? `, кислота: ${target.acidAmount} л` : "";
      document.getElementById("selected-target").textContent = `Емкость ${
        targetIndex + 1
      } (${target.amount} л${acidText})`;
    }

    setTimeout(() => (isTransferring = false), 300);
  };

  const updateVesselAcidDisplay = (index, acidAmount) => {
    const vessel = state.vessels[index];
    const vesselInfo = vessel.element.querySelector(".vessel-info");
    const statusElement = vesselInfo.querySelector(".vessel-status");

    let acidTextElement = vessel.element.querySelector(".acid-text");

    if (acidAmount > 0) {
      if (!vessel.element.classList.contains("has-acid")) {
        vessel.element.classList.add("has-acid");
      }

      if (acidTextElement) {
        acidTextElement.textContent = `${acidAmount} л`;
      } else {
        const acidParagraph = document.createElement("p");
        acidParagraph.innerHTML = `Кислота: <strong class="acid-text">${acidAmount} л</strong>`;
        vesselInfo.insertBefore(acidParagraph, statusElement);
      }

      let acidFillElement = vessel.element.querySelector(".acid-fill");
      if (!acidFillElement) {
        acidFillElement = document.createElement("div");
        acidFillElement.className = "acid-fill";
        const vesselShape = vessel.element.querySelector(".vessel-shape");
        vesselShape.appendChild(acidFillElement);
      }
      acidFillElement.style.height = `${(acidAmount / vessel.capacity) * 100}%`;
    } else {
      if (vessel.element.classList.contains("has-acid")) {
        vessel.element.classList.remove("has-acid");
      }

      if (acidTextElement) {
        acidTextElement.parentElement.remove();
      }

      const acidFillElement = vessel.element.querySelector(".acid-fill");
      if (acidFillElement) {
        acidFillElement.remove();
      }
    }
  };

  const updateVesselDisplay = (index) => {
    const vessel = state.vessels[index];
    const fillElement = vessel.element.querySelector(".vessel-fill");
    const acidFillElement = vessel.element.querySelector(".acid-fill");
    const waterAmountElement = vessel.element.querySelector(
      ".vessel-info p:nth-child(3)"
    );
    const acidAmountElement = vessel.element.querySelector(".acid-text");
    const vesselInfo = vessel.element.querySelector(".vessel-info");
    const statusElement = vesselInfo.querySelector(".vessel-status");

    if (vessel.amount > 0) {
      if (!fillElement) {
        const vesselShape = vessel.element.querySelector(".vessel-shape");
        const newFillElement = document.createElement("div");
        newFillElement.className = "vessel-fill";
        vesselShape.appendChild(newFillElement);
      }
      const currentFillElement = vessel.element.querySelector(".vessel-fill");
      currentFillElement.style.height = `${
        (vessel.amount / vessel.capacity) * 100
      }%`;

      if (waterAmountElement) {
        waterAmountElement.innerHTML = `Вода: <strong>${vessel.amount} л</strong>`;
      } else {
        const waterParagraph = document.createElement("p");
        waterParagraph.innerHTML = `Вода: <strong>${vessel.amount} л</strong>`;
        vesselInfo.insertBefore(waterParagraph, statusElement);
      }
    } else {
      if (fillElement) {
        fillElement.remove();
      }
      if (waterAmountElement) {
        waterAmountElement.remove();
      }
    }

    if (vessel.acidAmount > 0) {
      updateVesselAcidDisplay(index, vessel.acidAmount);
    } else {
      if (vessel.element.classList.contains("has-acid")) {
        vessel.element.classList.remove("has-acid");
      }
      if (acidAmountElement) {
        acidAmountElement.parentElement.remove();
      }
      if (acidFillElement) {
        acidFillElement.remove();
      }
    }

    updateVesselStatus(index);
  };

  const checkSolution = () => {
    if (state.levelCompleted) return;

    const messageElement = document.getElementById("game-message");
    if (messageElement) {
      messageElement.classList.remove("show");
    }

    setTimeout(() => {
      let validVessels = state.vessels;
      if (state.acidPresent) {
        validVessels = state.vessels.filter((v) => v.acidAmount === 0);
      }

      const foundIndex = validVessels.findIndex(
        (v) => v.amount === state.targetAmount
      );
      const found = foundIndex !== -1;

      if (found) {
        const difficultyConfig = config[state.difficulty];
        const points =
          (100 + Math.floor(state.timeLeft / 10)) *
          difficultyConfig.scoreMultiplier;

        state.score += points;
        state.tasksCompleted++;
        updateScoreDisplay();

        animateVessel(foundIndex, "pulse");

        const targetFill = document.getElementById("target-fill");
        targetFill.style.height = "100%";

        if (state.tasksCompleted >= difficultyConfig.tasksPerLevel) {
          state.levelCompleted = true;
          document.getElementById("next-level").disabled = false;
          blockVesselControls();
          showMessage(
            `Уровень ${state.currentLevel} пройден!<br>Выполнено ${difficultyConfig.tasksPerLevel} заданий.<br>Нажмите "Следующий уровень"`,
            true,
            "success",
            4000
          );
        } else {
          showMessage(
            `Правильно! Вы отмерили ${state.targetAmount} л. +${points} очков!`,
            true,
            "success",
            3500
          );
          setTimeout(() => {
            document.getElementById("game-message").classList.remove("show");
            targetFill.style.height = "0%";
            generateTarget();
            setTimeout(
              () =>
                showMessage(
                  `Новая цель: отмерьте ${state.targetAmount} л`,
                  true,
                  "info",
                  3000
                ),
              500
            );
          }, 3500);
        }
      } else {
        const acidVesselIndex = state.vessels.findIndex(
          (v) => v.amount === state.targetAmount && v.acidAmount > 0
        );
        if (acidVesselIndex !== -1) {
          showMessage(
            `Цель достигнута, но в сосуде есть кислота! Используйте другой сосуд.`,
            true,
            "warning",
            3500
          );
        } else {
          showMessage(
            "Неправильно! Ни одна емкость не содержит нужное количество воды.",
            true,
            "error",
            3000
          );
        }

        state.score = Math.max(0, state.score - 20);
        updateScoreDisplay();
        document.getElementById("vessels-container").classList.add("shake");
        setTimeout(
          () =>
            document
              .getElementById("vessels-container")
              .classList.remove("shake"),
          500
        );
      }
    }, 100);
  };

  const blockVesselControls = () => {
    [
      "fill-btn",
      "empty-btn",
      "transfer-btn",
      "swap-btn",
      "clear-btn",
      "check-solution",
    ].forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
      }
    });

    state.vessels.forEach((vessel) => {
      if (vessel.element) {
        vessel.element.style.pointerEvents = "none";
        vessel.element.style.opacity = "0.7";
        vessel.element.style.cursor = "not-allowed";
      }
    });
  };

  const unblockVesselControls = () => {
    [
      "fill-btn",
      "empty-btn",
      "transfer-btn",
      "swap-btn",
      "clear-btn",
      "check-solution",
    ].forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "";
        btn.style.cursor = "";
      }
    });

    state.vessels.forEach((vessel, index) => {
      if (vessel.element) {
        vessel.element.style.pointerEvents = "";
        vessel.element.style.opacity = "";
        vessel.element.style.cursor = "";
      }
    });
  };

  const nextLevel = () => {
    if (!state.levelCompleted) return;

    if (state.currentLevel === 3 && state.glitchInterval) {
      clearInterval(state.glitchInterval);
      state.glitchInterval = null;
    }

    document.getElementById("game-message").classList.remove("show");
    document.getElementById("target-fill").style.height = "0%";

    state.currentLevel++;
    state.tasksCompleted = 0;
    state.selectedSource = null;
    state.selectedTarget = null;
    state.usedTargets = [];
    state.targetAmount = 0;
    state.levelCompleted = false;
    state.acidPresent = false;
    state.acidVessels = [];
    state.acidAmounts = [];

    if (state.currentLevel > 3) return completeGame();

    unblockVesselControls();
    document.getElementById("current-level").textContent = state.currentLevel;
    document.getElementById("selected-source").textContent = "Не выбрана";
    document.getElementById("selected-target").textContent = "Не выбрана";

    updateLevelIndicators();
    initLevel();
    state.timeLeft += 30;
    updateTimerDisplay();
  };

  const completeGame = () => {
    clearInterval(state.timerInterval);
    if (state.glitchInterval) clearInterval(state.glitchInterval);
    state.gameActive = false;

    if (state.timeLeft > 0) state.score += Math.floor(state.timeLeft * 2);
    updateScoreDisplay();

    const playerName =
      state.playerName && state.playerName.trim() !== ""
        ? state.playerName.trim()
        : "Игрок";

    ranking.push({
      player: playerName,
      difficulty: state.difficulty,
      score: Math.max(0, state.score),
      date: new Date().toLocaleDateString("ru-RU"),
    });

    ranking.sort((a, b) => b.score - a.score);
    if (ranking.length > 10) ranking = ranking.slice(0, 10);

    localStorage.setItem("waterSortRanking", JSON.stringify(ranking));
    localStorage.setItem(
      "waterSortGameData",
      JSON.stringify({
        playerName,
        difficulty: state.difficulty,
        score: state.score,
        action: "view-ranking",
      })
    );

    navigateTo("ranking");
  };

  const showFinalResults = () => {
    const finalPlayer = document.getElementById("final-player");
    const finalDifficulty = document.getElementById("final-difficulty");
    const finalScore = document.getElementById("final-score");
    const finalMessage = document.getElementById("final-message");
    const rankingTitle = document.getElementById("ranking-title");
    const finalResults = document.getElementById("final-results");

    if (!finalPlayer || !finalDifficulty || !finalScore) return;

    const gameData = JSON.parse(localStorage.getItem("waterSortGameData"));

    if (gameData && gameData.action === "view-ranking") {
      finalPlayer.textContent = gameData.playerName || "Игрок";
      finalDifficulty.textContent =
        gameData.difficulty === "easy"
          ? "Легкий"
          : gameData.difficulty === "medium"
          ? "Средний"
          : "Сложный";
      finalScore.textContent = gameData.score || 0;
    } else {
      finalPlayer.textContent = "Игрок";
      finalDifficulty.textContent = "Средний";
      finalScore.textContent = 0;
    }

    const scoreValue = parseInt(finalScore.textContent) || 0;
    const message =
      scoreValue > 1000
        ? "Отличный результат! Вы настоящий мастер измерений!"
        : scoreValue > 500
        ? "Хороший результат! Вы отлично справились с заданием!"
        : scoreValue > 200
        ? "Неплохой результат! Есть куда стремиться!"
        : "Попробуйте еще раз, чтобы улучшить свой результат!";

    finalMessage.textContent = message;
    if (rankingTitle) rankingTitle.textContent = "Игра завершена!";
    if (finalResults) finalResults.style.display = "block";

    displayRanking();
  };

  const displayRanking = () => {
    const rankingBody = document.getElementById("ranking-body");
    if (!rankingBody) return;

    rankingBody.innerHTML = "";

    let currentRanking;
    try {
      currentRanking =
        JSON.parse(localStorage.getItem("waterSortRanking")) || [];
    } catch {
      currentRanking = [];
    }

    const validRanking = currentRanking.filter(
      (item) => item && item.player && typeof item.score === "number"
    );

    if (validRanking.length === 0) {
      rankingBody.innerHTML = `
                <tr id="empty-ranking-row">
                    <td colspan="5" style="text-align: center; padding: 30px; color: rgba(255, 255, 255, 0.7);">
                        <i class="fas fa-trophy" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                        <p>Рейтинг пока пуст</p>
                        <p>Сыграйте в игру, чтобы занять первое место!</p>
                    </td>
                </tr>
            `;
      return;
    }

    const sortedRanking = [...validRanking].sort((a, b) => b.score - a.score);
    const gameData = JSON.parse(localStorage.getItem("waterSortGameData"));

    sortedRanking.forEach((result, i) => {
      const row = document.createElement("tr");
      const isCurrentPlayer =
        gameData &&
        gameData.action === "view-ranking" &&
        result.player === gameData.playerName &&
        Math.abs(result.score - gameData.score) < 10;

      if (isCurrentPlayer) row.className = "current-player";

      const diffText =
        result.difficulty === "easy"
          ? "Легкий"
          : result.difficulty === "hard"
          ? "Сложный"
          : "Средний";

      row.innerHTML = `
                <td>${i + 1}</td>
                <td>${result.player || "Игрок"}</td>
                <td>${diffText}</td>
                <td><strong>${result.score}</strong></td>
                <td>${
                  result.date || new Date().toLocaleDateString("ru-RU")
                }</td>
            `;

      rankingBody.appendChild(row);
    });
  };

  const updateLevelIndicators = () => {
    document.querySelectorAll(".level-dot").forEach((dot) => {
      const level = parseInt(dot.dataset.level);
      dot.classList.remove("active", "completed");
      if (level < state.currentLevel) dot.classList.add("completed");
      else if (level === state.currentLevel) dot.classList.add("active");
    });
  };

  const startTimer = () => {
    if (state.timerInterval) clearInterval(state.timerInterval);

    updateTimerDisplay();
    state.gameActive = true;

    state.timerInterval = setInterval(() => {
      if (!state.gameActive || state.levelCompleted) return;

      if (state.timeLeft > 0) {
        state.timeLeft--;
        updateTimerDisplay();

        const timerElement = document.getElementById("timer");
        if (timerElement) {
          if (state.timeLeft <= 30) {
            timerElement.style.color = "#e74c3c";
            timerElement.classList.add("pulse");
          } else {
            timerElement.style.color = "#26d0ce";
            timerElement.classList.remove("pulse");
          }
        }
      } else {
        state.timeLeft = 0;
        updateTimerDisplay();
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        timeUp();
      }
    }, 1000);
  };

  const updateTimerDisplay = () => {
    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = state.timeLeft % 60;
    const timerElement = document.getElementById("timer");
    if (timerElement)
      timerElement.textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const timeUp = () => {
    state.gameActive = false;
    if (state.glitchInterval) clearInterval(state.glitchInterval);
    showMessage("Время вышло! Игра завершена.", true, "error", 4000);
    blockVesselControls();
    state.timeLeft = 0;
    updateTimerDisplay();
    setTimeout(completeGame, 4500);
  };

  const updateScoreDisplay = () => {
    const scoreElement = document.getElementById("current-score");
    if (scoreElement) scoreElement.textContent = state.score;
  };

  let messageTimeout, hideMessageTimeout;
  const showMessage = (text, show = true, type = "info", duration = 2500) => {
    const messageElement = document.getElementById("game-message");
    if (!messageElement) return;

    if (messageTimeout) clearTimeout(messageTimeout);
    if (hideMessageTimeout) clearTimeout(hideMessageTimeout);

    messageElement.classList.remove("show");

    messageTimeout = setTimeout(() => {
      messageElement.innerHTML = text;
      messageElement.className = "message";

      if (show) {
        messageElement.classList.add("show", type);

        hideMessageTimeout = setTimeout(() => {
          if (messageElement.innerHTML === text) {
            messageElement.classList.remove("show");
          }
        }, duration);
      }
    }, 100);
  };

  const handleKeyPress = (e) => {
    if (!state.gameActive) return;

    const key = e.key.toLowerCase();
    const index = parseInt(key) - 1;

    if (index >= 0 && index < state.vessels.length) {
      if (e.altKey) selectTarget(index);
      else selectSource(index);
    } else {
      switch (key) {
        case "f":
          fillSelectedVessel();
          break;
        case "e":
          emptySelectedVessel();
          break;
        case "t":
          transferWater();
          break;
        case "s":
          swapSelection();
          break;
        case "c":
          clearSelection();
          break;
        case "enter":
          checkSolution();
          break;
        case "escape":
          restartGame();
          break;
      }
    }
  };

  const restartGame = () => {
    if (
      confirm(
        "Вы уверены, что хотите начать заново? Текущий прогресс будет потерян."
      )
    ) {
      clearInterval(state.timerInterval);
      if (state.glitchInterval) clearInterval(state.glitchInterval);
      navigateTo("start");
    }
  };

  const backToMenu = () => navigateTo("start");
  const viewRankingFromMenu = () => {
    localStorage.removeItem("waterSortGameData");
    navigateTo("ranking");
  };

  const animateVessel = (index, animation = "pulse") => {
    state.vessels[index].element.classList.add(animation);
    setTimeout(
      () => state.vessels[index].element.classList.remove(animation),
      500
    );
  };

  const init = () => {
    saveRanking();

    const setupButton = (id, handler) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", handler);
    };

    setupButton("start-game", startGameFromMenu);
    setupButton("view-ranking", viewRankingFromMenu);
    setupButton("fill-btn", fillSelectedVessel);
    setupButton("empty-btn", emptySelectedVessel);
    setupButton("transfer-btn", transferWater);
    setupButton("swap-btn", swapSelection);
    setupButton("clear-btn", clearSelection);
    setupButton("check-solution", checkSolution);
    setupButton("next-level", nextLevel);
    setupButton("restart-game", restartGame);
    setupButton("back-to-menu", backToMenu);
    setupButton("back-to-menu-game", () => {
      if (
        confirm(
          "Вы уверены, что хотите выйти в главное меню? Текущий прогресс будет потерян."
        )
      ) {
        clearInterval(state.timerInterval);
        if (state.glitchInterval) clearInterval(state.glitchInterval);
        navigateTo("start");
      }
    });

    if (window.location.pathname.includes("game.html")) {
      document.addEventListener("keydown", handleKeyPress);
    }
  };

  return { init, startGame, showFinalResults, displayRanking };
})();

const createComet = () => {
  const currentPage = window.location.pathname.split("/").pop();
  if (!["game.html", "ranking.html"].includes(currentPage)) return;

  const comet = document.createElement("div");
  comet.className = "comet";

  const startFromLeft = Math.random() > 0.5;
  const startX = startFromLeft ? -50 : window.innerWidth + 50;
  const startY = Math.random() * window.innerHeight * 0.8;
  const endX = startFromLeft ? window.innerWidth + 100 : -100;
  const endY = startY + (Math.random() * 200 - 100);

  comet.style.left = `${startX}px`;
  comet.style.top = `${startY}px`;
  comet.style.setProperty("--tx", `${endX - startX}px`);
  comet.style.setProperty("--ty", `${endY - startY}px`);

  const duration = 2 + Math.random() * 3;
  comet.style.animation = `cometFly ${duration}s linear forwards`;

  document.body.appendChild(comet);
  setTimeout(() => comet.remove(), duration * 1000 + 1000);
};

const createQuantumCat = () => {
  const currentPage = window.location.pathname.split("/").pop();
  if (!["game.html", "ranking.html"].includes(currentPage)) return;

  const cat = document.createElement("div");
  cat.className = "quantum-cat";

  const startFromLeft = Math.random() > 0.5;
  const duration = 8 + Math.random() * 6;

  cat.style.left = startFromLeft ? "-150px" : `${window.innerWidth + 150}px`;
  cat.style.transform = startFromLeft ? "scaleX(-1)" : "scaleX(1)";
  cat.style.top = `${Math.random() * (window.innerHeight - 100)}px`;
  cat.style.opacity = "0";

  document.body.appendChild(cat);

  const endX = startFromLeft ? window.innerWidth + 150 : -150;
  cat.animate(
    [
      {
        opacity: 0,
        left: cat.style.left,
        top: cat.style.top,
        transform: cat.style.transform,
      },
      { opacity: 1, offset: 0.1 },
      { opacity: 1, left: `${endX}px`, offset: 0.9 },
      { opacity: 0 },
    ],
    { duration: duration * 1000, fill: "forwards" }
  );

  setTimeout(() => cat.remove(), duration * 1000 + 1000);
};

const startSpaceAnimations = () => {
  if (window.cometInterval) clearInterval(window.cometInterval);
  if (window.catInterval) clearInterval(window.catInterval);

  setTimeout(createComet, 500);
  setTimeout(createQuantumCat, 2000);

  window.cometInterval = setInterval(() => {
    if (Math.random() > 0.3) createComet();
  }, 1500);

  window.catInterval = setInterval(() => {
    if (Math.random() > 0.7) createQuantumCat();
  }, 8000);
};

const navigateTo = (page) => {
  const pages = {
    start: "index.html",
    game: "game.html",
    ranking: "ranking.html",
  };
  if (pages[page]) window.location.href = pages[page];
};

const toggleHelpTooltip = (event) => {
  event.stopPropagation();
  const tooltip = event.target
    .closest(".help-shortcut")
    .querySelector(".help-tooltip");
  const isVisible = tooltip.style.opacity === "1";
  tooltip.style.opacity = isVisible ? "0" : "1";
  tooltip.style.visibility = isVisible ? "hidden" : "visible";
  tooltip.style.transform = isVisible ? "translateY(-10px)" : "translateY(0)";
};

document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop();

  Game.init();

  if (["index.html", ""].includes(currentPage)) startSpaceAnimations();

  if (currentPage === "game.html") Game.startGame();

  if (currentPage === "ranking.html") {
    startSpaceAnimations();
    const gameData = JSON.parse(localStorage.getItem("waterSortGameData"));

    if (gameData && gameData.action === "view-ranking") Game.showFinalResults();
    else {
      const rankingTitle = document.getElementById("ranking-title");
      if (rankingTitle) rankingTitle.textContent = "Топ игроков";
      const finalResults = document.getElementById("final-results");
      if (finalResults) finalResults.style.display = "none";
      Game.displayRanking();
    }
  }
});

// очистка localStorage
//localStorage.removeItem('waterSortRanking');
//localStorage.removeItem('waterSortGameData');
