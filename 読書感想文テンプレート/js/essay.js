/*
 * ========================================
 * 読書感想文 判定エンジン
 * ========================================
 */


/*
 * 現在の設定
 */
function getEssaySettings() {

    return {
        min: CONFIG.essay.min,
        target: CONFIG.essay.target,
        max: CONFIG.essay.max
    };

}


/*
 * 設定を変更
 */
function setEssaySettings(
    min,
    target,
    max
) {

    min =
        Number(min);

    target =
        Number(target);

    max =
        Number(max);


    if (
        !Number.isFinite(min) ||
        !Number.isFinite(target) ||
        !Number.isFinite(max)
    ) {

        throw new Error(
            "文字数設定が正しくありません"
        );

    }


    if (
        min < 0 ||
        target < 0 ||
        max < 0
    ) {

        throw new Error(
            "文字数は0以上にしてください"
        );

    }


    if (
        min > target
    ) {

        throw new Error(
            "下限は目標以下にしてください"
        );

    }


    if (
        target > max
    ) {

        throw new Error(
            "目標は上限以下にしてください"
        );

    }


    CONFIG.essay.min =
        Math.floor(min);

    CONFIG.essay.target =
        Math.floor(target);

    CONFIG.essay.max =
        Math.floor(max);

}


/*
 * 文字数
 *
 * 改行は数えない
 */
function countCharacters(text) {

    if (!text) {
        return 0;
    }


    return Array.from(
        text.replace(
            /\r?\n/g,
            ""
        )
    ).length;

}


/*
 * 各章の文字数
 */
function getChapterCharacterCounts(
    chapters
) {

    return chapters.map(
        text =>
            countCharacters(text)
    );

}


/*
 * 全体文字数
 */
function getTotalCharacters(
    chapters
) {

    return chapters.reduce(
        (sum, text) =>
            sum +
            countCharacters(text),
        0
    );

}


/*
 * 各章の目標文字数
 */
function getChapterTargets() {

    return CONFIG.chapters.map(
        chapter => {

            return Math.round(
                CONFIG.essay.target *
                chapter.ratio /
                100
            );

        }
    );

}


/*
 * 各章の許容幅
 *
 * 全体の
 * 「上限 - 下限」
 * を5章で割る。
 */
function getChapterTolerance() {

    const width =
        CONFIG.essay.max -
        CONFIG.essay.min;


    return width /
        CONFIG.chapters.length;

}


/*
 * 全体状態
 */
function getTotalStatus(
    count
) {

    if (
        count >
        CONFIG.essay.max
    ) {

        return "long";

    }


    if (
        count <
        CONFIG.essay.min
    ) {

        return "short";

    }


    return "appropriate";

}


/*
 * 全体プログレス
 *
 * 上限を100%とする。
 */
function getTotalPercentage(
    count
) {

    if (
        CONFIG.essay.max <= 0
    ) {

        return 0;

    }


    return Math.min(
        100,
        Math.max(
            0,
            count /
            CONFIG.essay.max *
            100
        )
    );

}


/*
 * 各章の状態
 */
function getChapterStatus(
    count,
    target
) {

    const tolerance =
        getChapterTolerance();


    /*
     * 章の下側許容範囲
     */
    const lower =
        Math.max(
            0,
            target -
            tolerance / 2
        );


    /*
     * 章の上側許容範囲
     */
    const upper =
        target +
        tolerance / 2;


    /*
     * 上限超過は絶対NG
     */
    if (
        count > upper
    ) {

        return "long";

    }


    if (
        count < lower
    ) {

        return "short";

    }


    return "appropriate";

}


/*
 * 章の進捗
 *
 * 目標に対して何%か
 */
function getChapterPercentage(
    count,
    target
) {

    if (
        target <= 0
    ) {

        return 0;

    }


    return Math.min(
        100,
        Math.max(
            0,
            count /
            target *
            100
        )
    );

}


/*
 * 全体解析
 */
function analyzeEssay(
    chapters
) {

    const counts =
        getChapterCharacterCounts(
            chapters
        );


    const total =
        getTotalCharacters(
            chapters
        );


    const targets =
        getChapterTargets();


    const chapterResults =
        counts.map(
            (count, index) => {

                const target =
                    targets[index];


                return {

                    count,

                    target,

                    ratio:
                        CONFIG.chapters[
                            index
                        ].ratio,

                    percentage:
                        getChapterPercentage(
                            count,
                            target
                        ),

                    status:
                        getChapterStatus(
                            count,
                            target
                        )

                };

            }
        );


    return {

        total,

        min:
            CONFIG.essay.min,

        target:
            CONFIG.essay.target,

        max:
            CONFIG.essay.max,

        percentage:
            getTotalPercentage(
                total
            ),

        status:
            getTotalStatus(
                total
            ),

        chapters:
            chapterResults

    };

}


/*
 * 状態を日本語に変換
 */
function getStatusLabel(
    status
) {

    switch (status) {

        case "short":
            return "短め";

        case "long":
            return "長め";

        case "appropriate":
            return "適切";

        default:
            return "不明";

    }

}