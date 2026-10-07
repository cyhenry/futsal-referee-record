"use strict";

const STORAGE_KEY = "futsalRefereeTimer.match.v6";
const RED_CARD_SECONDS = 120;

let match = null;
let tickHandle = null;
let confirmationCallback = null;
let wakeLockSentinel = null;
let wakeLockRequested = false;
let pendingOpponentGoal = null;

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
  fullTimeBreakMinutes: $("#full-time-break-minutes"),
  extraTimeBreakMinutes: $("#extra-time-break-minutes"),
  psoEnabled: $("#pso-enabled"),
  psoRounds: $("#pso-rounds"),

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
homeFoulOverflow: $("#home-foul-overflow"),
awayFoulOverflow: $("#away-foul-overflow"),
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
  wakeLockButton: $("#wake-lock-button"),
  wakeLockStatus: $("#wake-lock-status"),
  eventList: $("#event-list"),

  psoPanel: $("#pso-panel"),
  psoStatus: $("#pso-status"),
  psoHomeName: $("#pso-home-name"),
  psoAwayName: $("#pso-away-name"),
  psoHomeScore: $("#pso-home-score"),
  psoAwayScore: $("#pso-away-score"),
  psoHomeKicks: $("#pso-home-kicks"),
  psoAwayKicks: $("#pso-away-kicks"),
  psoSetupControls: $("#pso-setup-controls"),
  psoKickControls: $("#pso-kick-controls"),
  psoFirstHome: $("#pso-first-home"),
  psoFirstAway: $("#pso-first-away"),
  psoNextTeam: $("#pso-next-team"),
  psoTakerNumber: $("#pso-taker-number"),
  psoRecordKick: $("#pso-record-kick"),
  psoSuddenDeath: $("#pso-sudden-death"),

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
  goalType: $("#goal-type"),
  goalNote: $("#goal-note"),
  goalConfirm: $("#goal-confirm"),

  yellowDialog: $("#yellow-dialog"),
  yellowDialogTitle: $("#yellow-dialog-title"),
  yellowPlayerNumber: $("#yellow-player-number"),
  yellowNote: $("#yellow-note"),
  yellowConfirm: $("#yellow-confirm"),

  secondYellowDialog: $("#second-yellow-dialog"),
  secondYellowMessage: $("#second-yellow-message"),
  secondYellowRed: $("#second-yellow-red"),

  redDialog: $("#red-dialog"),
  redDialogTitle: $("#red-dialog-title"),
  redPersonId: $("#red-person-id"),
  redRecipientType: $("#red-recipient-type"),
  redDogsoRow: $("#red-dogso-row"),
  redDogso: $("#red-dogso"),
  redSlotChoice: $("#red-slot-choice"),
  redNote: $("#red-note"),
  redDialogHint: $("#red-dialog-hint"),
  redConfirm: $("#red-confirm"),

  opponentGoalDialog: $("#opponent-goal-dialog"),
  opponentGoalAdd: $("#opponent-goal-add"),
  opponentGoalRecorded: $("#opponent-goal-recorded"),

  etCoinDialog: $("#et-coin-dialog"),
  etCoinHome: $("#et-coin-home"),
  etCoinAway: $("#et-coin-away")
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
    startedAtPhase: null,
    completedReason: null,
    dismissalId: null,
    source: null
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

function createMatchFromForm() {
  const firstKickoff = document.querySelector(
    'input[name="first-kickoff"]:checked'
  ).value;

  const halfSeconds = secondsFromMinutes(elements.halfMinutes.value);
  const breakSeconds = secondsFromMinutes(elements.breakMinutes.value);
  const timeoutSeconds = secondsFromMinutes(elements.timeoutMinutes.value);

  return {
    version: 6,
    createdAt: new Date().toISOString(),
    endedAt: null,

    settings: {
      halfSeconds,
      halfTimeBreakSeconds: breakSeconds,
      timeoutSeconds,
      foulThreshold: Number(elements.foulThreshold.value),

      extraTimeEnabled: elements.extraTimeEnabled.checked,
      extraTimeSeconds: secondsFromMinutes(elements.extraTimeMinutes.value),
      fullTimeBreakSeconds: secondsFromMinutes(elements.fullTimeBreakMinutes.value),
      extraTimeBreakSeconds: secondsFromMinutes(elements.extraTimeBreakMinutes.value),

      psoEnabled: elements.psoEnabled.checked,
      psoRounds: Number(elements.psoRounds.value)
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
      matchTimer: createTimer(halfSeconds),
      breakTimer: createTimer(0),
      firstKickoff,
      secondKickoff: opposite(firstKickoff),
      extraTimeFirstKickoff: null,
      activeKickoff: firstKickoff
    },

    incidents: {
      goals: [],
      fouls: [],
      cards: [],
      psoKicks: []
    },

    pso: {
      active: false,
      completed: false,
      firstTeam: null,
      nextTeam: null,
      suddenDeath: false,
      winner: null
    },

    history: [],
    events: []
  };
}

function teamName(side) {
  const name = match.teams[side].name.trim();
  return name || (side === "home" ? "Home" : "Away");
}

function opposite(side) {
  return side === "home" ? "away" : "home";
}

function uniqueId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
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
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
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

function isLivePhase() {
  return [
    "firstHalf",
    "secondHalf",
    "extraTime1",
    "extraTime2"
  ].includes(match?.period.phase);
}

function isBreakPhase() {
  return [
    "halfTime",
    "fullTimeBreak",
    "extraTimeHalfTime"
  ].includes(match?.period.phase);
}

function isAfterMatchPhase() {
  return ["matchOver", "psoSetup", "pso"].includes(match?.period.phase);
}

function isMatchActive() {
  return match && !["matchOver", "psoSetup", "pso"].includes(match.period.phase);
}

function isExtraTime() {
  return ["extraTime1", "extraTime2"].includes(match?.period.phase);
}

function phaseCode() {
  const codes = {
    firstHalf: "1st",
    halfTime: "HT",
    secondHalf: "2nd",
    fullTimeBreak: "FT",
    extraTime1: "ET1",
    extraTimeHalfTime: "HTET",
    extraTime2: "ET2",
    psoSetup: "PSO",
    pso: "PSO",
    matchOver: "AM"
  };

  return codes[match?.period.phase] || "";
}

function phaseName() {
  const names = {
    firstHalf: "First Half",
    halfTime: "Half-time",
    secondHalf: "Second Half",
    fullTimeBreak: "Full-time Break",
    extraTime1: "Extra Time – First Half",
    extraTimeHalfTime: "Extra-time Half-time",
    extraTime2: "Extra Time – Second Half",
    psoSetup: "Penalty Shoot-out Setup",
    pso: "Penalty Shoot-out",
    matchOver: "After Match"
  };

  return names[match?.period.phase] || "";
}

function currentKickoffLabel() {
  const phase = match.period.phase;

  if (phase === "firstHalf") return "First-half kick-off";
  if (phase === "secondHalf") return "Second-half kick-off";
  if (phase === "extraTime1") return "Extra-time first-half kick-off";
  if (phase === "extraTime2") return "Extra-time second-half kick-off";

  return "Kick-off";
}

function periodLengthSeconds() {
  if (isExtraTime()) return match.settings.extraTimeSeconds;
  return match.settings.halfSeconds;
}

