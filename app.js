"use strict";

const STORAGE_KEY = "futsalRefereeTimer.match.v5";
const RED_CARD_SECONDS = 120;

let match = null;
let tickHandle = null;
let confirmationCallback = null;

const $ = (selector) => document.querySelector(selector);

const elements = {
  setupScreen: $("#setup-screen"),
  matchScreen: $("#match-screen"),
  setupForm: $("#setup-form"),

  homeName: $("#home-name"),
  homeColour: $("#home-colour"),
  awayName: $("#away-name"),
  awayColour: $("#away-colour"),
  halfMinutes: $("#half-minutes"),
  breakMinutes: $("#break-minutes"),
  timeoutMinutes: $("#timeout-minutes"),
  foulThreshold: $("#foul-threshold"),
  extraTimeEnabled: $("#extra-time-enabled"),
  extraTimeMinutes: $("#extra-time-minutes"),

  matchStatus: $("#match-status"),
  newMatchButton: $("#new-match-button"),

  homePanel: $("#home-panel"),
  awayPanel: $("#away-panel"),
  homeTitle: $("#home-team-title"),
  awayTitle: $("#away-team-title"),

  homeScore: $("#home-score"),
  awayScore: $("#away-score"),
  homeGoalButton: $("#home-goal-button"),
  awayGoalButton: $("#away-goal-button"),

  homeFoulTotal: $("#home-foul-total"),
  awayFoulTotal: $("#away-foul-total"),
  homeFoulLights: $("#home-foul-lights"),
  awayFoulLights: $("#away-foul-lights"),
  homeFoulAdd: $("#home-foul-add"),
  awayFoulAdd: $("#away-foul-add"),

  homeYellowCardTotal: $("#home-yellow-card-total"),
  awayYellowCardTotal: $("#away-yellow-card-total"),
  homeYellowButton: $("#home-yellow-button"),
  awayYellowButton: $("#away-yellow-button"),

  homeRedCardTotal: $("#home-red-card-total"),
  awayRedCardTotal: $("#away-red-card-total"),

  homeTimeoutButton: $("#home-timeout-button"),
  awayTimeoutButton: $("#away-timeout-button"),
  homeTimeoutDisplay: $("#home-timeout-display"),
  awayTimeoutDisplay: $("#away-timeout-display"),
  homeTimeoutTime: $("#home-timeout-time"),
  awayTimeoutTime: $("#away-timeout-time"),
  homeTimeoutMessage: $("#home-timeout-message"),
  awayTimeoutMessage: $("#away-timeout-message"),

  periodLabel: $("#period-label"),
  matchTimer: $("#match-timer"),
  kickoffLabel: $("#kickoff-label"),
  kickoffTeam: $("#kickoff-team"),

  startButton: $("#start-button"),
  pauseButton: $("#pause-button"),
  resetButton: $("#reset-button"),
  undoButton: $("#undo-button"),
  proceedButton: $("#proceed-button"),
  exportButton: $("#export-button"),
  eventList: $("#event-list"),

  confirmDialog: $("#confirm-dialog"),
  dialogTitle: $("#dialog-title"),
  dialogMessage: $("#dialog-message"),
  dialogConfirm: $("#dialog-confirm"),
  dialogCancel: $("#dialog-cancel"),

  alertDialog: $("#alert-dialog"),
  alertTitle: $("#alert-title"),
  alertMessage: $("#alert-message"),

  goalDialog: $("#goal-dialog"),
  goalDialogTitle: $("#goal-dialog-title"),
  goalScorerNumber: $("#goal-scorer-number"),
  goalPenalty: $("#goal-penalty"),
  goalTenMetre: $("#goal-10m"),
  goalNote: $("#goal-note"),
  goalConfirm: $("#goal-confirm"),

  yellowDialog: $("#yellow-dialog"),
  yellowDialogTitle: $("#yellow-dialog-title"),
  yellowPlayerNumber: $("#yellow-player-number"),
  yellowNote: $("#yellow-note"),
  yellowConfirm: $("#yellow-confirm"),

  redDialog: $("#red-dialog"),
  redDialogTitle: $("#red-dialog-title"),
  redPersonId: $("#red-person-id"),
  redRecipientType: $("#red-recipient-type"),
  redSlotChoice: $("#red-slot-choice"),
  redNote: $("#red-note"),
  redDialogHint: $("#red-dialog-hint"),
  redConfirm: $("#red-confirm")
};

function createTimer(seconds = 0) {
  return {
    remainingSeconds: seconds,
    running: false,
    endAt: null,
    completed: false
  };
}

function createReductionSlot() {
  return {
    status: "available",
    timer: createTimer(RED_CARD_SECONDS),
    startedAtPeriodTime: null,
    completedReason: null,
    dismissalId: null
  };
}

function createTeamData(name, colour, timeoutSeconds) {
  return {
    name,
    colour,
    score: 0,
    foulCount: 0,
    timeoutUsed: false,
    timeoutTimer: createTimer(timeoutSeconds),
    yellowCardsShown: 0,
    redCardsShown: 0,
    reductionSlots: [
      createReductionSlot(),
      createReductionSlot()
    ]
  };
}

function teamName(side) {
  const name = match.teams[side].name.trim();
  return name || (side === "home" ? "Home" : "Away");
}

