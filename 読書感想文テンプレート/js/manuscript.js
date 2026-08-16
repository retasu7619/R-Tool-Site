/*
 * ========================================
 * 原稿用紙エンジン
 * ========================================
 */


function getManuscriptChapters() {

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


    return chapters;

}


/*
 * 文章を行に変換
 */
function convertChaptersToLines(
    chapters
) {

    const lines = [];


    chapters.forEach(
        (chapter, chapterIndex) => {

            if (
                !chapter ||
                chapter.trim() === ""
            ) {

                return;

            }


            const normalized =
                chapter.replace(
                    /\r\n/g,
                    "\n"
                );


            const paragraphs =
                normalized.split("\n");


            paragraphs.forEach(
                paragraph => {

                    if (
                        paragraph.length === 0
                    ) {

                        lines.push([]);

                        return;

                    }


                    /*
                     * 段落先頭1マス
                     */
                    const line =
                        [""];


                    line.push(
                        ...Array.from(
                            paragraph
                        )
                    );


                    lines.push(
                        line
                    );

                }
            );


            /*
             * 章間
             */
            if (
                chapterIndex <
                chapters.length - 1
            ) {

                const next =
                    chapters[
                        chapterIndex + 1
                    ];


                if (
                    next &&
                    next.trim() !== ""
                ) {

                    lines.push([]);

                }

            }

        }
    );


    return lines;

}


/*
 * ページ生成
 */
function buildManuscriptPages(
    chapters
) {

    const columns =
        CONFIG.manuscript.columns;

    const rows =
        CONFIG.manuscript.rows;

    const cells =
        columns * rows;


    const lines =
        convertChaptersToLines(
            chapters
        );


    const pages = [];


    let page =
        Array(cells).fill("");


    let row = 0;


    function nextPage() {

        pages.push(page);

        page =
            Array(cells).fill("");

        row = 0;

    }


    for (
        const line of lines
    ) {

        if (
            line.length === 0
        ) {

            row++;


            if (
                row >= rows
            ) {

                nextPage();

            }


            continue;

        }


        for (
            let i = 0;
            i < line.length;
            i++
        ) {

            if (
                i > 0 &&
                i % columns === 0
            ) {

                row++;

            }


            if (
                row >= rows
            ) {

                nextPage();

            }


            const column =
                i % columns;


            const index =
                row *
                columns +
                column;


            page[index] =
                line[i];

        }


        row++;


        if (
            row >= rows
        ) {

            nextPage();

        }

    }


    if (
        pages.length === 0 ||
        page.some(
            cell => cell !== ""
        )
    ) {

        pages.push(page);

    }


    return pages;

}


/*
 * プレビュー描画
 */
function renderManuscriptPreview() {

    const container =
        document.getElementById(
            "manuscript-pages"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const chapters =
        getManuscriptChapters();


    const pages =
        buildManuscriptPages(
            chapters
        );


    pages.forEach(
        (cells, pageIndex) => {

            const page =
                document.createElement(
                    "div"
                );


            page.className =
                "manuscript-page";


            const grid =
                document.createElement(
                    "div"
                );


            grid.className =
                "manuscript-grid";


            cells.forEach(
                character => {

                    const cell =
                        document.createElement(
                            "div"
                        );


                    cell.className =
                        "manuscript-cell";


                    cell.textContent =
                        character;


                    grid.appendChild(
                        cell
                    );

                }
            );


            page.appendChild(
                grid
            );


            const pageNumber =
                document.createElement(
                    "div"
                );


            pageNumber.className =
                "manuscript-page-number";


            pageNumber.textContent =
                `${pageIndex + 1} / ${pages.length}`;


            page.appendChild(
                pageNumber
            );


            container.appendChild(
                page
            );

        }
    );

}


/*
 * 印刷プレビュー
 */
function printManuscript() {

    renderManuscriptPreview();

    window.print();

}