function currentPeriodTime() {
  if (!isLivePhase()) return "";

  const elapsed = periodLengthSeconds() - getLiveSeconds(match.period.matchTimer);
  return formatClockUp(elapsed);
}

function currentCumulativeTime() {
  if (!isLivePhase()) return "";

  const regular = match.settings.halfSeconds;
  const extra = match.settings.extraTimeSeconds;
  const remaining = getLiveSeconds(match.period.matchTimer);

  if (match.period.phase === "firstHalf") {
    return formatClockUp(regular - remaining);
  }

  if (match.period.phase === "secondHalf") {
    return formatClockUp(regular + (regular - remaining));
  }

  if (match.period.phase === "extraTime1") {
    return formatClockUp((2 * regular) + (extra - remaining));
  }

  if (match.period.phase === "extraTime2") {
    return formatClockUp((2 * regular) + extra + (extra - remaining));
  }

  return "";
}

function canUseTimeout() {
  return ["firstHalf", "secondHalf"].includes(match?.period.phase);
}

function canRecordGoalOrFoul() {
  return isLivePhase();
}

function canRecordCards() {
  return Boolean(match) && match.period.phase !== "pso";
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

function stopReductionsAtPeriodEnd(reason) {
  ["home", "away"].forEach((side) => {
    match.teams[side].reductionSlots.forEach((slot) => {
      if (slot.status === "running" || slot.status === "waiting") {
        setTimerRunning(slot.timer, false);
        slot.status = "completed";
        slot.completedReason = reason;
      }
    });
  });
}

function activatePendingReductionsForNextPeriod() {
  ["home", "away"].forEach((side) => {
    match.teams[side].reductionSlots.forEach((slot) => {
      if (slot.status === "pendingNextPeriod") {
        slot.status = "waiting";
        slot.source = "nextPeriod";
      }
    });
  });
}

function startOrResumeMainClock() {
  const timer = match.period.matchTimer;

  if (
    isLivePhase() &&
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

function snapshot(description) {
  match.history.push({
    description,
    state: deepCopy({
      teams: match.teams,
      period: match.period,
      incidents: match.incidents,
      pso: match.pso,
      endedAt: match.endedAt
    })
  });

  if (match.history.length > 100) {
    match.history.shift();
  }
}

function addEvent(description, save = true) {
  match.events.push({
    at: new Date().toISOString(),
    phase: phaseCode(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    description
  });

  if (match.events.length > 600) {
    match.events.shift();
  }

  if (save) saveMatch();
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

  if (isBreakPhase()) {
    if (refreshTimer(match.period.breakTimer)) {
      changed = true;

      if (match.period.breakTimer.completed) {
        addEvent(`${phaseName()} count-down reached 0:00.`, false);

        showAlert(
          "Break complete",
          `${phaseName()} has reached 0:00. Proceed when the teams are ready.`
        );
      }
    }
  } else if (isLivePhase() && refreshTimer(match.period.matchTimer)) {
    changed = true;

    if (match.period.matchTimer.completed) {
      addEvent(`${phaseName()} match clock reached 0:00.`, false);

      showAlert(
        "Period complete",
        `${phaseName()} has reached 0:00.`
      );
    }
  }

  ["home", "away"].forEach((side) => {
    const team = match.teams[side];

    if (refreshTimer(team.timeoutTimer)) {
      changed = true;

      if (team.timeoutTimer.completed) {
        addEvent(`${teamName(side)} time-out completed. Main clock remains stopped.`, false);

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
            `${teamName(side)} Reduction Slot ${index + 1} has reached 0:00. Clear it when ready for reuse.`
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
    return team.timeoutTimer.running ||
      team.reductionSlots.some((slot) => slot.timer.running);
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
  elements.confirmDialog.showModal();
}

function showAlert(title, message) {
  elements.alertTitle.textContent = title;
  elements.alertMessage.textContent = message;
  elements.alertDialog.showModal();
}

function showSecondYellowWarning(side, playerNumber) {
  elements.secondYellowMessage.textContent =
    `${teamName(side)} player No. ${playerNumber} has received a second yellow card and must be sent off.`;

  elements.secondYellowRed.dataset.side = side;
  elements.secondYellowRed.dataset.playerNumber = playerNumber;

  elements.secondYellowDialog.showModal();
}

function updateWakeLockUi(message = null, type = "") {
  const supported = "wakeLock" in navigator;

  elements.wakeLockButton.classList.remove("active");
  elements.wakeLockStatus.classList.remove("active", "warning");

  if (!supported) {
    elements.wakeLockButton.disabled = true;
    elements.wakeLockButton.textContent = "Screen Lock Unavailable";
    elements.wakeLockStatus.textContent =
      "This browser does not support keeping the screen awake.";
    elements.wakeLockStatus.classList.add("warning");
    return;
  }

  if (wakeLockSentinel && !wakeLockSentinel.released) {
    elements.wakeLockButton.disabled = false;
    elements.wakeLockButton.textContent = "Screen On ✓";
    elements.wakeLockButton.setAttribute("aria-pressed", "true");
    elements.wakeLockButton.classList.add("active");
    elements.wakeLockStatus.textContent =
      message || "Screen wake lock active while app remains visible.";
    elements.wakeLockStatus.classList.add("active");
    return;
  }

  elements.wakeLockButton.disabled = false;
  elements.wakeLockButton.textContent = "Keep Screen On";
  elements.wakeLockButton.setAttribute("aria-pressed", "false");
  elements.wakeLockStatus.textContent = message || "Screen may sleep normally.";

  if (type === "warning") {
    elements.wakeLockStatus.classList.add("warning");
  }
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    updateWakeLockUi("This browser does not support keeping the screen awake.", "warning");
    return false;
  }

  if (document.visibilityState !== "visible") {
    updateWakeLockUi("Return to the app to activate screen lock.", "warning");
    return false;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");

    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;

      if (wakeLockRequested && match && document.visibilityState === "visible") {
        updateWakeLockUi("Screen lock was released. Trying again when possible.", "warning");
      } else {
        updateWakeLockUi();
      }
    });

    updateWakeLockUi();
    return true;
  } catch (error) {
    wakeLockSentinel = null;
    updateWakeLockUi(
      "Could not keep screen on. Check battery saver or browser permissions.",
      "warning"
    );
    console.warn("Wake lock request failed:", error);
    return false;
  }
}

async function releaseWakeLock() {
  wakeLockRequested = false;

  if (!wakeLockSentinel) {
    updateWakeLockUi();
    return;
  }

  try {
    await wakeLockSentinel.release();
  } catch (error) {
    console.warn("Wake lock release failed:", error);
  } finally {
    wakeLockSentinel = null;
    updateWakeLockUi();
  }
}

async function toggleWakeLock() {
  if (wakeLockSentinel && !wakeLockSentinel.released) {
    await releaseWakeLock();
    return;
  }

  wakeLockRequested = true;
  await requestWakeLock();
}

async function restoreWakeLockIfNeeded() {
  if (
    wakeLockRequested &&
    document.visibilityState === "visible" &&
    (!wakeLockSentinel || wakeLockSentinel.released)
  ) {
    await requestWakeLock();
  }
}

function openGoalDialog(scoringSide, options = {}) {
  if (!canRecordGoalOrFoul()) return;

  elements.goalDialogTitle.textContent = `Goal — ${teamName(scoringSide)}`;
  elements.goalScorerNumber.value = options.scorerNumber || "";
  elements.goalType.value = options.goalType || "openPlay";
  elements.goalNote.value = options.note || "";

  elements.goalConfirm.dataset.scoringSide = scoringSide;
  elements.goalConfirm.dataset.ownGoalSide = options.ownGoalSide || "";
  elements.goalConfirm.dataset.afterOpponentGoal = options.afterOpponentGoal ? "true" : "";

  elements.goalDialog.showModal();
}

function openYellowDialog(side) {
  if (!canRecordCards()) return;

  elements.yellowDialogTitle.textContent = `Yellow Card — ${teamName(side)}`;
  elements.yellowPlayerNumber.value = "";
  elements.yellowNote.value = "";
  elements.yellowConfirm.dataset.side = side;

  elements.yellowDialog.showModal();
}

function openRedDialog(side, suggestedSlot = 0, options = {}) {
  if (!canRecordCards()) return;

  elements.redDialogTitle.textContent = `Red Card — ${teamName(side)}`;
  elements.redPersonId.value = options.personId || "";
  elements.redRecipientType.value = options.recipientType || "player";
  elements.redDogso.checked = Boolean(options.dogso);
  elements.redSlotChoice.value = String(suggestedSlot);
  elements.redNote.value = options.note || "";
  elements.redConfirm.dataset.side = side;

  updateRedDialogFields();
  elements.redDialog.showModal();
}

function updateRedDialogFields() {
  const type = elements.redRecipientType.value;
  const dogsoEligible = type === "substitute" || type === "official";
  const requiresReduction = type === "player" || (dogsoEligible && elements.redDogso.checked);

  elements.redDogsoRow.classList.toggle("hidden", !dogsoEligible);

  if (!dogsoEligible) {
    elements.redDogso.checked = false;
  }

  elements.redSlotChoice.disabled = !requiresReduction;

  if (match?.period.phase === "matchOver") {
    elements.redSlotChoice.disabled = true;
    elements.redDialogHint.textContent =
      "After match: the red card is recorded only. No numerical reduction can begin.";
    return;
  }

  if (requiresReduction && isBreakPhase()) {
    elements.redDialogHint.textContent =
      "A reduction applies. It will be pending at 2:00 and becomes available to start when the next playing period begins.";
    return;
  }

  if (requiresReduction && isLivePhase()) {
    elements.redDialogHint.textContent =
      "The main clock will stop. The two-minute reduction waits until you press Start 2:00 / Resume Match.";
    return;
  }

  elements.redDialogHint.textContent =
    "This red card is record-only. No two-minute numerical reduction applies.";
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

  elements.periodLabel.textContent = phaseName();

  if (isBreakPhase()) {
    const remaining = getLiveSeconds(match.period.breakTimer);
    elements.matchTimer.textContent = formatSeconds(remaining);
    elements.matchTimer.classList.toggle("expired", remaining === 0);

    elements.matchStatus.textContent =
      `${phaseCode()} — ${formatSeconds(remaining)} remaining — ` +
      `${teamName("home")} ${match.teams.home.score}–${match.teams.away.score} ${teamName("away")}`;
  } else if (isLivePhase()) {
    const remaining = getLiveSeconds(match.period.matchTimer);
    elements.matchTimer.textContent = formatSeconds(remaining);
    elements.matchTimer.classList.toggle("expired", remaining === 0);

    elements.matchStatus.textContent =
      `${phaseCode()} — ${formatSeconds(remaining)} — ` +
      `${teamName("home")} ${match.teams.home.score}–${match.teams.away.score} ${teamName("away")}`;
  } else if (["psoSetup", "pso"].includes(match.period.phase)) {
    elements.matchTimer.textContent = "PSO";
    elements.matchTimer.classList.remove("expired");
    elements.matchStatus.textContent =
      `PSO — ${teamName("home")} ${match.teams.home.score}–${match.teams.away.score} ${teamName("away")}`;
  } else {
    elements.matchTimer.textContent = "FT";
    elements.matchTimer.classList.remove("expired");
    elements.matchStatus.textContent =
      `After Match — ${teamName("home")} ${match.teams.home.score}–${match.teams.away.score} ${teamName("away")}`;
  }

  elements.kickoffLabel.textContent = currentKickoffLabel();
  elements.kickoffTeam.textContent = isLivePhase()
    ? teamName(match.period.activeKickoff)
    : "—";

  renderTeam("home");
  renderTeam("away");
  renderCentreControls();
  renderPso();
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
const foulOverflow = side === "home"
  ? elements.homeFoulOverflow
  : elements.awayFoulOverflow;

const foulButton = side === "home" ? elements.homeFoulAdd : elements.awayFoulAdd;
  const goalButton = side === "home" ? elements.homeGoalButton : elements.awayGoalButton;
  const yellowButton = side === "home" ? elements.homeYellowButton : elements.awayYellowButton;

  const timeoutButton = side === "home" ? elements.homeTimeoutButton : elements.awayTimeoutButton;
  const timeoutDisplay = side === "home" ? elements.homeTimeoutDisplay : elements.awayTimeoutDisplay;
  const timeoutTime = side === "home" ? elements.homeTimeoutTime : elements.awayTimeoutTime;
  const timeoutMessage = side === "home" ? elements.homeTimeoutMessage : elements.awayTimeoutMessage;

foulTotal.textContent = team.foulCount;
renderFoulLights(foulLights, team.foulCount, foulOverflow);

  goalButton.disabled = !canRecordGoalOrFoul();
  foulButton.disabled = !canRecordGoalOrFoul();
  yellowButton.disabled = !canRecordCards();

  timeoutButton.disabled =
    !canUseTimeout() ||
    team.timeoutUsed ||
    team.timeoutTimer.running;

  if (team.timeoutTimer.running || team.timeoutTimer.completed) {
    timeoutDisplay.classList.remove("hidden");

    const remaining = getLiveSeconds(team.timeoutTimer);
    timeoutTime.textContent = formatSeconds(remaining);

    const preSignal = team.timeoutTimer.running && remaining > 0 && remaining <= 15;

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

  renderTeamHistories(side);
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

  cardButton.disabled = !canRecordCards() || slot.status !== "available";

  if (slot.status === "available") {
    display.classList.add("hidden");
    cardButton.textContent = "Red Card";
    return;
  }

  display.classList.remove("hidden");
  time.textContent = formatSeconds(getLiveSeconds(slot.timer));
  state.className = "reduction-state";

  if (slot.status === "pendingNextPeriod") {
    state.textContent = "Pending next playing period";
    state.classList.add("pending");

    startButton.classList.add("hidden");
    goalButton.classList.add("hidden");
    clearButton.classList.add("hidden");

    cardButton.textContent = "Red Card Recorded";
    return;
  }

  if (slot.status === "waiting") {
    state.textContent = "Waiting — press Start 2:00 / Resume Match";
    state.classList.add("waiting");

    startButton.classList.remove("hidden");
    startButton.disabled = !isLivePhase();
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
  clearButton.disabled = !canRecordCards();

  cardButton.textContent = "Slot Ready After Clear";
}

function renderFoulLights(container, count, overflowEl) {
  const threshold = match.settings.foulThreshold;
  const visible = Math.max(threshold, 6);

  container.innerHTML = "";

  for (let number = 1; number <= visible; number += 1) {
    const light = document.createElement("span");
    light.className = "foul-light";

    if (number <= count) {
      if (number === threshold) {
        light.classList.add("active-threshold");
      } else if (number === threshold - 1) {
        light.classList.add("active-warning");
      } else {
        light.classList.add("active-normal");
      }
    }

    container.appendChild(light);
  }

  if (overflowEl) {
    const extra = Math.max(0, count - visible);
    if (extra > 0) {
      overflowEl.textContent = `+${extra}`;
      overflowEl.classList.remove("hidden");
    } else {
      overflowEl.classList.add("hidden");
    }
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

  [...entries].reverse().forEach((entry) => {
    const li = document.createElement("li");
    const output = formatter(entry);

    li.textContent = output.text;

    if (output.className) {
      li.classList.add(output.className);
    }

    container.appendChild(li);
  });
}

function renderTeamHistories(side) {
  const goals = match.incidents.goals.filter((entry) => entry.displaySide === side);
  const fouls = match.incidents.fouls.filter((entry) => entry.side === side);
  const yellows = match.incidents.cards.filter(
    (entry) => entry.side === side && entry.type === "YC"
  );
  const reds = match.incidents.cards.filter(
    (entry) => entry.side === side && entry.type === "RC"
  );

  renderMiniHistory($(`#${side}-goal-history`), goals, (goal) => {
    const typeMap = {
      openPlay: "Goal",
      penalty: "Penalty",
      tenMetre: "10m",
      ownGoal: `OG No. ${goal.scorerNumber || "?"} (${teamName(goal.ownGoalSide)})`
    };

    const scorer = goal.type === "ownGoal"
      ? ""
      : goal.scorerNumber
        ? ` No. ${goal.scorerNumber}`
        : "";

    return {
      text: `${goal.phase} ${goal.periodTime ? `${goal.periodTime} — ` : "— "}${typeMap[goal.type]}${scorer}`
    };
  });

  renderMiniHistory($(`#${side}-foul-history`), fouls, (foul) => {
    const threshold = match.settings.foulThreshold;

    if (foul.number === threshold) {
      return {
        text: `${foul.phase} ${foul.periodTime} — Foul ${foul.number} — 10m`,
        className: "threshold-entry"
      };
    }

    if (foul.number === threshold - 1) {
      return {
        text: `${foul.phase} ${foul.periodTime} — Foul ${foul.number} — warning`,
        className: "warning-entry"
      };
    }

    return {
      text: `${foul.phase} ${foul.periodTime} — Foul ${foul.number}`
    };
  });

  renderMiniHistory($(`#${side}-yellow-history`), yellows, (card) => {
    const count = match.incidents.cards.filter((other) => (
      other.side === side &&
      other.type === "YC" &&
      String(other.playerNumber).trim() === String(card.playerNumber).trim()
    )).length;

    return {
      text: `${card.phase}${card.periodTime ? ` ${card.periodTime}` : ""} — YC No. ${card.playerNumber}${count >= 2 ? " — 2nd YC" : ""}`,
      className: count >= 2 ? "warning-entry" : ""
    };
  });

  renderMiniHistory($(`#${side}-red-history`), reds, (card) => {
    const labels = {
      player: "Player",
      substitute: "Substitute",
      official: "Official",
      other: "Other"
    };

    const reduction = card.requiresReduction
      ? card.pendingNextPeriod
        ? " — 2:00 next period"
        : ` — Slot ${card.reductionSlot}`
      : " — no 2:00";

    const dogso = card.dogso ? " — DOGSO" : "";

    return {
      text: `${card.phase}${card.periodTime ? ` ${card.periodTime}` : ""} — RC ${labels[card.recipientType]} ${card.personId || ""}${dogso}${reduction}`
    };
  });
}

function renderCentreControls() {
  const phase = match.period.phase;

  if (["psoSetup", "pso", "matchOver"].includes(phase)) {
    elements.startButton.disabled = true;
    elements.pauseButton.disabled = true;
    elements.resetButton.disabled = true;
    elements.undoButton.disabled = match.history.length === 0;
    elements.proceedButton.disabled = phase === "matchOver";
    elements.proceedButton.textContent = phase === "matchOver" ? "Match Over" : "End Match";
    return;
  }

  if (isBreakPhase()) {
    elements.startButton.disabled = true;
    elements.pauseButton.disabled = true;
    elements.resetButton.disabled = true;
    elements.undoButton.disabled = match.history.length === 0;

    if (phase === "halfTime") {
      elements.proceedButton.textContent = "Start Second Half";
    } else if (phase === "fullTimeBreak") {
      elements.proceedButton.textContent = "Extra Time Coin Toss";
    } else {
      elements.proceedButton.textContent = "Start Extra-Time Second Half";
    }

    elements.proceedButton.disabled = false;
    return;
  }

  const timer = match.period.matchTimer;
  const fullLength = periodLengthSeconds();

  const notStarted =
    !timer.running &&
    !timer.completed &&
    timer.remainingSeconds === fullLength;

  elements.startButton.disabled = !notStarted;
  elements.pauseButton.disabled = timer.completed || timer.remainingSeconds <= 0;
  elements.pauseButton.textContent = timer.running ? "Pause" : "Resume";
  elements.resetButton.disabled = false;
  elements.undoButton.disabled = match.history.length === 0;

  if (phase === "firstHalf") {
    elements.proceedButton.textContent = "Proceed to Half-time";
  } else if (phase === "secondHalf") {
    elements.proceedButton.textContent = "Proceed after Full Time";
  } else if (phase === "extraTime1") {
    elements.proceedButton.textContent = "Proceed to Extra-time Half-time";
  } else if (phase === "extraTime2") {
    elements.proceedButton.textContent = "Proceed after Extra Time";
  }

  elements.proceedButton.disabled = false;
}

function renderPso() {
  const show = ["psoSetup", "pso"].includes(match.period.phase);
  elements.psoPanel.classList.toggle("hidden", !show);

  if (!show) return;

  const homeKicks = match.incidents.psoKicks.filter((kick) => kick.side === "home");
  const awayKicks = match.incidents.psoKicks.filter((kick) => kick.side === "away");

  const homeScore = homeKicks.filter((kick) => kick.result === "goal").length;
  const awayScore = awayKicks.filter((kick) => kick.result === "goal").length;

  elements.psoHomeName.textContent = teamName("home");
  elements.psoAwayName.textContent = teamName("away");
  elements.psoHomeScore.textContent = homeScore;
  elements.psoAwayScore.textContent = awayScore;

  renderPsoKickDots(elements.psoHomeKicks, homeKicks);
  renderPsoKickDots(elements.psoAwayKicks, awayKicks);

  const setupComplete = Boolean(match.pso.firstTeam);

  elements.psoSetupControls.classList.toggle("hidden", setupComplete);
  elements.psoKickControls.classList.toggle("hidden", !setupComplete || match.pso.completed);

  if (!setupComplete) {
    elements.psoStatus.textContent =
      `Choose which team takes the first kick. Initial rounds: ${match.settings.psoRounds} kicks per team.`;
    return;
  }

  if (match.pso.completed) {
    elements.psoStatus.textContent =
      `Shoot-out complete — ${teamName(match.pso.winner)} win ${homeScore}–${awayScore}.`;
    return;
  }

  const stage = match.pso.suddenDeath
    ? "Sudden death"
    : `Initial series: ${match.settings.psoRounds} kicks per team`;

  elements.psoStatus.textContent = stage;
  elements.psoNextTeam.textContent = teamName(match.pso.nextTeam);
  elements.psoSuddenDeath.classList.toggle("hidden", match.pso.suddenDeath);
}

function renderPsoKickDots(container, kicks) {
  container.innerHTML = "";

  kicks.forEach((kick) => {
    const dot = document.createElement("span");
    dot.className = `pso-kick ${kick.result}`;
    dot.textContent = kick.result === "goal" ? "✓" : "✕";
    container.appendChild(dot);
  });
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
    const time = event.periodTime ? ` ${event.periodTime}` : "";

    li.textContent =
      `${formatDateTime(event.at)} | ${event.phase}${time} | ${event.description}`;

    elements.eventList.appendChild(li);
  });
}

function recordFoul(side) {
  if (!canRecordGoalOrFoul()) return;

  const team = match.teams[side];
  const number = team.foulCount + 1;
  const threshold = match.settings.foulThreshold;

  snapshot(`${teamName(side)} accumulated foul ${team.foulCount} → ${number}`);

  team.foulCount = number;

  const foul = {
    id: uniqueId(),
    side,
    number,
    phase: phaseCode(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    recordedAt: new Date().toISOString()
  };

  match.incidents.fouls.push(foul);
  addEvent(`${teamName(side)} accumulated foul ${number}.`);

  if (number === threshold - 1) {
    showAlert("5-foul warning", `${teamName(side)} have reached ${number} accumulated fouls.`);
  }

  if (number === threshold) {
    showAlert("10m Free Kick", `${teamName(side)} have reached ${number} accumulated fouls.`);
  }

  render();
}

function recordGoal(scoringSide, details = {}) {
  if (!canRecordGoalOrFoul()) return;

  snapshot(`${teamName(scoringSide)} goal recorded`);

  match.teams[scoringSide].score += 1;

  const goal = {
    id: uniqueId(),
    displaySide: scoringSide,
    scorerNumber: details.scorerNumber || "",
    type: details.type || "openPlay",
    ownGoalSide: details.ownGoalSide || null,
    note: details.note || "",
    phase: phaseCode(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    recordedAt: new Date().toISOString()
  };

  match.incidents.goals.push(goal);

  const labels = {
    openPlay: "goal",
    penalty: "penalty goal",
    tenMetre: "10m free-kick goal",
    ownGoal: "own goal"
  };

  addEvent(
    `${teamName(scoringSide)} ${labels[goal.type]}${goal.scorerNumber ? ` — No. ${goal.scorerNumber}` : ""}.`
  );

  render();
}

function confirmGoalDialog() {
  const scoringSide = elements.goalConfirm.dataset.scoringSide;
  const type = elements.goalType.value;
  const scorerNumber = elements.goalScorerNumber.value.trim();
  const note = elements.goalNote.value.trim();
  const finishOpponentGoalAction =
    elements.goalConfirm.dataset.afterOpponentGoal === "true";

  if (!scoringSide) return;

  // Own goal: the team that receives the goal is scoringSide (the + Goal
  // button pressed). The player who scored into their own net belongs to
  // the opposite team.
  const ownGoalSide = type === "ownGoal" ? opposite(scoringSide) : null;

  /*
    Close first. This prevents the re-render from leaving the dialog visible
    on some browsers, especially an installed Android PWA.
  */
  if (elements.goalDialog.open) {
    elements.goalDialog.close("confirm");
  }

  recordGoal(scoringSide, {
    scorerNumber,
    type,
    ownGoalSide,
    note
  });

  elements.goalConfirm.dataset.scoringSide = "";
  elements.goalConfirm.dataset.ownGoalSide = "";
  elements.goalConfirm.dataset.afterOpponentGoal = "";

  if (finishOpponentGoalAction) {
    completePendingOpponentGoalReduction();
  }
}

function countYellowCardsForPlayer(side, playerNumber) {
  return match.incidents.cards.filter((card) => (
    card.side === side &&
    card.type === "YC" &&
    String(card.playerNumber).trim() === String(playerNumber).trim()
  )).length;
}

function recordYellowCard(side, playerNumber, note) {
  if (!canRecordCards() || !playerNumber) return;

  snapshot(`${teamName(side)} yellow card to ${playerNumber}`);

  match.teams[side].yellowCardsShown += 1;

  const card = {
    id: uniqueId(),
    side,
    type: "YC",
    playerNumber,
    note,
    phase: phaseCode(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    recordedAt: new Date().toISOString()
  };

  match.incidents.cards.push(card);
  addEvent(`${teamName(side)} yellow card to No. ${playerNumber}.`);

  const count = countYellowCardsForPlayer(side, playerNumber);

  render();

  if (count >= 2) {
    showSecondYellowWarning(side, playerNumber);
  }
}

function recordRedCardFromDialog() {
  const side = elements.redConfirm.dataset.side;
  const recipientType = elements.redRecipientType.value;
  const dogso = elements.redDogso.checked &&
    ["substitute", "official"].includes(recipientType);

  const personId = elements.redPersonId.value.trim();
  const note = elements.redNote.value.trim();
  const chosenSlot = Number(elements.redSlotChoice.value);

  if (!side) return;

  const requiresReduction =
    recipientType === "player" ||
    dogso;

  const recordOnlyAfterMatch = match.period.phase === "matchOver";
  const effectiveReduction = requiresReduction && !recordOnlyAfterMatch;

  if (effectiveReduction) {
    const slot = match.teams[side].reductionSlots[chosenSlot];

    if (!slot || slot.status !== "available") {
      showAlert(
        "Reduction slot unavailable",
        `Reduction Slot ${chosenSlot + 1} is unavailable. Select a free slot or clear a completed slot first.`
      );
      return;
    }
  }

  snapshot(`${teamName(side)} red card recorded`);

  const cardId = uniqueId();
  const pendingNextPeriod = effectiveReduction && isBreakPhase();

  match.teams[side].redCardsShown += 1;

  if (effectiveReduction) {
    if (isLivePhase()) {
      pauseMainClock();
      pauseActiveReductionTimers();
    }

    match.teams[side].reductionSlots[chosenSlot] = {
      status: pendingNextPeriod ? "pendingNextPeriod" : "waiting",
      timer: createTimer(RED_CARD_SECONDS),
      startedAtPhase: null,
      completedReason: null,
      dismissalId: cardId,
      source: pendingNextPeriod ? "break" : "livePlay"
    };
  }

  match.incidents.cards.push({
    id: cardId,
    side,
    type: "RC",
    personId,
    recipientType,
    dogso,
    requiresReduction: effectiveReduction,
    pendingNextPeriod,
    reductionSlot: effectiveReduction ? chosenSlot + 1 : null,
    note,
    phase: phaseCode(),
    periodTime: currentPeriodTime(),
    cumulativeTime: currentCumulativeTime(),
    recordedAt: new Date().toISOString()
  });

  if (effectiveReduction && pendingNextPeriod) {
    addEvent(
      `${teamName(side)} red card${personId ? ` to ${personId}` : ""}. Two-minute reduction pending next period in Slot ${chosenSlot + 1}.`
    );
  } else if (effectiveReduction) {
    addEvent(
      `${teamName(side)} red card${personId ? ` to ${personId}` : ""}. Main clock stopped; Reduction Slot ${chosenSlot + 1} waiting.`
    );
  } else {
    addEvent(
      `${teamName(side)} red card to ${recipientType}${personId ? ` ${personId}` : ""}. Record only; no two-minute reduction.`
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
    `Grant a ${formatSeconds(match.settings.timeoutSeconds)} time-out to ${teamName(side)}? Main clock and active reductions will pause.`,
    () => {
      snapshot(`${teamName(side)} time-out started`);

      pauseMainClock();
      pauseActiveReductionTimers();

      team.timeoutUsed = true;
      team.timeoutTimer = createTimer(match.settings.timeoutSeconds);
      setTimerRunning(team.timeoutTimer, true);

      addEvent(`${teamName(side)} time-out started.`);
      startTicker();
      render();
    }
  );
}

function startReductionAndResumeMatch(side, index) {
  if (!isLivePhase()) return;

  const slot = match.teams[side].reductionSlots[index];
  if (slot.status !== "waiting") return;

  showConfirm(
    "Start reduction timer",
    `Start the two-minute reduction for ${teamName(side)} and resume the main clock?`,
    () => {
      snapshot(`${teamName(side)} Reduction Slot ${index + 1} started`);

      slot.status = "running";
      slot.startedAtPhase = phaseCode();

      setTimerRunning(slot.timer, true);
      startOrResumeMainClock();

      addEvent(`${teamName(side)} Reduction Slot ${index + 1} started; main clock resumed.`);
      render();
    }
  );
}

function openOpponentGoalDialog(side, index) {
  const slot = match.teams[side].reductionSlots[index];
  if (slot.status !== "running") return;

  pendingOpponentGoal = { side, index, opponent: opposite(side) };
  elements.opponentGoalDialog.showModal();
}

function completePendingOpponentGoalReduction() {
  if (!pendingOpponentGoal) return;

  const { side, index } = pendingOpponentGoal;
  const slot = match.teams[side].reductionSlots[index];

  if (slot && slot.status === "running") {
    snapshot(`${teamName(side)} Reduction Slot ${index + 1} ended by opponent goal`);

    setTimerRunning(slot.timer, false);
    slot.timer.remainingSeconds = 0;
    slot.timer.completed = true;
    slot.status = "completed";
    slot.completedReason = "ended by opponent goal";

    addEvent(`${teamName(side)} Reduction Slot ${index + 1} ended by opponent goal.`);
  }

  pendingOpponentGoal = null;
  render();
}

function clearReductionSlot(side, index) {
  const slot = match.teams[side].reductionSlots[index];
  if (slot.status !== "completed") return;

  showConfirm(
    "Clear reduction slot",
    `Clear ${teamName(side)} Reduction Slot ${index + 1} for future use? The red-card history remains recorded.`,
    () => {
      snapshot(`${teamName(side)} Reduction Slot ${index + 1} cleared`);

      match.teams[side].reductionSlots[index] = createReductionSlot();
      addEvent(`${teamName(side)} Reduction Slot ${index + 1} cleared for reuse.`);
      render();
    }
  );
}

function startMatchTimer() {
  if (!isLivePhase()) return;

  const timer = match.period.matchTimer;

  if (
    timer.running ||
    timer.completed ||
    timer.remainingSeconds !== periodLengthSeconds()
  ) {
    return;
  }

  snapshot(`${phaseName()} main clock started`);
  startOrResumeMainClock();
  addEvent(`${phaseName()} main clock started.`);
  render();
}

function pauseResumeMatchTimer() {
  if (!isLivePhase()) return;

  const timer = match.period.matchTimer;

  if (timer.running) {
    snapshot(`${phaseName()} main clock paused`);

    pauseMainClock();
    pauseActiveReductionTimers();

    addEvent(`${phaseName()} main clock and active reductions paused.`);
    render();
    return;
  }

  if (timer.completed || timer.remainingSeconds <= 0) return;

  if (hasWaitingReduction()) {
    showAlert(
      "Start the red-card reduction first",
      `A reduction is waiting: ${firstWaitingReductionDescription()}. Use its Start 2:00 / Resume Match button instead.`
    );
    return;
  }

  snapshot(`${phaseName()} main clock resumed`);
  startOrResumeMainClock();
  addEvent(`${phaseName()} main clock and active reductions resumed.`);
  render();
}

function resetCurrentPeriod() {
  if (!isLivePhase()) return;

  showConfirm(
    "Reset current period",
    `Reset ${phaseName()} to its original duration? Scores, cards, fouls and time-outs remain recorded.`,
    () => {
      snapshot(`${phaseName()} main clock reset`);

      match.period.matchTimer = createTimer(periodLengthSeconds());
      addEvent(`${phaseName()} main clock reset.`);
      render();
    }
  );
}

function undoPreviousStep() {
  if (match.history.length === 0) return;

  const previous = match.history[match.history.length - 1];

  showConfirm(
    "Undo previous step",
    `Are you sure you want to undo: ${previous.description}?`,
    () => {
      const entry = match.history.pop();

      match.teams = entry.state.teams;
      match.period = entry.state.period;
      match.incidents = entry.state.incidents;
      match.pso = entry.state.pso;
      match.endedAt = entry.state.endedAt;

      addEvent(`Undo performed: ${entry.description}.`);
      restoreTimerStatesAfterLoad();
      render();
    }
  );
}

function resetForSecondHalf() {
  ["home", "away"].forEach((side) => {
    match.teams[side].foulCount = 0;
    match.teams[side].timeoutUsed = false;
    match.teams[side].timeoutTimer = createTimer(match.settings.timeoutSeconds);
  });
}

function beginBreak(nextPhase, seconds, reason) {
  pauseMainClock();
  stopReductionsAtPeriodEnd(reason);

  match.period.phase = nextPhase;
  match.period.breakTimer = createTimer(seconds);
  setTimerRunning(match.period.breakTimer, true);

  addEvent(`${phaseName()} count-down started from ${formatSeconds(seconds)}.`);
  startTicker();
  render();
}

function enterHalfTime() {
  snapshot("Proceeded to half-time");
  beginBreak("halfTime", match.settings.halfTimeBreakSeconds, "stopped at end of First Half");
}

function startSecondHalf() {
  snapshot("Started Second Half");

  setTimerRunning(match.period.breakTimer, false);

  match.period.phase = "secondHalf";
  match.period.matchTimer = createTimer(match.settings.halfSeconds);
  match.period.activeKickoff = match.period.secondKickoff;

  resetForSecondHalf();
  activatePendingReductionsForNextPeriod();

  addEvent("Second Half prepared. Fouls reset; time-outs restored; pending reductions ready.");
  render();
}

function enterFullTimeBreak() {
  snapshot("Entered full-time break");
  beginBreak("fullTimeBreak", match.settings.fullTimeBreakSeconds, "stopped at end of Second Half");
}

function chooseExtraTimeKickoff(side) {
  snapshot(`Extra-time coin toss: ${teamName(side)} kick off ET1`);

  setTimerRunning(match.period.breakTimer, false);

  match.period.extraTimeFirstKickoff = side;
  match.period.activeKickoff = side;
  match.period.phase = "extraTime1";
  match.period.matchTimer = createTimer(match.settings.extraTimeSeconds);

  activatePendingReductionsForNextPeriod();

  addEvent(`${teamName(side)} selected to kick off first half of extra time.`);
  elements.etCoinDialog.close(side);
  render();
}

function enterExtraTimeHalfTime() {
  snapshot("Proceeded to extra-time half-time");
  beginBreak(
    "extraTimeHalfTime",
    match.settings.extraTimeBreakSeconds,
    "stopped at end of Extra Time First Half"
  );
}

function startExtraTimeTwo() {
  snapshot("Started Extra Time Second Half");

  setTimerRunning(match.period.breakTimer, false);

  match.period.phase = "extraTime2";
  match.period.matchTimer = createTimer(match.settings.extraTimeSeconds);
  match.period.activeKickoff = opposite(match.period.extraTimeFirstKickoff);

  activatePendingReductionsForNextPeriod();

  addEvent("Extra Time Second Half prepared. Pending reductions ready.");
  render();
}

function openPsoSetup() {
  snapshot("Penalty shoot-out setup opened");

  pauseMainClock();
  pauseActiveReductionTimers();

  match.period.phase = "psoSetup";
  match.pso.active = true;
  match.pso.completed = false;
  match.pso.firstTeam = null;
  match.pso.nextTeam = null;
  match.pso.suddenDeath = false;
  match.pso.winner = null;

  addEvent("Penalty shoot-out setup opened.");
  render();
}

function selectPsoFirstTeam(side) {
  snapshot(`${teamName(side)} selected to take first PSO kick`);

  match.period.phase = "pso";
  match.pso.firstTeam = side;
  match.pso.nextTeam = side;

  addEvent(`${teamName(side)} selected to take the first penalty shoot-out kick.`);
  render();
}

function getPsoKicks(side) {
  return match.incidents.psoKicks.filter((kick) => kick.side === side);
}

function getPsoScore(side) {
  return getPsoKicks(side).filter((kick) => kick.result === "goal").length;
}

function psoHasInitialSeriesFinished() {
  return (
    getPsoKicks("home").length >= match.settings.psoRounds &&
    getPsoKicks("away").length >= match.settings.psoRounds
  );
}

function psoWinnerIfClinched() {
  const homeTaken = getPsoKicks("home").length;
  const awayTaken = getPsoKicks("away").length;
  const homeGoals = getPsoScore("home");
  const awayGoals = getPsoScore("away");
  const rounds = match.settings.psoRounds;

  if (!match.pso.suddenDeath) {
    const homeRemaining = Math.max(0, rounds - homeTaken);
    const awayRemaining = Math.max(0, rounds - awayTaken);

    if (homeGoals > awayGoals + awayRemaining) return "home";
    if (awayGoals > homeGoals + homeRemaining) return "away";

    if (
      homeTaken >= rounds &&
      awayTaken >= rounds &&
      homeGoals !== awayGoals
    ) {
      return homeGoals > awayGoals ? "home" : "away";
    }

    return null;
  }

  if (homeTaken === awayTaken && homeTaken > 0 && homeGoals !== awayGoals) {
    return homeGoals > awayGoals ? "home" : "away";
  }

  return null;
}

function recordPsoKick() {
  if (match.period.phase !== "pso" || match.pso.completed) return;

  const selected = document.querySelector('input[name="pso-result"]:checked');
  const taker = elements.psoTakerNumber.value.trim();

  if (!taker) {
    showAlert("Taker number required", "Enter the penalty taker’s number or identifier.");
    return;
  }

  if (!selected) {
    showAlert("Kick result required", "Choose Goal or No goal before recording the kick.");
    return;
  }

  const side = match.pso.nextTeam;

  snapshot(`${teamName(side)} PSO kick recorded`);

  const kick = {
    id: uniqueId(),
    side,
    taker,
    result: selected.value,
    phase: "PSO",
    recordedAt: new Date().toISOString()
  };

  match.incidents.psoKicks.push(kick);

  addEvent(
    `PSO — ${teamName(side)} No. ${taker}: ${kick.result === "goal" ? "Goal" : "No goal"}.`
  );

  const winner = psoWinnerIfClinched();

  if (winner) {
    match.pso.completed = true;
    match.pso.winner = winner;

    showAlert(
      "Shoot-out over",
      `${teamName(winner)} win the penalty shoot-out ${getPsoScore("home")}–${getPsoScore("away")}.`
    );
  } else {
    match.pso.nextTeam = opposite(side);
  }

  elements.psoTakerNumber.value = "";
  document.querySelectorAll('input[name="pso-result"]').forEach((input) => {
    input.checked = false;
  });

  render();
}

function beginSuddenDeath() {
  if (match.period.phase !== "pso" || match.pso.completed) return;

  if (!psoHasInitialSeriesFinished()) {
    showAlert(
      "Initial series not complete",
      `Both teams should complete ${match.settings.psoRounds} initial kicks before sudden death is started manually.`
    );
    return;
  }

  if (getPsoScore("home") !== getPsoScore("away")) {
    showAlert(
      "Shoot-out already decided",
      "The shoot-out has already produced a winner."
    );
    return;
  }

  snapshot("Penalty shoot-out sudden death started");

  match.pso.suddenDeath = true;
  addEvent("Penalty shoot-out sudden death started.");
  render();
}

function endMatch() {
  showConfirm(
    "End match",
    "Are you sure you want to end the match? The CSV can still be exported afterwards.",
    async () => {
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

      await releaseWakeLock();
      render();
    }
  );
}

function proceed() {
  const phase = match.period.phase;

  if (phase === "firstHalf") {
    showConfirm(
      "Proceed to half-time",
      `End the First Half and start the ${formatSeconds(match.settings.halfTimeBreakSeconds)} half-time count-down?`,
      enterHalfTime
    );
    return;
  }

  if (phase === "halfTime") {
    showConfirm(
      "Start Second Half",
      "Prepare the Second Half? Fouls reset, time-outs restore, and any pending reduction becomes ready.",
      startSecondHalf
    );
    return;
  }

  if (phase === "secondHalf") {
    if (match.settings.extraTimeEnabled) {
      showConfirm(
        "After regular time",
        "Play extra time? Select Yes to start the full-time break. Select No to continue to the next available decision.",
        enterFullTimeBreak,
        () => {
          if (match.settings.psoEnabled) {
            openPsoSetup();
          } else {
            endMatch();
          }
        }
      );
    } else if (match.settings.psoEnabled) {
      openPsoSetup();
    } else {
      endMatch();
    }

    return;
  }

  if (phase === "fullTimeBreak") {
    elements.etCoinDialog.showModal();
    return;
  }

  if (phase === "extraTime1") {
    showConfirm(
      "Proceed to extra-time half-time",
      `End ET1 and start the ${formatSeconds(match.settings.extraTimeBreakSeconds)} break?`,
      enterExtraTimeHalfTime
    );
    return;
  }

  if (phase === "extraTimeHalfTime") {
    showConfirm(
      "Start Extra Time Second Half",
      "Prepare ET2 and activate any pending reduction slots?",
      startExtraTimeTwo
    );
    return;
  }

  if (phase === "extraTime2") {
    if (match.settings.psoEnabled) {
      openPsoSetup();
    } else {
      endMatch();
    }
    return;
  }

  if (phase === "psoSetup" || phase === "pso") {
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
    ["Event Log"],
    ["Timestamp", "Phase", "Period Time", "Cumulative Time", "Event"]
  ];

  match.events.forEach((event) => {
    rows.push([
      event.at,
      event.phase,
      event.periodTime,
      event.cumulativeTime,
      event.description
    ]);
  });

  rows.push([]);
  rows.push(["Goals"]);
  rows.push([
    "Scoring Team",
    "Goal Type",
    "Scorer Number",
    "Own Goal By",
    "Phase",
    "Period Time",
    "Cumulative Time",
    "Note"
  ]);

  match.incidents.goals.forEach((goal) => {
    rows.push([
      teamName(goal.displaySide),
      goal.type,
      goal.scorerNumber,
      goal.ownGoalSide ? teamName(goal.ownGoalSide) : "",
      goal.phase,
      goal.periodTime,
      goal.cumulativeTime,
      goal.note
    ]);
  });

  rows.push([]);
  rows.push(["Accumulated Fouls"]);
  rows.push(["Team", "Foul Number", "Phase", "Period Time", "Cumulative Time"]);

  match.incidents.fouls.forEach((foul) => {
    rows.push([
      teamName(foul.side),
      foul.number,
      foul.phase,
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
    "DOGSO",
    "Two-minute Reduction",
    "Reduction Slot",
    "Phase",
    "Period Time",
    "Cumulative Time",
    "Note"
  ]);

  match.incidents.cards.forEach((card) => {
    rows.push([
      teamName(card.side),
      card.type,
      card.playerNumber || card.personId || "",
      card.type === "RC" ? card.recipientType : "player",
      card.dogso ? "Yes" : "No",
      card.requiresReduction ? "Yes" : "No",
      card.reductionSlot || "",
      card.phase,
      card.periodTime,
      card.cumulativeTime,
      card.note || ""
    ]);
  });

  rows.push([]);
  rows.push(["Penalty Shoot-out"]);
  rows.push(["Team", "Taker", "Result", "Kick Number"]);

  match.incidents.psoKicks.forEach((kick, index) => {
    rows.push([
      teamName(kick.side),
      kick.taker,
      kick.result === "goal" ? "Goal" : "No goal",
      index + 1
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

  link.href = url;
  link.download =
    `${dateStamp()}_${safeFileName(teamName("home")) || "Home"}_` +
    `${safeFileName(teamName("away")) || "Away"}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function beginNewMatch() {
  if (!match) return;

  showConfirm(
    "Create new match",
    "Start a new match? Export the current match log first if required.",
    async () => {
      await releaseWakeLock();
      clearMatch();
      elements.setupForm.reset();

      elements.homeColour.value = "#0ea5e9";
      elements.awayColour.value = "#ef4444";
      elements.halfMinutes.value = "20";
      elements.breakMinutes.value = "5";
      elements.timeoutMinutes.value = "1";
      elements.foulThreshold.value = "6";
      elements.extraTimeMinutes.value = "5";
      elements.fullTimeBreakMinutes.value = "5";
      elements.extraTimeBreakMinutes.value = "2";
      elements.psoRounds.value = "5";

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
        openOpponentGoalDialog(side, index);
      });

      $(`#${side}-red-${number}-clear-button`).addEventListener("click", () => {
        clearReductionSlot(side, index);
      });
    });
  });

  elements.goalConfirm.addEventListener("click", (event) => {
    event.preventDefault();
    confirmGoalDialog();
  });

  elements.yellowConfirm.addEventListener("click", (event) => {
    event.preventDefault();

    const side = elements.yellowConfirm.dataset.side;
    const player = elements.yellowPlayerNumber.value.trim();

    if (!player) {
      showAlert("Player number required", "Enter the player number or identifier.");
      return;
    }

    recordYellowCard(side, player, elements.yellowNote.value.trim());
    elements.yellowDialog.close("confirm");
  });

  elements.secondYellowRed.addEventListener("click", () => {
    const side = elements.secondYellowRed.dataset.side;
    const player = elements.secondYellowRed.dataset.playerNumber;

    elements.secondYellowDialog.close("confirm");
    openRedDialog(side, 0, {
      personId: player,
      recipientType: "player"
    });
  });

  elements.redRecipientType.addEventListener("change", updateRedDialogFields);
  elements.redDogso.addEventListener("change", updateRedDialogFields);

  elements.redConfirm.addEventListener("click", (event) => {
    event.preventDefault();
    recordRedCardFromDialog();
  });

  elements.opponentGoalAdd.addEventListener("click", () => {
    if (!pendingOpponentGoal) return;

    const { opponent } = pendingOpponentGoal;

    elements.opponentGoalDialog.close("add");
    openGoalDialog(opponent, {
      afterOpponentGoal: true
    });
  });

  elements.opponentGoalRecorded.addEventListener("click", () => {
    elements.opponentGoalDialog.close("recorded");
    completePendingOpponentGoalReduction();
  });

  elements.etCoinHome.addEventListener("click", () => chooseExtraTimeKickoff("home"));
  elements.etCoinAway.addEventListener("click", () => chooseExtraTimeKickoff("away"));

  elements.psoFirstHome.addEventListener("click", () => selectPsoFirstTeam("home"));
  elements.psoFirstAway.addEventListener("click", () => selectPsoFirstTeam("away"));
  elements.psoRecordKick.addEventListener("click", recordPsoKick);
  elements.psoSuddenDeath.addEventListener("click", beginSuddenDeath);

  elements.startButton.addEventListener("click", startMatchTimer);
  elements.pauseButton.addEventListener("click", pauseResumeMatchTimer);
  elements.resetButton.addEventListener("click", resetCurrentPeriod);
  elements.undoButton.addEventListener("click", undoPreviousStep);
  elements.proceedButton.addEventListener("click", proceed);
  elements.exportButton.addEventListener("click", exportCsv);
  elements.wakeLockButton.addEventListener("click", toggleWakeLock);
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

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    const activeDialog = document.querySelector("dialog[open]");
    if (!activeDialog) return;

    const confirmButton = activeDialog.querySelector(
      "button[value='confirm'], button[type='submit']:not([value='cancel'])"
    );

    if (confirmButton) {
      event.preventDefault();
      confirmButton.click();
    }
  });

  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden && match) {
      syncAllTimers();
      render();
      await restoreWakeLockIfNeeded();
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

  if (match && match.version !== 6) {
    localStorage.removeItem(STORAGE_KEY);
    match = null;
  }

  if (match) {
    restoreTimerStatesAfterLoad();
  }

  render();
  updateWakeLockUi();
  registerServiceWorker();
}

init();
