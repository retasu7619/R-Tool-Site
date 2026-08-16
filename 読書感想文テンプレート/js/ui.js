/*
 * ========================================
 * UI
 * ========================================
 */


/*
 * 保存状態
 */
function setSaveStatus(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "save-status"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `save-status ${type}`;

}


/*
 * 提出条件UIを更新
 */
function updateSettingsUI() {

    const minInput =
        document.getElementById(
            "min-chars"
        );

    const targetInput =
        document.getElementById(
            "target-chars"
        );

    const maxInput =
        document.getElementById(
            "max-chars"
        );


    if (minInput) {

        minInput.value =
            CONFIG.essay.min;

    }


    if (targetInput) {

        targetInput.value =
            CONFIG.essay.target;

    }


    if (maxInput) {

        maxInput.value =
            CONFIG.essay.max;

    }


    /*
     * 設定表示
     */
    const minLabel =
        document.getElementById(
            "condition-min"
        );

    const targetLabel =
        document.getElementById(
            "condition-target"
        );

    const maxLabel =
        document.getElementById(
            "condition-max"
        );


    if (minLabel) {

        minLabel.textContent =
            `${CONFIG.essay.min}字`;

    }


    if (targetLabel) {

        targetLabel.textContent =
            `${CONFIG.essay.target}字`;

    }


    if (maxLabel) {

        maxLabel.textContent =
            `${CONFIG.essay.max}字`;

    }


    /*
     * 各章目標
     */
    const targets =
        getChapterTargets();


    targets.forEach(
        (target, index) => {

            const element =
                document.getElementById(
                    `chapter-${index + 1}-target`
                );


            if (element) {

                element.textContent =
                    `目標 約${target}字`;

            }

        }
    );

}


/*
 * プログレスバー更新
 */
function updateProgressBar(
    element,
    percentage,
    status
) {

    if (!element) {
        return;
    }


    const fill =
        element.querySelector(
            ".progress-fill"
        );


    if (!fill) {
        return;
    }


    fill.style.width =
        `${percentage}%`;


    fill.className =
        `progress-fill ${status}`;

}


/*
 * 全UI更新
 */
function updateEssayUI() {

    const chapters = [];


    for (
        let i = 1;
        i <= 5;
        i++
    ) {

        const element =
            document.getElementById(
                `chapter-${i}`
            );


        chapters.push(
            element
                ? element.value
                : ""
        );

    }


    const result =
        analyzeEssay(
            chapters
        );


    /*
     * 全体
     */
    const totalCount =
        document.getElementById(
            "total-count"
        );


    if (totalCount) {

        totalCount.textContent =
            `${result.total.toLocaleString()} / ${result.max.toLocaleString()}字`;

    }


    const percentage =
        document.getElementById(
            "total-percentage"
        );


    if (percentage) {

        percentage.textContent =
            `${Math.round(result.percentage)}%`;

    }


    const status =
        document.getElementById(
            "total-status"
        );


    if (status) {

        status.textContent =
            getStatusLabel(
                result.status
            );


        status.className =
            `essay-status ${result.status}`;

    }


    /*
     * ヘッダープログレス
     */
    updateProgressBar(
        document.getElementById(
            "total-progress"
        ),
        result.percentage,
        result.status
    );


    /*
     * 各章
     */
    result.chapters.forEach(
        (chapter, index) => {

            const number =
                index + 1;


            const countElement =
                document.getElementById(
                    `chapter-${number}-count`
                );


            if (countElement) {

                countElement.textContent =
                    `${chapter.count}字`;

            }


            const statusElement =
                document.getElementById(
                    `chapter-${number}-status`
                );


            if (statusElement) {

                statusElement.textContent =
                    getStatusLabel(
                        chapter.status
                    );


                statusElement.className =
                    `chapter-status ${chapter.status}`;

            }


            const progress =
                document.getElementById(
                    `chapter-${number}-progress`
                );


            updateProgressBar(
                progress,
                chapter.percentage,
                chapter.status
            );

        }
    );


    updateSettingsUI();

}


/*
 * 入力イベント
 */
function setupEssayInputs(
    onChange
) {

    for (
        let i = 1;
        i <= 5;
        i++
    ) {

        const element =
            document.getElementById(
                `chapter-${i}`
            );


        if (!element) {
            continue;
        }


        element.addEventListener(
            "input",
            () => {

                updateEssayUI();

                onChange();

            }
        );

    }

}


/*
 * 文章データ取得
 */
function collectEssayData() {

    const chapters = [];


    for (
        let i = 1;
        i <= 5;
        i++
    ) {

        const element =
            document.getElementById(
                `chapter-${i}`
            );


        chapters.push(
            element
                ? element.value
                : ""
        );

    }


    return {

        chapters,

        settings: {
            min:
                CONFIG.essay.min,

            target:
                CONFIG.essay.target,

            max:
                CONFIG.essay.max
        },

        savedAt:
            new Date().toISOString()

    };

}


/*
 * データ適用
 */
function applyEssayData(
    data
) {

    if (!data) {
        return;
    }


    /*
     * 設定
     */
    if (
        data.settings
    ) {

        try {

            setEssaySettings(
                data.settings.min,
                data.settings.target,
                data.settings.max
            );

        }
        catch (error) {

            console.warn(
                "保存されていた設定を適用できませんでした",
                error
            );

        }

    }


    /*
     * 文章
     */
    if (
        Array.isArray(
            data.chapters
        )
    ) {

        data.chapters.forEach(
            (text, index) => {

                const element =
                    document.getElementById(
                        `chapter-${index + 1}`
                    );


                if (element) {

                    element.value =
                        text || "";

                }

            }
        );

    }


    updateEssayUI();

}


/*
 * 設定変更
 */
function applySettingsFromForm() {

    const min =
        document.getElementById(
            "min-chars"
        ).value;


    const target =
        document.getElementById(
            "target-chars"
        ).value;


    const max =
        document.getElementById(
            "max-chars"
        ).value;


    try {

        setEssaySettings(
            min,
            target,
            max
        );


        updateEssayUI();


        return true;

    }

    catch (error) {

        alert(
            error.message
        );


        return false;

    }

}