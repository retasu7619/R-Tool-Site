/*
 * ========================================
 * アプリ本体
 * ========================================
 */

let saveTimer = null;


/*
 * 自動保存予約
 */
function scheduleAutoSave() {

    clearTimeout(
        saveTimer
    );


    saveTimer =
        setTimeout(
            async () => {

                await saveCurrentEssay(
                    true
                );

            },
            1000
        );

}


/*
 * 現在の文章を保存
 */
async function saveCurrentEssay(
    automatic = false
) {

    try {

        setSaveStatus(
            automatic
                ? "自動保存中..."
                : "保存中...",
            "saving"
        );


        const data =
            collectEssayData();


        await saveEssayData(
            data
        );


        setSaveStatus(
            automatic
                ? "✓ 自動保存済み"
                : "✓ 保存しました",
            "saved"
        );

    }

    catch (error) {

        console.error(
            "保存エラー:",
            error
        );


        setSaveStatus(
            "⚠ 保存に失敗しました",
            "error"
        );

    }

}


/*
 * 保存データ呼び出し
 */
async function loadSavedEssay() {

    try {

        setSaveStatus(
            "読み込み中...",
            "loading"
        );


        const data =
            await loadEssayData();


        if (data) {

            applyEssayData(
                data
            );


            setSaveStatus(
                "✓ 保存データを読み込みました",
                "saved"
            );

        }
        else {

            updateEssayUI();


            setSaveStatus(
                "✓ 新規文章",
                "saved"
            );

        }

    }

    catch (error) {

        console.error(
            "読み込みエラー:",
            error
        );


        setSaveStatus(
            "⚠ 読み込みに失敗しました",
            "error"
        );

    }

}


/*
 * 全リセット
 */
async function resetEverything() {

    const confirmed =
        window.confirm(
            "文章・提出条件・保存データをすべて削除します。\n\n本当にリセットしますか？"
        );


    if (!confirmed) {
        return;
    }


    try {

        /*
         * 文章削除
         */
        for (
            let i = 1;
            i <= 5;
            i++
        ) {

            const element =
                document.getElementById(
                    `chapter-${i}`
                );


            if (element) {

                element.value =
                    "";

            }

        }


        /*
         * 設定を初期値に戻す
         */
        setEssaySettings(
            1800,
            1900,
            2000
        );


        /*
         * DB削除
         */
        await clearEssayData();


        updateEssayUI();


        const manuscript =
            document.getElementById(
                "manuscript-pages"
            );


        if (manuscript) {

            manuscript.innerHTML =
                "";

        }


        setSaveStatus(
            "✓ すべてリセットしました",
            "saved"
        );

    }

    catch (error) {

        console.error(
            "リセットエラー:",
            error
        );


        setSaveStatus(
            "⚠ リセットに失敗しました",
            "error"
        );

    }

}


/*
 * ボタン設定
 */
function setupButtons() {

    /*
     * 保存
     */
    document
        .getElementById(
            "save-button"
        )
        ?.addEventListener(
            "click",
            () =>
                saveCurrentEssay(false)
        );


    /*
     * 呼び出し
     */
    document
        .getElementById(
            "load-button"
        )
        ?.addEventListener(
            "click",
            loadSavedEssay
        );


    /*
     * リセット
     */
    document
        .getElementById(
            "reset-button"
        )
        ?.addEventListener(
            "click",
            resetEverything
        );


    /*
     * 設定適用
     */
    document
        .getElementById(
            "apply-settings"
        )
        ?.addEventListener(
            "click",
            async () => {

                const success =
                    applySettingsFromForm();


                if (success) {

                    await saveCurrentEssay(
                        false
                    );

                }

            }
        );


    /*
     * 原稿用紙表示
     */
    document
        .getElementById(
            "preview-button"
        )
        ?.addEventListener(
            "click",
            () => {

                renderManuscriptPreview();


                document
                    .getElementById(
                        "manuscript-pages"
                    )
                    ?.scrollIntoView({
                        behavior: "smooth"
                    });

            }
        );


    /*
     * 印刷
     */
    document
        .getElementById(
            "print-button"
        )
        ?.addEventListener(
            "click",
            printManuscript
        );

}


/*
 * アプリ起動
 */
async function startApp() {

    try {

        setSaveStatus(
            "読み込み中...",
            "loading"
        );


        /*
         * IndexedDB
         */
        await openDatabase();


        /*
         * 保存データ
         */
        await loadSavedEssay();


        /*
         * ボタン
         */
        setupButtons();


        /*
         * 入力監視
         */
        setupEssayInputs(
            scheduleAutoSave
        );


        /*
         * 初期UI
         */
        updateEssayUI();


        console.log(
            "読書感想文アプリ 起動完了"
        );

    }

    catch (error) {

        console.error(
            "アプリ起動エラー:",
            error
        );


        setSaveStatus(
            "⚠ アプリの初期化に失敗しました",
            "error"
        );

    }

}


/*
 * 起動
 */
document.addEventListener(
    "DOMContentLoaded",
    startApp
);