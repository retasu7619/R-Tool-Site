"use strict";

/* =========================
   デフォルト設定
   ========================= */

const DEFAULT_SETTINGS = {
  diceSides: 100,

  criticalMin: 1,
  criticalMax: 5,

  fumbleMin: 96,
  fumbleMax: 100,
};

/* =========================
   IndexedDB
   ========================= */

const DB_NAME = "DiceRollerDB";
const DB_VERSION = 1;
const STORE_NAME = "settings";
const SETTINGS_KEY = "main";

let db = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;

      resolve(db);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function loadSettings() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");

    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(SETTINGS_KEY);

    request.onsuccess = () => {
      if (request.result) {
        resolve({
          ...DEFAULT_SETTINGS,
          ...request.result,
        });
      } else {
        resolve({
          ...DEFAULT_SETTINGS,
        });
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    const store = transaction.objectStore(STORE_NAME);

    const request = store.put(settings, SETTINGS_KEY);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/* =========================
   DOM
   ========================= */

const resultElement = document.getElementById("result");

const judgementElement = document.getElementById("judgement");

const settingsOverlay = document.getElementById("settingsOverlay");

const closeSettings = document.getElementById("closeSettings");

const saveSettingsButton = document.getElementById("saveSettings");

const settingsError = document.getElementById("settingsError");

const diceSidesInput = document.getElementById("diceSides");

const criticalMinInput = document.getElementById("criticalMin");

const criticalMaxInput = document.getElementById("criticalMax");

const fumbleMinInput = document.getElementById("fumbleMin");

const fumbleMaxInput = document.getElementById("fumbleMax");

/* =========================
   現在の設定
   ========================= */

let settings = {
  ...DEFAULT_SETTINGS,
};

/* =========================
   ダイス
   ========================= */

function randomDice(max) {
  return Math.floor(Math.random() * max) + 1;
}

/* =========================
   判定
   ========================= */

function getJudgement(value) {
  if (value >= settings.criticalMin && value <= settings.criticalMax) {
    return "critical";
  }

  if (value >= settings.fumbleMin && value <= settings.fumbleMax) {
    return "fumble";
  }

  return null;
}

/* =========================
   結果表示
   ========================= */

function displayResult(value) {
  resultElement.textContent = value;

  /*
   * 前回の判定を一旦消す
   */
  judgementElement.textContent = "";

  judgementElement.className = "judgement";

  /*
   * 現在の数字を判定
   */
  const judgement = getJudgement(value);

  if (judgement === "critical") {
    judgementElement.textContent = "CRITICAL";

    judgementElement.classList.add("critical");
  }

  if (judgement === "fumble") {
    judgementElement.textContent = "FUMBLE";

    judgementElement.classList.add("fumble");
  }
}

/* =========================
   ダイスロール
   ========================= */

function rollDice() {
  const duration = 700;
  const interval = 50;

  /*
   * ロール開始時に
   * 判定表示を消す
   */
  judgementElement.textContent = "";

  judgementElement.className = "judgement";

  resultElement.classList.add("rolling");

  /*
   * 一定間隔で数字を更新。
   *
   * displayResult()を使うことで、
   * ロール途中の数字にも
   * CRITICAL / FUMBLEを表示する。
   */
  const timer = setInterval(() => {
    const value = randomDice(settings.diceSides);

    displayResult(value);
  }, interval);

  /*
   * 最終結果
   */
  setTimeout(() => {
    clearInterval(timer);

    resultElement.classList.remove("rolling");

    const finalValue = randomDice(settings.diceSides);

    displayResult(finalValue);
  }, duration);
}

/* =========================
   設定画面
   ========================= */

function fillSettingsForm() {
  diceSidesInput.value = settings.diceSides;

  criticalMinInput.value = settings.criticalMin;

  criticalMaxInput.value = settings.criticalMax;

  fumbleMinInput.value = settings.fumbleMin;

  fumbleMaxInput.value = settings.fumbleMax;

  settingsError.textContent = "";
}

function openSettings() {
  fillSettingsForm();

  settingsOverlay.classList.remove("hidden");
}

function closeSettingsPanel() {
  settingsOverlay.classList.add("hidden");
}

function getNumber(input) {
  return Number(input.value);
}

/* =========================
   設定チェック
   ========================= */

function validateSettings(newSettings) {
  if (
    !Number.isInteger(newSettings.diceSides) ||
    newSettings.diceSides < 2 ||
    newSettings.diceSides > 1000000
  ) {
    return "ダイス面数は2〜1,000,000の整数で指定してください。";
  }

  const values = [
    newSettings.criticalMin,
    newSettings.criticalMax,
    newSettings.fumbleMin,
    newSettings.fumbleMax,
  ];

  if (values.some((value) => !Number.isInteger(value))) {
    return "判定範囲は整数で指定してください。";
  }

  if (
    newSettings.criticalMin < 1 ||
    newSettings.criticalMax > newSettings.diceSides ||
    newSettings.criticalMin > newSettings.criticalMax
  ) {
    return "クリティカルの範囲が正しくありません。";
  }

  if (
    newSettings.fumbleMin < 1 ||
    newSettings.fumbleMax > newSettings.diceSides ||
    newSettings.fumbleMin > newSettings.fumbleMax
  ) {
    return "ファンブルの範囲が正しくありません。";
  }

  return null;
}

/* =========================
   設定保存
   ========================= */

async function applySettings() {
  const newSettings = {
    diceSides: getNumber(diceSidesInput),

    criticalMin: getNumber(criticalMinInput),

    criticalMax: getNumber(criticalMaxInput),

    fumbleMin: getNumber(fumbleMinInput),

    fumbleMax: getNumber(fumbleMaxInput),
  };

  const error = validateSettings(newSettings);

  if (error) {
    settingsError.textContent = error;

    return;
  }

  settings = newSettings;

  try {
    await saveSettings(settings);

    closeSettingsPanel();

    /*
     * 新しい設定で即ロール
     */
    rollDice();
  } catch (error) {
    console.error("設定の保存に失敗しました。", error);

    settingsError.textContent = "設定の保存に失敗しました。";
  }
}

/* =========================
   イベント
   ========================= */

/*
 * 数字をクリック
 * → 設定画面
 */
resultElement.addEventListener("click", openSettings);

/*
 * 設定を閉じる
 */
closeSettings.addEventListener("click", closeSettingsPanel);

/*
 * 保存
 */
saveSettingsButton.addEventListener("click", applySettings);

/*
 * 設定画面の外側
 * → 閉じる
 */
settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay) {
    closeSettingsPanel();
  }
});

/*
 * ESC
 */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettingsPanel();
  }
});

/* =========================
   背景ダブルタップ / ダブルクリック
   → リロール
   ========================= */

let lastBackgroundTap = 0;

document.addEventListener("pointerup", (event) => {
  /*
   * 数字や設定画面では
   * ダブルタップ判定しない。
   */
  if (
    event.target.closest("#result") ||
    event.target.closest("#settingsOverlay")
  ) {
    return;
  }

  const now = Date.now();

  if (now - lastBackgroundTap < 300) {
    location.reload();

    return;
  }

  lastBackgroundTap = now;
});

/* =========================
   起動
   ========================= */

async function initialize() {
  try {
    await openDatabase();

    settings = await loadSettings();

    /*
     * 設定を読み込んだあと
     * すぐロール開始。
     *
     * HTML側には初期値を
     * 書いていないので、
     * 「100から始まる」こともない。
     */
    rollDice();
  } catch (error) {
    console.error("IndexedDBの初期化に失敗しました。", error);

    settings = {
      ...DEFAULT_SETTINGS,
    };

    rollDice();
  }
}

initialize();
