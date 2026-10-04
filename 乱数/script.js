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

function getJudgement(value) {
  if (value >= settings.criticalMin && value <= settings.criticalMax) {
    return "critical";
  }

  if (value >= settings.fumbleMin && value <= settings.fumbleMax) {
    return "fumble";
  }

  return null;
}

function displayResult(value) {
  resultElement.textContent = value;

  judgementElement.textContent = "";

  judgementElement.className = "judgement";

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

function rollDice() {
  const duration = 450;
  const interval = 50;

  resultElement.classList.add("rolling");

  judgementElement.textContent = "";

  judgementElement.className = "judgement";

  const timer = setInterval(() => {
    resultElement.textContent = randomDice(settings.diceSides);
  }, interval);

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
     * 設定を変更した直後は
     * 新しい設定で一度だけロール。
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
 * 数字をクリックすると設定。
 *
 * 見た目上は普通の数字なので、
 * 隠し機能として使える。
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
 * 設定画面の外側をクリックして閉じる
 */
settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay) {
    closeSettingsPanel();
  }
});

/*
 * ESCで設定画面を閉じる
 */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettingsPanel();
  }
});

/* =========================
   起動
   ========================= */

async function initialize() {
  try {
    await openDatabase();

    settings = await loadSettings();

    /*
     * 起動時に自動ロール。
     *
     * F5でページを更新すれば
     * もう一度ロールされる。
     */
    rollDice();
  } catch (error) {
    console.error("IndexedDBの初期化に失敗しました。", error);

    /*
     * IndexedDBが使えなくても
     * デフォルト設定で動作。
     */
    settings = {
      ...DEFAULT_SETTINGS,
    };

    rollDice();
  }
}

initialize();