function opposite(side) {
  return side === "home" ? "away" : "home";
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function nowMs() {
  return Date.now();
}

function secondsFromMinutes(value) {
  return Math.round(Number(value) * 60);
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatClockUp(elapsedSeconds) {
  const safe = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function dateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function safeFileName(text) {
  return String(text || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 50);
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function relativeLuminance(hex) {
  const rgb = hex
    .replace("#", "")
    .match(/.{1,2}/g)
    .map((part) => parseInt(part, 16) / 255);

  const linear = rgb.map((channel) => (
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));

  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastingText(hex) {
  return relativeLuminance(hex) > 0.42 ? "#111827" : "#ffffff";
}

function createMatchFromForm() {
  const firstKickoff = document.querySelector(
    'input[name="first-kickoff"]:checked'
  ).value;

  const secondKickoff = opposite(firstKickoff);
  const halfSeconds = secondsFromMinutes(elements.halfMinutes.value);
  const breakSeconds = secondsFromMinutes(elements.breakMinutes.value);
  const timeoutSeconds = secondsFromMinutes(elements.timeoutMinutes.value);
  const extraTimeSeconds = secondsFromMinutes(elements.extraTimeMinutes.value);

  return {
    version: 5,
    createdAt: new Date().toISOString(),
    endedAt: null,

    settings: {
      halfSeconds,
      breakSeconds,
      timeoutSeconds,
      foulThreshold: Number(elements.foulThreshold.value),
      extraTimeEnabled: elements.extraTimeEnabled.checked,
      extraTimeSeconds
    },

    teams: {
      home: createTeamData(
        elements.homeName.value.trim(),
        elements.homeColour.value,
        timeoutSeconds
      ),
      away: createTeamData(
        elements.awayName.value.trim(),
        elements.awayColour.value,
        timeoutSeconds
      )
    },

    period: {
      phase: "firstHalf",
      number: 1,
      matchTimer: createTimer(halfSeconds),
      breakTimer: createTimer(breakSeconds),
      firstKickoff,
      secondKickoff,
      activeKickoff: firstKickoff
    },

    incidents: {
      goals: [],
      cards: [],
      fouls: []
    },

    history: [],
    events: []
  };
}

function isMatchActive() {
  return match && match.period.phase !== "matchOver";
}

function isExtraTime() {
  return match && ["extraTime1", "extraTime2"].includes(match.period.phase);
}

function periodName() {
  if (!match) return "";

  const names = {
    firstHalf: "First Half",
    halfTime: "Half-time",
    secondHalf: "Second Half",
    extraTime1: "Extra Time – First Half",
    extraTime2: "Extra Time – Second Half",
    matchOver: "Match Over"
  };

  return names[match.period.phase] || "";
}

function currentKickoffLabel() {
  if (!match) return "";

  if (match.period.phase === "firstHalf") return "First-half kick-off";
  if (match.period.phase === "secondHalf") return "Second-half kick-off";
  if (match.period.phase === "extraTime1") return "Extra-time kick-off";
  if (match.period.phase === "extraTime2") return "Extra-time second-half kick-off";

  return "Kick-off";
}

function currentPeriodElapsedSeconds() {
  if (
    !match ||
    match.period.phase === "halfTime" ||
    match.period.phase === "matchOver"
  ) {
    return 0;
  }

  const periodLength = isExtraTime()
    ? match.settings.extraTimeSeconds
    : match.settings.halfSeconds;

  return periodLength - getLiveSeconds(match.period.matchTimer);
}

function currentPeriodTime() {
  return formatClockUp(currentPeriodElapsedSeconds());
}

function currentMatchElapsedSeconds() {
  const phase = match.period.phase;
  const halfLength = match.settings.halfSeconds;
  const extraLength = match.settings.extraTimeSeconds;
  const currentRemaining = getLiveSeconds(match.period.matchTimer);

  if (phase === "firstHalf") {
    return halfLength - currentRemaining;
  }

  if (phase === "secondHalf") {
    return halfLength + (halfLength - currentRemaining);
  }

  if (phase === "extraTime1") {
    return (2 * halfLength) + (extraLength - currentRemaining);
  }

  if (phase === "extraTime2") {
    return (2 * halfLength) + extraLength + (extraLength - currentRemaining);
  }

  return 0;
}

function currentCumulativeTime() {
  return formatClockUp(currentMatchElapsedSeconds());
}

function canUseTimeout() {
  return isMatchActive() &&
    !isExtraTime() &&
    ["firstHalf", "secondHalf"].includes(match.period.phase);
}

function setTimerRunning(timer, running) {
  if (running && !timer.running && timer.remainingSeconds > 0) {
    timer.running = true;
    timer.endAt = nowMs() + (timer.remainingSeconds * 1000);
  }

  if (!running && timer.running) {
    timer.remainingSeconds = getLiveSeconds(timer);
    timer.running = false;
    timer.endAt = null;
  }
}

function getLiveSeconds(timer) {
  if (!timer.running || !timer.endAt) {
    return Math.max(0, timer.remainingSeconds);
  }

  return Math.max(0, Math.ceil((timer.endAt - nowMs()) / 1000));
}

function refreshTimer(timer) {
  if (!timer.running) return false;

  const updated = getLiveSeconds(timer);
  const changed = updated !== timer.remainingSeconds;

  timer.remainingSeconds = updated;

  if (updated <= 0) {
    timer.running = false;
    timer.endAt = null;
    timer.completed = true;
    return true;
  }

  return changed;
}

function pauseMainClock() {
  setTimerRunning(match.period.matchTimer, false);
}

function pauseActiveReductionTimers() {
  ["home", "away"].forEach((side) => {
    match.teams[side].reductionSlots.forEach((slot) => {
      if (slot.status === "running") {
        setTimerRunning(slot.timer, false);
      }
    });
  });
}

function resumeActiveReductionTimers() {
  ["home", "away"].forEach((side) => {
    match.teams[side].reductionSlots.forEach((slot) => {
      if (
        slot.status === "running" &&
        slot.timer.remainingSeconds > 0 &&
        !slot.timer.completed
      ) {
        setTimerRunning(slot.timer, true);
      }
    });
  });
}

function startOrResumeMainClock() {
  const timer = match.period.matchTimer;

  if (
    isMatchActive() &&
    match.period.phase !== "halfTime" &&
    timer.remainingSeconds > 0 &&
    !timer.completed
  ) {
    setTimerRunning(timer, true);
    resumeActiveReductionTimers();
    startTicker();
  }
}

function hasWaitingReduction() {
  return ["home", "away"].some((side) => (
    match.teams[side].reductionSlots.some((slot) => slot.status === "waiting")
  ));
}

function firstWaitingReductionDescription() {
  for (const side of ["home", "away"]) {
    const index = match.teams[side].reductionSlots.findIndex(
      (slot) => slot.status === "waiting"
    );

    if (index >= 0) {
      return `${teamName(side)} — Reduction Slot ${index + 1}`;
    }
  }

  return "";
}

function addEvent(description, save = true) {
  match.events.push({
    at: new Date().toISOString(),
    period: periodName(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    description
  });

  if (match.events.length > 500) {
    match.events.shift();
  }

  if (save) saveMatch();
}

function snapshot(description) {
  match.history.push({
    description,
    state: deepCopy({
      teams: match.teams,
      period: match.period,
      incidents: match.incidents,
      endedAt: match.endedAt
    })
  });

  if (match.history.length > 80) {
    match.history.shift();
  }
}

function saveMatch() {
  if (!match) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
}

function loadMatch() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function clearMatch() {
  localStorage.removeItem(STORAGE_KEY);
  match = null;
  stopTicker();
}

function syncAllTimers() {
  if (!match) return;

  let changed = false;

  if (match.period.phase === "halfTime") {
    if (refreshTimer(match.period.breakTimer)) {
      changed = true;

      if (match.period.breakTimer.completed) {
        addEvent("Half-time count-down reached 0:00.", false);

        showAlert(
          "Half-time complete",
          "The half-time break has reached 0:00. Press “Start Second Half” when ready."
        );
      }
    }
  } else if (refreshTimer(match.period.matchTimer)) {
    changed = true;

    if (match.period.matchTimer.completed) {
      addEvent(`Main match clock reached 0:00 in ${periodName()}.`, false);

      showAlert(
        "Period complete",
        `${periodName()} has reached 0:00.`
      );
    }
  }

  ["home", "away"].forEach((side) => {
    const team = match.teams[side];

    if (refreshTimer(team.timeoutTimer)) {
      changed = true;

      if (team.timeoutTimer.completed) {
        addEvent(
          `${teamName(side)} time-out completed. Main clock remains stopped.`,
          false
        );

        showAlert(
          "Time-out complete",
          `${teamName(side)} time-out has reached 0:00. Resume when play restarts.`
        );
      }
    }

    team.reductionSlots.forEach((slot, index) => {
      if (slot.status !== "running") return;

      if (refreshTimer(slot.timer)) {
        changed = true;

        if (slot.timer.completed) {
          slot.status = "completed";
          slot.completedReason = "two-minute period completed";

          addEvent(
            `${teamName(side)} Reduction Slot ${index + 1} completed after two minutes of playing time.`,
            false
          );

          showAlert(
            "Player may be replaced",
            `${teamName(side)} Reduction Slot ${index + 1} has reached 0:00. Clear it when you need to reuse it.`
          );
        }
      }
    });
  });

  if (changed) saveMatch();
}

function timerIsRunningAnywhere() {
  if (!match) return false;

  if (match.period.matchTimer.running) return true;
  if (match.period.breakTimer.running) return true;

  return ["home", "away"].some((side) => {
    const team = match.teams[side];

    if (team.timeoutTimer.running) return true;

    return team.reductionSlots.some((slot) => slot.timer.running);
  });
}

function startTicker() {
  if (tickHandle) return;

  tickHandle = setInterval(() => {
    syncAllTimers();
    render();
  }, 250);
}

function stopTicker() {
  if (!tickHandle) return;

  clearInterval(tickHandle);
  tickHandle = null;
}

function restoreTimerStatesAfterLoad() {
  if (!match) return;

  syncAllTimers();

  if (timerIsRunningAnywhere()) {
    startTicker();
  }
}

function showConfirm(title, message, onConfirm, onCancel = null) {
  confirmationCallback = { onConfirm, onCancel };

  elements.dialogTitle.textContent = title;
  elements.dialogMessage.textContent = message;

  if (typeof elements.confirmDialog.showModal === "function") {
    elements.confirmDialog.showModal();
    return;
  }

  if (window.confirm(message)) {
    onConfirm();
  } else if (onCancel) {
    onCancel();
  }
}

function showAlert(title, message) {
  elements.alertTitle.textContent = title;
  elements.alertMessage.textContent = message;

  if (typeof elements.alertDialog.showModal === "function") {
    elements.alertDialog.showModal();
  } else {
    window.alert(`${title}\n\n${message}`);
  }
}

function openGoalDialog(side) {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  elements.goalDialogTitle.textContent = `Goal — ${teamName(side)}`;
  elements.goalScorerNumber.value = "";
  elements.goalPenalty.checked = false;
  elements.goalTenMetre.checked = false;
  elements.goalNote.value = "";
  elements.goalConfirm.dataset.side = side;

  elements.goalDialog.showModal();
}

function openYellowDialog(side) {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  elements.yellowDialogTitle.textContent = `Yellow Card — ${teamName(side)}`;
  elements.yellowPlayerNumber.value = "";
  elements.yellowNote.value = "";
  elements.yellowConfirm.dataset.side = side;

  elements.yellowDialog.showModal();
}

function openRedDialog(side, suggestedSlot) {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  elements.redDialogTitle.textContent = `Red Card — ${teamName(side)}`;
  elements.redPersonId.value = "";
  elements.redRecipientType.value = "player";
  elements.redSlotChoice.value = String(suggestedSlot);
  elements.redNote.value = "";
  elements.redConfirm.dataset.side = side;

  updateRedDialogFields();
  elements.redDialog.showModal();
}

function updateRedDialogFields() {
  const playerOnCourt = elements.redRecipientType.value === "player";

  elements.redSlotChoice.disabled = !playerOnCourt;

  elements.redDialogHint.textContent = playerOnCourt
    ? "A player on the court has been sent off. The match clock will stop and a two-minute reduction will wait until you start it."
    : "This red card is recorded only. No two-minute numerical-reduction timer will be created.";
}

function render() {
  if (!match) {
    elements.setupScreen.classList.remove("hidden");
    elements.matchScreen.classList.add("hidden");
    elements.matchStatus.textContent = "Pre-match setup";
    return;
  }

  elements.setupScreen.classList.add("hidden");
  elements.matchScreen.classList.remove("hidden");

  elements.homeTitle.textContent = teamName("home");
  elements.awayTitle.textContent = teamName("away");

  ["home", "away"].forEach((side) => {
    const team = match.teams[side];
    const panel = side === "home" ? elements.homePanel : elements.awayPanel;

    panel.style.background = team.colour;
    panel.style.color = contrastingText(team.colour);
  });

  elements.homeScore.textContent = match.teams.home.score;
  elements.awayScore.textContent = match.teams.away.score;
  elements.homeYellowCardTotal.textContent = match.teams.home.yellowCardsShown;
  elements.awayYellowCardTotal.textContent = match.teams.away.yellowCardsShown;
  elements.homeRedCardTotal.textContent = match.teams.home.redCardsShown;
  elements.awayRedCardTotal.textContent = match.teams.away.redCardsShown;

  elements.periodLabel.textContent = periodName();

  if (match.period.phase === "halfTime") {
    const remainingBreak = getLiveSeconds(match.period.breakTimer);

    elements.matchTimer.textContent = formatSeconds(remainingBreak);
    elements.matchTimer.classList.toggle("expired", remainingBreak === 0);

    elements.matchStatus.textContent =
      `Half-time — ${formatSeconds(remainingBreak)} remaining — ` +
      `${teamName("home")} ${match.teams.home.score}–${match.teams.away.score} ${teamName("away")}`;
  } else {
    const remainingMatch = getLiveSeconds(match.period.matchTimer);

    elements.matchTimer.textContent = formatSeconds(remainingMatch);
    elements.matchTimer.classList.toggle("expired", remainingMatch === 0);

    elements.matchStatus.textContent =
      `${periodName()} — ${formatSeconds(remainingMatch)} — ` +
      `${teamName("home")} ${match.teams.home.score}–${match.teams.away.score} ${teamName("away")}`;
  }

  elements.kickoffLabel.textContent = currentKickoffLabel();
  elements.kickoffTeam.textContent = teamName(match.period.activeKickoff);

  renderTeam("home");
  renderTeam("away");
  renderCentreControls();
  renderEventList();

  if (timerIsRunningAnywhere()) {
    startTicker();
  } else {
    stopTicker();
  }
}

function renderTeam(side) {
  const team = match.teams[side];

  const foulTotal = side === "home" ? elements.homeFoulTotal : elements.awayFoulTotal;
  const foulLights = side === "home" ? elements.homeFoulLights : elements.awayFoulLights;
  const foulButton = side === "home" ? elements.homeFoulAdd : elements.awayFoulAdd;
  const goalButton = side === "home" ? elements.homeGoalButton : elements.awayGoalButton;
  const yellowButton = side === "home" ? elements.homeYellowButton : elements.awayYellowButton;

  const timeoutButton = side === "home" ? elements.homeTimeoutButton : elements.awayTimeoutButton;
  const timeoutDisplay = side === "home" ? elements.homeTimeoutDisplay : elements.awayTimeoutDisplay;
  const timeoutTime = side === "home" ? elements.homeTimeoutTime : elements.awayTimeoutTime;
  const timeoutMessage = side === "home" ? elements.homeTimeoutMessage : elements.awayTimeoutMessage;

  const normalMatchOperation =
    isMatchActive() &&
    match.period.phase !== "halfTime";

  foulTotal.textContent = team.foulCount;
  renderFoulLights(foulLights, team.foulCount);

  foulButton.disabled = !normalMatchOperation;
  goalButton.disabled = !normalMatchOperation;
  yellowButton.disabled = !normalMatchOperation;

  timeoutButton.disabled =
    !canUseTimeout() ||
    team.timeoutUsed ||
    team.timeoutTimer.running;

  if (team.timeoutTimer.running || team.timeoutTimer.completed) {
    timeoutDisplay.classList.remove("hidden");

    const remaining = getLiveSeconds(team.timeoutTimer);
    timeoutTime.textContent = formatSeconds(remaining);

    const preSignal =
      team.timeoutTimer.running &&
      remaining > 0 &&
      remaining <= 15;

    timeoutMessage.textContent =
      team.timeoutTimer.completed
        ? "TIME-OUT COMPLETE — RESUME MATCH WHEN READY"
        : preSignal
          ? "PRE-SIGNAL"
          : "";

    timeoutMessage.classList.toggle("danger", preSignal);
  } else {
    timeoutDisplay.classList.add("hidden");
  }

  team.reductionSlots.forEach((slot, index) => {
    renderReductionSlot(side, index, slot);
  });

  renderTeamIncidentHistories(side);
}

function renderReductionSlot(side, index, slot) {
  const number = index + 1;

  const cardButton = $(`#${side}-red-${number}-card-button`);
  const display = $(`#${side}-red-${number}-display`);
  const state = $(`#${side}-red-${number}-state`);
  const time = $(`#${side}-red-${number}-time`);
  const startButton = $(`#${side}-red-${number}-start-button`);
  const goalButton = $(`#${side}-red-${number}-goal`);
  const clearButton = $(`#${side}-red-${number}-clear-button`);

  const matchUnavailable =
    !isMatchActive() ||
    match.period.phase === "halfTime";

  cardButton.disabled = matchUnavailable || slot.status !== "available";

  if (slot.status === "available") {
    display.classList.add("hidden");
    cardButton.textContent = "Red Card";
    return;
  }

  display.classList.remove("hidden");
  time.textContent = formatSeconds(getLiveSeconds(slot.timer));
  state.className = "reduction-state";

  if (slot.status === "waiting") {
    state.textContent = "Red card recorded — main clock stopped";
    state.classList.add("waiting");

    startButton.classList.remove("hidden");
    startButton.disabled = matchUnavailable;
    startButton.textContent = "Start 2:00 / Resume Match";

    goalButton.classList.add("hidden");
    clearButton.classList.add("hidden");

    cardButton.textContent = "Red Card Recorded";
    return;
  }

  if (slot.status === "running") {
    state.textContent = "Reduction active — playing time";
    state.classList.add("running");

    startButton.classList.add("hidden");
    goalButton.classList.remove("hidden");
    clearButton.classList.add("hidden");

    cardButton.textContent = "Reduction Active";
    return;
  }

  state.textContent = `Complete — ${slot.completedReason || "ready for reuse"}`;
  state.classList.add("complete");

  startButton.classList.add("hidden");
  goalButton.classList.add("hidden");

  clearButton.classList.remove("hidden");
  clearButton.disabled = matchUnavailable;

  cardButton.textContent = "Slot Ready After Clear";
}

function renderFoulLights(container, count) {
  const threshold = match.settings.foulThreshold;
  const visibleLights = Math.max(threshold, 6);

  container.innerHTML = "";

  for (let position = 1; position <= visibleLights; position += 1) {
    const light = document.createElement("span");
    light.className = "foul-light";

    if (position <= count) {
      if (position === threshold) {
        light.classList.add("active-threshold");
      } else if (position === threshold - 1) {
        light.classList.add("active-warning");
      } else {
        light.classList.add("active-normal");
      }
    }

    container.appendChild(light);
  }
}

function renderMiniHistory(container, entries, formatter) {
  container.innerHTML = "";

  if (entries.length === 0) {
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = "None recorded.";
    container.appendChild(li);
    return;
  }

  [...entries]
    .reverse()
    .forEach((entry) => {
      const li = document.createElement("li");
      const formatted = formatter(entry);

      li.textContent = formatted.text;

      if (formatted.className) {
        li.classList.add(formatted.className);
      }

      container.appendChild(li);
    });
}

function renderTeamIncidentHistories(side) {
  const goalHistory = $(`#${side}-goal-history`);
  const yellowHistory = $(`#${side}-yellow-history`);
  const redHistory = $(`#${side}-red-history`);
  const foulHistory = $(`#${side}-foul-history`);

  const goals = match.incidents.goals.filter((goal) => goal.side === side);
  const yellows = match.incidents.cards.filter(
    (card) => card.side === side && card.type === "YC"
  );
  const reds = match.incidents.cards.filter(
    (card) => card.side === side && card.type === "RC"
  );
  const fouls = match.incidents.fouls.filter((foul) => foul.side === side);

  renderMiniHistory(goalHistory, goals, (goal) => {
    const type = goal.tenMetre
      ? "10m"
      : goal.penalty
        ? "Penalty"
        : "Goal";

    const scorer = goal.scorerNumber
      ? ` No. ${goal.scorerNumber}`
      : "";

    return {
      text: `${goal.periodTime} — ${type}${scorer}`
    };
  });

  renderMiniHistory(yellowHistory, yellows, (card) => {
    const player = card.playerNumber
      ? `No. ${card.playerNumber}`
      : "Player not entered";

    const yellowCount = card.playerNumber
      ? match.incidents.cards.filter((other) => (
        other.side === side &&
        other.type === "YC" &&
        String(other.playerNumber).trim() === String(card.playerNumber).trim()
      )).length
      : 1;

    return {
      text: `${card.periodTime} — ${player}${yellowCount >= 2 ? " — 2nd YC" : ""}`,
      className: yellowCount >= 2 ? "warning-entry" : ""
    };
  });

  renderMiniHistory(redHistory, reds, (card) => {
    const recipientLabels = {
      player: "Player",
      substitute: "Substitute",
      official: "Official",
      other: "Other"
    };

    const recipient = recipientLabels[card.recipientType] || "Recipient";
    const person = card.personId ? ` ${card.personId}` : "";
    const reduction = card.requiresReduction
      ? ` — Slot ${card.reductionSlot}`
      : " — no 2:00";

    return {
      text: `${card.periodTime} — ${recipient}${person}${reduction}`
    };
  });

  renderMiniHistory(foulHistory, fouls, (foul) => {
    const threshold = match.settings.foulThreshold;

    if (foul.number === threshold) {
      return {
        text: `${foul.periodTime} — Foul ${foul.number} — 10m`,
        className: "threshold-entry"
      };
    }

    if (foul.number === threshold - 1) {
      return {
        text: `${foul.periodTime} — Foul ${foul.number} — warning`,
        className: "warning-entry"
      };
    }

    return {
      text: `${foul.periodTime} — Foul ${foul.number}`
    };
  });
}

function renderCentreControls() {
  const phase = match.period.phase;

  if (phase === "halfTime") {
    elements.startButton.disabled = true;
    elements.pauseButton.disabled = true;
    elements.pauseButton.textContent = "Pause";
    elements.resetButton.disabled = true;
    elements.undoButton.disabled = match.history.length === 0;

    elements.proceedButton.textContent = "Start Second Half";
    elements.proceedButton.disabled = false;
    return;
  }

  const timer = match.period.matchTimer;

  const fullPeriodLength = isExtraTime()
    ? match.settings.extraTimeSeconds
    : match.settings.halfSeconds;

  const periodHasNotStarted =
    !timer.running &&
    !timer.completed &&
    timer.remainingSeconds === fullPeriodLength;

  const canPauseOrResume =
    isMatchActive() &&
    !timer.completed &&
    timer.remainingSeconds > 0;

  elements.startButton.disabled =
    !isMatchActive() ||
    !periodHasNotStarted;

  elements.pauseButton.disabled = !canPauseOrResume;
  elements.pauseButton.textContent = timer.running ? "Pause" : "Resume";

  elements.resetButton.disabled = !isMatchActive();

  elements.undoButton.disabled =
    !isMatchActive() ||
    match.history.length === 0;

  if (phase === "firstHalf") {
    elements.proceedButton.textContent = "Proceed to Half-time";
    elements.proceedButton.disabled = false;
  } else if (phase === "secondHalf") {
    elements.proceedButton.textContent = match.settings.extraTimeEnabled
      ? "Proceed to Extra Time / End Match"
      : "End Match";
    elements.proceedButton.disabled = false;
  } else if (phase === "extraTime1") {
    elements.proceedButton.textContent = "Start Extra-Time Second Half";
    elements.proceedButton.disabled = false;
  } else if (phase === "extraTime2") {
    elements.proceedButton.textContent = "End Match";
    elements.proceedButton.disabled = false;
  } else {
    elements.proceedButton.textContent = "Match Over";
    elements.proceedButton.disabled = true;
  }
}

function renderEventList() {
  elements.eventList.innerHTML = "";

  const events = [...match.events].slice(-12).reverse();

  if (events.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No match events recorded yet.";
    elements.eventList.appendChild(li);
    return;
  }

  events.forEach((event) => {
    const li = document.createElement("li");

    li.textContent =
      `${formatDateTime(event.at)} | ${event.period} | ` +
      `${event.periodTime} | ${event.description}`;

    elements.eventList.appendChild(li);
  });
}

function recordFoul(side) {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  const team = match.teams[side];
  const previous = team.foulCount;
  const next = previous + 1;
  const threshold = match.settings.foulThreshold;
  const warningAt = threshold - 1;

  snapshot(`${teamName(side)} accumulated foul ${previous} → ${next}`);

  team.foulCount = next;

  const foul = {
    id: uniqueId(),
    side,
    number: next,
    period: periodName(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    recordedAt: new Date().toISOString()
  };

  match.incidents.fouls.push(foul);

  addEvent(`${teamName(side)} accumulated foul ${next} at ${foul.periodTime}.`);

  if (next === warningAt) {
    showAlert(
      "5-foul warning",
      `${teamName(side)} have reached ${warningAt} accumulated fouls.`
    );
  }

  if (next === threshold) {
    showAlert(
      "10m Free Kick",
      `${teamName(side)} have reached ${threshold} accumulated fouls.`
    );
  }

  render();
}

function recordGoal(side, details) {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  snapshot(`${teamName(side)} goal recorded`);

  match.teams[side].score += 1;

  const goal = {
    id: uniqueId(),
    side,
    scorerNumber: details.scorerNumber || "",
    penalty: Boolean(details.penalty),
    tenMetre: Boolean(details.tenMetre),
    note: details.note || "",
    period: periodName(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    recordedAt: new Date().toISOString()
  };

  match.incidents.goals.push(goal);

  const goalType = goal.tenMetre
    ? "10m free kick"
    : goal.penalty
      ? "penalty"
      : "open play";

  const scorer = goal.scorerNumber
    ? ` by No. ${goal.scorerNumber}`
    : "";

  addEvent(`${teamName(side)} goal (${goalType})${scorer}.`);
  render();
}

function countYellowCardsForPlayer(side, playerNumber) {
  if (!playerNumber) return 0;

  return match.incidents.cards.filter((card) => (
    card.side === side &&
    card.type === "YC" &&
    String(card.playerNumber).trim() === String(playerNumber).trim()
  )).length;
}

function recordYellowCard(side, playerNumber, note) {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  snapshot(`${teamName(side)} yellow card recorded`);

  match.teams[side].yellowCardsShown += 1;

  const card = {
    id: uniqueId(),
    side,
    type: "YC",
    playerNumber: playerNumber || "",
    note: note || "",
    period: periodName(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    recordedAt: new Date().toISOString()
  };

  match.incidents.cards.push(card);

  addEvent(
    `${teamName(side)} yellow card${playerNumber ? ` to No. ${playerNumber}` : ""}.`
  );

  const yellowCount = countYellowCardsForPlayer(side, playerNumber);

  render();

  if (playerNumber && yellowCount >= 2) {
    showAlert(
      "Second yellow card — send-off required",
      `${teamName(side)} player No. ${playerNumber} has received two yellow cards. The player should be shown a red card and sent off.`
    );
  }
}

function recordRedCardFromDialog() {
  const side = elements.redConfirm.dataset.side;
  const recipientType = elements.redRecipientType.value;
  const personId = elements.redPersonId.value.trim();
  const note = elements.redNote.value.trim();
  const chosenSlot = Number(elements.redSlotChoice.value);
  const requiresReduction = recipientType === "player";

  if (!side) return;

  if (requiresReduction) {
    const slot = match.teams[side].reductionSlots[chosenSlot];

    if (!slot || slot.status !== "available") {
      showAlert(
        "Reduction slot unavailable",
        `Reduction Slot ${chosenSlot + 1} is not available. Use the other free slot or clear a completed slot first.`
      );
      return;
    }
  }

  snapshot(`${teamName(side)} red card recorded`);

  const cardId = uniqueId();

  match.teams[side].redCardsShown += 1;

  if (requiresReduction) {
    pauseMainClock();
    pauseActiveReductionTimers();

    match.teams[side].reductionSlots[chosenSlot] = {
      status: "waiting",
      timer: createTimer(RED_CARD_SECONDS),
      startedAtPeriodTime: null,
      completedReason: null,
      dismissalId: cardId
    };
  }

  match.incidents.cards.push({
    id: cardId,
    side,
    type: "RC",
    personId,
    recipientType,
    requiresReduction,
    reductionSlot: requiresReduction ? chosenSlot + 1 : null,
    note,
    period: periodName(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    recordedAt: new Date().toISOString()
  });

  if (requiresReduction) {
    addEvent(
      `${teamName(side)} red card${personId ? ` to ${personId}` : ""}. Main clock paused; Reduction Slot ${chosenSlot + 1} is waiting.`
    );
  } else {
    addEvent(
      `${teamName(side)} red card to ${recipientType}${personId ? ` ${personId}` : ""}. No two-minute reduction.`
    );
  }

  elements.redDialog.close("confirm");
  render();
}

function startTimeout(side) {
  if (!canUseTimeout()) return;

  const team = match.teams[side];

  if (team.timeoutUsed || team.timeoutTimer.running) return;

  showConfirm(
    "Confirm time-out",
    `Grant a ${formatSeconds(match.settings.timeoutSeconds)} time-out to ${teamName(side)}? The main clock and active two-minute reductions will pause.`,
    () => {
      snapshot(
        `${teamName(side)} time-out started; main clock and active reductions paused`
      );

      pauseMainClock();
      pauseActiveReductionTimers();

      team.timeoutUsed = true;
      team.timeoutTimer = createTimer(match.settings.timeoutSeconds);
      setTimerRunning(team.timeoutTimer, true);

      addEvent(
        `${teamName(side)} time-out started. Main clock and active reductions paused.`
      );

      startTicker();
      render();
    }
  );
}

function startReductionAndResumeMatch(side, index) {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  const slot = match.teams[side].reductionSlots[index];

  if (slot.status !== "waiting") return;

  showConfirm(
    "Start reduction timer",
    `Start the two-minute reduction for ${teamName(side)} and resume the main match clock?`,
    () => {
      snapshot(
        `${teamName(side)} Reduction Slot ${index + 1} started and match resumed`
      );

      slot.status = "running";
      slot.startedAtPeriodTime = currentPeriodTime();

      setTimerRunning(slot.timer, true);
      startOrResumeMainClock();

      addEvent(
        `${teamName(side)} Reduction Slot ${index + 1} started. Main clock resumed.`
      );

      startTicker();
      render();
    }
  );
}

function endReductionForOpponentGoal(side, index) {
  const slot = match.teams[side].reductionSlots[index];

  if (slot.status !== "running") return;

  showConfirm(
    "Opponent goal and numerical reduction",
    `End ${teamName(side)} Reduction Slot ${index + 1} because the opponent scored? Use this only when the applicable numerical-advantage condition is met.`,
    () => {
      snapshot(
        `${teamName(side)} Reduction Slot ${index + 1} ended by opponent goal`
      );

      setTimerRunning(slot.timer, false);
      slot.timer.remainingSeconds = 0;
      slot.timer.completed = true;
      slot.status = "completed";
      slot.completedReason = "ended by opponent goal";

      addEvent(
        `${teamName(side)} Reduction Slot ${index + 1} ended early because the opponent scored.`
      );

      render();
    }
  );
}

function clearReductionSlot(side, index) {
  const slot = match.teams[side].reductionSlots[index];

  if (slot.status !== "completed") return;

  showConfirm(
    "Clear reduction slot",
    `Clear ${teamName(side)} Reduction Slot ${index + 1} for a later sending-off? The permanent red-card record remains unchanged.`,
    () => {
      snapshot(
        `${teamName(side)} Reduction Slot ${index + 1} cleared for reuse`
      );

      match.teams[side].reductionSlots[index] = createReductionSlot();

      addEvent(
        `${teamName(side)} Reduction Slot ${index + 1} cleared and ready for reuse.`
      );

      render();
    }
  );
}

function startMatchTimer() {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  const timer = match.period.matchTimer;

  const fullPeriodLength = isExtraTime()
    ? match.settings.extraTimeSeconds
    : match.settings.halfSeconds;

  const periodHasNotStarted =
    !timer.running &&
    !timer.completed &&
    timer.remainingSeconds === fullPeriodLength;

  if (!periodHasNotStarted) return;

  snapshot(`${periodName()} main match clock started`);
  startOrResumeMainClock();

  addEvent(`${periodName()} main match clock started.`);
  render();
}

function pauseResumeMatchTimer() {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  const timer = match.period.matchTimer;

  if (timer.running) {
    snapshot(`${periodName()} main clock and active reductions paused`);

    pauseMainClock();
    pauseActiveReductionTimers();

    addEvent(
      `${periodName()} main clock and active reductions paused at ${formatSeconds(timer.remainingSeconds)}.`
    );

    render();
    return;
  }

  if (timer.remainingSeconds <= 0 || timer.completed) return;

  if (hasWaitingReduction()) {
    showAlert(
      "Start the red-card reduction first",
      `A red-card reduction is waiting: ${firstWaitingReductionDescription()}. Use its “Start 2:00 / Resume Match” button to start the reduction and resume the match clock.`
    );
    return;
  }

  snapshot(`${periodName()} main clock and active reductions resumed`);

  startOrResumeMainClock();

  addEvent(`${periodName()} main clock and active reductions resumed.`);
  render();
}

function resetCurrentPeriod() {
  if (!isMatchActive() || match.period.phase === "halfTime") return;

  showConfirm(
    "Reset current period",
    `Reset ${periodName()} to its original duration? Scores, fouls, cards, time-outs, and reductions are not removed.`,
    () => {
      snapshot(`${periodName()} main clock reset`);

      const seconds = isExtraTime()
        ? match.settings.extraTimeSeconds
        : match.settings.halfSeconds;

      match.period.matchTimer = createTimer(seconds);

      addEvent(
        `${periodName()} main clock reset to ${formatSeconds(seconds)}.`
      );

      render();
    }
  );
}

function undoPreviousStep() {
  if (match.history.length === 0 || !isMatchActive()) return;

  const previous = match.history[match.history.length - 1];

  showConfirm(
    "Undo previous step",
    `Are you sure you want to undo the previous step: ${previous.description}?`,
    () => {
      const entry = match.history.pop();

      match.teams = entry.state.teams;
      match.period = entry.state.period;
      match.incidents = entry.state.incidents;
      match.endedAt = entry.state.endedAt;

      addEvent(`Undo performed: ${entry.description}.`);

      restoreTimerStatesAfterLoad();
      render();
    }
  );
}

function resetFoulsAndTimeoutsForSecondHalf() {
  ["home", "away"].forEach((side) => {
    const team = match.teams[side];

    team.foulCount = 0;
    team.timeoutUsed = false;
    team.timeoutTimer = createTimer(match.settings.timeoutSeconds);
  });
}

function enterHalfTime() {
  snapshot("Proceeded to half-time");

  pauseMainClock();
  pauseActiveReductionTimers();

  match.period.phase = "halfTime";
  match.period.number = 1;
  match.period.breakTimer = createTimer(match.settings.breakSeconds);
  match.period.activeKickoff = match.period.secondKickoff;

  setTimerRunning(match.period.breakTimer, true);

  addEvent(
    `First Half ended. Half-time count-down started from ${formatSeconds(match.settings.breakSeconds)}.`
  );

  startTicker();
  render();
}

function startSecondHalf() {
  snapshot("Started Second Half");

  setTimerRunning(match.period.breakTimer, false);

  match.period.phase = "secondHalf";
  match.period.number = 2;
  match.period.matchTimer = createTimer(match.settings.halfSeconds);
  match.period.activeKickoff = match.period.secondKickoff;

  resetFoulsAndTimeoutsForSecondHalf();

  addEvent(
    "Second Half prepared. Accumulated fouls reset and one time-out restored to each team."
  );

  render();
}

function startExtraTimeOne() {
  snapshot("Started Extra Time – First Half");

  pauseMainClock();
  pauseActiveReductionTimers();

  match.period.phase = "extraTime1";
  match.period.number = 1;
  match.period.matchTimer = createTimer(match.settings.extraTimeSeconds);

  ["home", "away"].forEach((side) => {
    match.teams[side].timeoutUsed = true;
    match.teams[side].timeoutTimer = createTimer(match.settings.timeoutSeconds);
  });

  addEvent(
    "Extra Time – First Half prepared. Second-half accumulated fouls carry over. Time-outs are unavailable."
  );

  render();
}

function startExtraTimeTwo() {
  snapshot("Started Extra Time – Second Half");

  pauseMainClock();
  pauseActiveReductionTimers();

  match.period.phase = "extraTime2";
  match.period.number = 2;
  match.period.matchTimer = createTimer(match.settings.extraTimeSeconds);
  match.period.activeKickoff = opposite(match.period.activeKickoff);

  addEvent(
    "Extra Time – Second Half prepared. Accumulated fouls continue. Time-outs remain unavailable."
  );

  render();
}

function endMatch() {
  showConfirm(
    "End match",
    "Are you sure you want to end the match? The match remains on this device for CSV export.",
    () => {
      snapshot("Match ended");

      pauseMainClock();
      pauseActiveReductionTimers();
      setTimerRunning(match.period.breakTimer, false);

      ["home", "away"].forEach((side) => {
        setTimerRunning(match.teams[side].timeoutTimer, false);
      });

      match.period.phase = "matchOver";
      match.endedAt = new Date().toISOString();

      addEvent("Match ended.");
      saveMatch();
      render();

      showAlert(
        "Match Over",
        "The match has ended. Export the CSV match log before starting another match."
      );
    }
  );
}

function proceed() {
  if (!match) return;

  if (match.period.phase === "firstHalf") {
    showConfirm(
      "Proceed to half-time",
      `End the First Half and start the ${formatSeconds(match.settings.breakSeconds)} half-time count-down?`,
      enterHalfTime
    );
    return;
  }

  if (match.period.phase === "halfTime") {
    showConfirm(
      "Start Second Half",
      "Start the Second Half? Accumulated fouls reset and each team receives one new time-out.",
      startSecondHalf
    );
    return;
  }

  if (match.period.phase === "secondHalf") {
    if (!match.settings.extraTimeEnabled) {
      endMatch();
      return;
    }

    showConfirm(
      "After the Second Half",
      "Play extra time? Select Yes to prepare the first extra-time period. Select No to end the match.",
      startExtraTimeOne,
      endMatch
    );
    return;
  }

  if (match.period.phase === "extraTime1") {
    showConfirm(
      "Start extra-time second half",
      "Proceed to the second half of extra time?",
      startExtraTimeTwo
    );
    return;
  }

  if (match.period.phase === "extraTime2") {
    endMatch();
  }
}

function exportCsv() {
  if (!match) return;

  const rows = [
    ["Futsal Referee Match Log"],
    ["Created", match.createdAt],
    ["Ended", match.endedAt || ""],
    ["Home team", teamName("home")],
    ["Away team", teamName("away")],
    ["Final score", `${match.teams.home.score}-${match.teams.away.score}`],
    ["Home yellow cards", match.teams.home.yellowCardsShown],
    ["Away yellow cards", match.teams.away.yellowCardsShown],
    ["Home red cards", match.teams.home.redCardsShown],
    ["Away red cards", match.teams.away.redCardsShown],
    [],
    ["Match Event Log"],
    ["Timestamp", "Period", "Period Time", "Cumulative Time", "Event"]
  ];

  match.events.forEach((event) => {
    rows.push([
      event.at,
      event.period,
      event.periodTime,
      event.cumulativeTime,
      event.description
    ]);
  });

  rows.push([]);
  rows.push(["Goals"]);
  rows.push([
    "Team",
    "Scorer Number",
    "Penalty Goal",
    "10m Free Kick Goal",
    "Period",
    "Period Time",
    "Cumulative Time",
    "Note"
  ]);

  match.incidents.goals.forEach((goal) => {
    rows.push([
      teamName(goal.side),
      goal.scorerNumber || "",
      goal.penalty ? "Yes" : "No",
      goal.tenMetre ? "Yes" : "No",
      goal.period,
      goal.periodTime,
      goal.cumulativeTime,
      goal.note || ""
    ]);
  });

  rows.push([]);
  rows.push(["Accumulated Fouls"]);
  rows.push([
    "Team",
    "Foul Number",
    "Period",
    "Period Time",
    "Cumulative Time"
  ]);

  match.incidents.fouls.forEach((foul) => {
    rows.push([
      teamName(foul.side),
      foul.number,
      foul.period,
      foul.periodTime,
      foul.cumulativeTime
    ]);
  });

  rows.push([]);
  rows.push(["Cards"]);
  rows.push([
    "Team",
    "Card",
    "Player / Official ID",
    "Recipient Type",
    "Two-minute Reduction",
    "Reduction Slot",
    "Period",
    "Period Time",
    "Cumulative Time",
    "Note"
  ]);

  match.incidents.cards.forEach((card) => {
    rows.push([
      teamName(card.side),
      card.type,
      card.playerNumber || card.personId || "",
      card.type === "RC" ? (card.recipientType || "") : "player",
      card.type === "RC"
        ? (card.requiresReduction ? "Yes" : "No")
        : "",
      card.type === "RC" ? (card.reductionSlot || "") : "",
      card.period,
      card.periodTime,
      card.cumulativeTime,
      card.note || ""
    ]);
  });

  const csv = rows
    .map((row) => row.map((value) => {
      const text = String(value ?? "");
      return `"${text.replaceAll('"', '""')}"`;
    }).join(","))
    .join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const home = safeFileName(teamName("home")) || "Home";
  const away = safeFileName(teamName("away")) || "Away";

  link.href = url;
  link.download = `${dateStamp()}_${home}_${away}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function beginNewMatch() {
  if (!match) return;

  showConfirm(
    "Create new match",
    "Start a new match? Export the current match log first if you need to retain it.",
    () => {
      clearMatch();
      elements.setupForm.reset();

      elements.homeColour.value = "#0ea5e9";
      elements.awayColour.value = "#ef4444";
      elements.halfMinutes.value = "20";
      elements.breakMinutes.value = "5";
      elements.timeoutMinutes.value = "1";
      elements.foulThreshold.value = "6";
      elements.extraTimeMinutes.value = "5";

      document.querySelector(
        'input[name="first-kickoff"][value="home"]'
      ).checked = true;

      render();
    }
  );
}

function initialiseEventListeners() {
  elements.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();

    match = createMatchFromForm();
    addEvent("Match created.");
    saveMatch();
    render();
  });

  elements.homeGoalButton.addEventListener("click", () => openGoalDialog("home"));
  elements.awayGoalButton.addEventListener("click", () => openGoalDialog("away"));

  elements.homeFoulAdd.addEventListener("click", () => recordFoul("home"));
  elements.awayFoulAdd.addEventListener("click", () => recordFoul("away"));

  elements.homeYellowButton.addEventListener("click", () => openYellowDialog("home"));
  elements.awayYellowButton.addEventListener("click", () => openYellowDialog("away"));

  elements.homeTimeoutButton.addEventListener("click", () => startTimeout("home"));
  elements.awayTimeoutButton.addEventListener("click", () => startTimeout("away"));

  ["home", "away"].forEach((side) => {
    [1, 2].forEach((number) => {
      const index = number - 1;

      $(`#${side}-red-${number}-card-button`).addEventListener("click", () => {
        openRedDialog(side, index);
      });

      $(`#${side}-red-${number}-start-button`).addEventListener("click", () => {
        startReductionAndResumeMatch(side, index);
      });

      $(`#${side}-red-${number}-goal`).addEventListener("click", () => {
        endReductionForOpponentGoal(side, index);
      });

      $(`#${side}-red-${number}-clear-button`).addEventListener("click", () => {
        clearReductionSlot(side, index);
      });
    });
  });

  elements.goalConfirm.addEventListener("click", () => {
    const side = elements.goalConfirm.dataset.side;
    if (!side) return;

    const penalty = elements.goalPenalty.checked;
    const tenMetre = elements.goalTenMetre.checked;

    if (penalty && tenMetre) {
      showAlert(
        "Choose one goal type",
        "A goal cannot be both a penalty goal and a 10m free-kick goal. Select one, or leave both unchecked for open play."
      );
      return;
    }

    recordGoal(side, {
      scorerNumber: elements.goalScorerNumber.value.trim(),
      penalty,
      tenMetre,
      note: elements.goalNote.value.trim()
    });

    elements.goalDialog.close("confirm");
  });

  elements.yellowConfirm.addEventListener("click", () => {
    const side = elements.yellowConfirm.dataset.side;
    const playerNumber = elements.yellowPlayerNumber.value.trim();

    if (!side) return;

    if (!playerNumber) {
      showAlert(
        "Player number required",
        "Enter the player’s number before recording a yellow card."
      );
      return;
    }

    recordYellowCard(
      side,
      playerNumber,
      elements.yellowNote.value.trim()
    );

    elements.yellowDialog.close("confirm");
  });

  elements.redRecipientType.addEventListener("change", updateRedDialogFields);

  elements.redConfirm.addEventListener("click", () => {
    recordRedCardFromDialog();
  });

  elements.startButton.addEventListener("click", startMatchTimer);
  elements.pauseButton.addEventListener("click", pauseResumeMatchTimer);
  elements.resetButton.addEventListener("click", resetCurrentPeriod);
  elements.undoButton.addEventListener("click", undoPreviousStep);
  elements.proceedButton.addEventListener("click", proceed);
  elements.exportButton.addEventListener("click", exportCsv);
  elements.newMatchButton.addEventListener("click", beginNewMatch);

  elements.dialogConfirm.addEventListener("click", () => {
    const current = confirmationCallback;
    confirmationCallback = null;

    if (current?.onConfirm) {
      setTimeout(current.onConfirm, 0);
    }
  });

  elements.dialogCancel.addEventListener("click", () => {
    const current = confirmationCallback;
    confirmationCallback = null;

    if (current?.onCancel) {
      setTimeout(current.onCancel, 0);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && match) {
      syncAllTimers();
      render();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (match) saveMatch();
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }
}

function init() {
  initialiseEventListeners();

  match = loadMatch();

  if (match && match.version !== 5) {
    localStorage.removeItem(STORAGE_KEY);
    match = null;
  }

  if (match) {
    restoreTimerStatesAfterLoad();
  }

  render();
  registerServiceWorker();
}

init();