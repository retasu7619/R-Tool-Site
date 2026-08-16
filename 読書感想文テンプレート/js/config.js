/*
 * ========================================
 * 読書感想文アプリ 設定
 * ========================================
 */

const CONFIG = {

    essay: {
        min: 1800,
        target: 1900,
        max: 2000
    },

    chapters: [
        {
            name: "導入",
            ratio: 15
        },
        {
            name: "引用と発見",
            ratio: 20
        },
        {
            name: "考察",
            ratio: 25
        },
        {
            name: "比較",
            ratio: 25
        },
        {
            name: "結び",
            ratio: 15
        }
    ],

    manuscript: {
        columns: 20,
        rows: 20
    },

    database: {
        name: "ReadingEssayDB",
        version: 2,
        store: "essay"
    }

};