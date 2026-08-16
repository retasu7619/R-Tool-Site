/*
 * ========================================
 * IndexedDB
 * ========================================
 */

let db = null;


/*
 * DBを開く
 */
function openDatabase() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    CONFIG.database.name,
                    CONFIG.database.version
                );


            request.onupgradeneeded =
                event => {

                    const database =
                        event.target.result;


                    if (
                        !database.objectStoreNames.contains(
                            CONFIG.database.store
                        )
                    ) {

                        database.createObjectStore(
                            CONFIG.database.store
                        );

                    }

                };


            request.onsuccess =
                event => {

                    db =
                        event.target.result;

                    resolve(db);

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/*
 * 保存
 */
function saveEssayData(data) {

    return new Promise(
        (resolve, reject) => {

            if (!db) {

                reject(
                    new Error(
                        "データベースが初期化されていません"
                    )
                );

                return;

            }


            const transaction =
                db.transaction(
                    CONFIG.database.store,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    CONFIG.database.store
                );


            const request =
                store.put(
                    data,
                    "current"
                );


            request.onsuccess =
                () => resolve();


            request.onerror =
                () => reject(
                    request.error
                );

        }
    );

}


/*
 * 読み込み
 */
function loadEssayData() {

    return new Promise(
        (resolve, reject) => {

            if (!db) {

                reject(
                    new Error(
                        "データベースが初期化されていません"
                    )
                );

                return;

            }


            const transaction =
                db.transaction(
                    CONFIG.database.store,
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    CONFIG.database.store
                );


            const request =
                store.get(
                    "current"
                );


            request.onsuccess =
                () => {

                    resolve(
                        request.result || null
                    );

                };


            request.onerror =
                () => reject(
                    request.error
                );

        }
    );

}


/*
 * 全削除
 */
function clearEssayData() {

    return new Promise(
        (resolve, reject) => {

            if (!db) {

                reject(
                    new Error(
                        "データベースが初期化されていません"
                    )
                );

                return;

            }


            const transaction =
                db.transaction(
                    CONFIG.database.store,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    CONFIG.database.store
                );


            const request =
                store.clear();


            request.onsuccess =
                () => resolve();


            request.onerror =
                () => reject(
                    request.error
                );

        }
    );

}