// スケジュール管理アプリケーション
class ScheduleManager {
    constructor() {
        this.schedules = {};
        this.currentCell = null;
        this.selectedCells = new Set();
        this.isSelecting = false;
        this.startCell = null;
        this.init();
    }

    init() {
        this.generateTimeSlots();
        this.bindEvents();
        this.loadSchedules();
        this.updateCurrentTimeHighlight();
        this.startTimeUpdater();
        this.updateTimeDisplay();
        this.startClockUpdater();
        this.highlightToday();
    }

    // 今日の曜日ヘッダーを強調
    highlightToday() {
        const dayIndex = new Date().getDay(); // 0(日)~6(土)
        const map = ['sun','mon','tue','wed','thu','fri','sat'];
        const todayKey = map[dayIndex];
        const th = document.querySelector(`th[data-day="${todayKey}"]`);
        if (th) th.classList.add('current-day');
    }

    // 15分刻みの時間スロットを生成
    generateTimeSlots() {
        const tbody = document.getElementById('scheduleBody');
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        
        for (let hour = 0; hour <= 24; hour++) {
            // 24:00の場合は00分のみ表示
            const maxMinute = hour === 24 ? 1 : 60;
            for (let minute = 0; minute < maxMinute; minute += 15) {
                let timeString;
                if (hour === 24 && minute === 0) {
                    timeString = '24:00';
                } else if (hour === 24) {
                    continue; // 24:00以外は表示しない
                } else {
                    timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                }
                const row = document.createElement('tr');
                
                // 時間セル
                const timeCell = document.createElement('td');
                timeCell.className = 'time-cell';
                timeCell.textContent = timeString;
                timeCell.dataset.time = timeString;
                row.appendChild(timeCell);
                
                // 各曜日のセル
                days.forEach(day => {
                    const cell = document.createElement('td');
                    cell.className = 'schedule-cell';
                    cell.dataset.time = timeString;
                    cell.dataset.day = day;
                    cell.dataset.id = `${day}-${timeString}`;
                    row.appendChild(cell);
                });
                
                tbody.appendChild(row);
            }
        }
    }

    // イベントリスナーの設定
    bindEvents() {
        // スケジュールセルのクリック・選択
        document.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('schedule-cell')) {
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    // 選択モード
                    e.preventDefault();
                    this.startSelection(e.target);
                } else {
                    // 通常の編集モード
                    this.clearSelection();
                    this.openEditModal(e.target);
                }
            } else {
                this.clearSelection();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isSelecting && e.target.classList.contains('schedule-cell')) {
                this.updateSelection(e.target);
            }
        });

        document.addEventListener('mouseup', () => {
            this.isSelecting = false;
        });

        // モーダル関連
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('saveEvent').addEventListener('click', () => {
            this.saveEvent();
        });

        document.getElementById('deleteEvent').addEventListener('click', () => {
            this.deleteEvent();
        });

        document.getElementById('cancelEvent').addEventListener('click', () => {
            this.closeModal();
        });

        // クリアボタン
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAllSchedules();
        });

        // 保存ボタン
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveToLocalStorage();
            alert('スケジュールを保存しました！');
        });
        
        // 現在時刻にジャンプするボタンを追加
        this.addCurrentTimeButton();
        
        // 選択削除ボタンを追加
        this.addSelectionDeleteButton();
        
        // 設定モーダル
        this.bindSettingsEvents();

        // モーダル外クリックで閉じる
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeModal();
            }
        });

        // Enterキーで保存
        document.getElementById('eventTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveEvent();
            }
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // Delete/Backspaceキーで選択したセルを削除
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedCells.size > 0) {
                e.preventDefault();
                this.deleteSelectedCells();
            }
            // Escapeキーで選択解除
            if (e.key === 'Escape') {
                this.clearSelection();
            }
        });
    }

    // 編集モーダルを開く
    openEditModal(cell) {
        this.currentCell = cell;
        const modal = document.getElementById('editModal');
        const titleInput = document.getElementById('eventTitle');
        const colorSelect = document.getElementById('eventColor');
        const deleteBtn = document.getElementById('deleteEvent');
        
        const cellId = cell.dataset.id;
        const schedule = this.schedules[cellId];
        
        if (schedule) {
            titleInput.value = schedule.title;
            colorSelect.value = schedule.color;
            deleteBtn.style.display = 'block';
        } else {
            titleInput.value = '';
            colorSelect.value = 'blue';
            deleteBtn.style.display = 'none';
        }
        
        modal.style.display = 'block';
        titleInput.focus();
    }

    // モーダルを閉じる
    closeModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentCell = null;
    }

    // イベントを保存
    saveEvent() {
        if (!this.currentCell) return;
        
        const title = document.getElementById('eventTitle').value.trim();
        const color = document.getElementById('eventColor').value;
        const cellId = this.currentCell.dataset.id;
        
        if (title) {
            this.schedules[cellId] = { title, color };
            this.updateCellDisplay(this.currentCell, title, color);
        } else {
            this.deleteEvent();
        }
        
        this.closeModal();
        this.saveToLocalStorage();
    }

    // イベントを削除
    deleteEvent() {
        if (!this.currentCell) return;
        
        const cellId = this.currentCell.dataset.id;
        delete this.schedules[cellId];
        this.clearCellDisplay(this.currentCell);
        this.closeModal();
        this.saveToLocalStorage();
    }

    // セルの表示を更新
    updateCellDisplay(cell, title, color) {
        cell.textContent = title;
        cell.className = `schedule-cell has-event ${color}`;
        // セル結合処理を実行
        this.mergeCells();
    }

    // セルの表示をクリア
    clearCellDisplay(cell) {
        cell.textContent = '';
        cell.className = 'schedule-cell';
        cell.style.display = '';
        cell.rowSpan = 1;
        // セル結合処理を実行
        this.mergeCells();
    }

    // 全スケジュールをクリア
    clearAllSchedules() {
        if (confirm('全てのスケジュールを削除しますか？')) {
            this.schedules = {};
            const cells = document.querySelectorAll('.schedule-cell');
            cells.forEach(cell => {
                cell.textContent = '';
                cell.className = 'schedule-cell';
                cell.style.display = '';
                cell.rowSpan = 1;
            });
            this.saveToLocalStorage();
        }
    }

    // ローカルストレージに保存
    saveToLocalStorage() {
        try {
            localStorage.setItem('scheduleData', JSON.stringify(this.schedules));
        } catch (error) {
            console.error('保存に失敗しました:', error);
            alert('保存に失敗しました。ブラウザの設定を確認してください。');
        }
    }

    // ローカルストレージから読み込み
    loadSchedules() {
        try {
            const saved = localStorage.getItem('scheduleData');
            if (saved) {
                this.schedules = JSON.parse(saved);
                this.renderSchedules();
            }
        } catch (error) {
            console.error('読み込みに失敗しました:', error);
            this.schedules = {};
        }
    }

    // 保存されたスケジュールを画面に反映
    renderSchedules() {
        Object.keys(this.schedules).forEach(cellId => {
            const cell = document.querySelector(`[data-id="${cellId}"]`);
            if (cell) {
                const schedule = this.schedules[cellId];
                cell.textContent = schedule.title;
                cell.className = `schedule-cell has-event ${schedule.color}`;
            }
        });
        // 全体のセル結合処理を実行
        this.mergeCells();
    }

    // 現在時刻のハイライト更新
    updateCurrentTimeHighlight() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // 15分単位に丸める
        const roundedMinute = Math.floor(currentMinute / 15) * 15;
        const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;
        
        // 全ての時間セルのハイライトをリセット
        const allTimeCells = document.querySelectorAll('.time-cell');
        allTimeCells.forEach(cell => {
            cell.classList.remove('current-time', 'next-time', 'near-time', 'far-time');
            cell.style.fontSize = '';
            cell.style.fontWeight = '';
            cell.style.backgroundColor = '';
            cell.style.transform = '';
            cell.style.transition = '';
            cell.style.borderRadius = '';
            cell.style.color = '';
        });
        
        // 現在時刻周辺をハイライト
        allTimeCells.forEach(cell => {
            const cellTime = cell.dataset.time;
            if (cellTime) {
                const [cellHour, cellMinute] = cellTime.split(':').map(Number);
                const cellTotalMinutes = cellHour * 60 + cellMinute;
                const currentTotalMinutes = currentHour * 60 + roundedMinute;
                const timeDiff = Math.abs(cellTotalMinutes - currentTotalMinutes);
                
                // 次の15分区切りを計算
                const nextSlotMinutes = currentTotalMinutes + (15 - (currentTotalMinutes % 15));
                const nextSlotDiff = cellTotalMinutes - nextSlotMinutes;
                
                // 時間差に応じてスタイルを適用
                if (nextSlotDiff === 0) {
                    // 次の15分区切り（最大サイズ）
                    cell.classList.add('next-time');
                    cell.style.fontSize = '16px';
                    cell.style.fontWeight = '800';
                    cell.style.backgroundColor = '#2E86AB';
                    cell.style.color = 'white';
                    cell.style.transition = 'all 0.3s ease';
                    cell.style.borderRadius = '6px';
                } else if (timeDiff === 0) {
                    // 現在時刻（大きめ）
                    cell.classList.add('current-time');
                    cell.style.fontSize = '15px';
                    cell.style.fontWeight = '700';
                    cell.style.backgroundColor = '#5DADE2';
                    cell.style.color = '#2C3E50';
                    cell.style.transition = 'all 0.3s ease';
                    cell.style.borderRadius = '4px';
                } else if (timeDiff <= 15) {
                    // ±15分（中サイズ）
                    cell.classList.add('near-time');
                    cell.style.fontSize = '14px';
                    cell.style.fontWeight = '650';
                    cell.style.backgroundColor = '#85C1E9';
                    cell.style.color = '#34495E';
                    cell.style.transition = 'all 0.3s ease';
                    cell.style.borderRadius = '4px';
                } else if (timeDiff <= 30) {
                    // ±30分（小さめ）
                    cell.classList.add('near-time');
                    cell.style.fontSize = '13px';
                    cell.style.fontWeight = '600';
                    cell.style.backgroundColor = '#AED6F1';
                    cell.style.color = '#2C3E50';
                    cell.style.transition = 'all 0.3s ease';
                    cell.style.borderRadius = '4px';
                } else if (timeDiff <= 60) {
                    // ±1時間（最小）
                    cell.classList.add('far-time');
                    cell.style.fontSize = '12.5px';
                    cell.style.fontWeight = '550';
                    cell.style.backgroundColor = '#D6EAF8';
                    cell.style.color = '#34495E';
                    cell.style.transition = 'all 0.3s ease';
                    cell.style.borderRadius = '4px';
                }
            }
        });
    }
    
    // 時間更新を開始
    startTimeUpdater() {
        // 1分ごとに更新
        setInterval(() => {
            this.updateCurrentTimeHighlight();
        }, 60000);
        
        // 15秒ごとにも軽く更新（より精密）
        setInterval(() => {
            const now = new Date();
            if (now.getSeconds() % 15 === 0) {
                this.updateCurrentTimeHighlight();
            }
        }, 15000);
    }
    
    // 現在時刻ボタンを追加
    addCurrentTimeButton() {
        const controls = document.querySelector('.controls');
        const currentTimeBtn = document.createElement('button');
        currentTimeBtn.id = 'currentTimeBtn';
        currentTimeBtn.textContent = '現在時刻へ';
        currentTimeBtn.addEventListener('click', () => {
            this.scrollToCurrentTime();
        });
        controls.insertBefore(currentTimeBtn, controls.firstChild);
    }
    
    // 現在時刻にスクロール
    scrollToCurrentTime() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const roundedMinute = Math.floor(currentMinute / 15) * 15;
        const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;
        
        const currentTimeCell = document.querySelector(`[data-time="${currentTimeString}"]`);
        if (currentTimeCell) {
            currentTimeCell.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
        }
    }
    
    // 時刻表示を更新
    updateTimeDisplay() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        
        const hoursElement = document.getElementById('timeHours');
        const minutesElement = document.getElementById('timeMinutes');
        
        if (hoursElement) hoursElement.textContent = hours;
        if (minutesElement) minutesElement.textContent = minutes;
    }
    
    // 時計の更新を開始
    startClockUpdater() {
        // 1秒ごとに時刻表示を更新
        setInterval(() => {
            this.updateTimeDisplay();
        }, 1000);
    }
    
    // セル結合処理
    mergeCells() {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        
        days.forEach(day => {
            // まず全てのセルをリセット
            const dayCells = document.querySelectorAll(`[data-day="${day}"]`);
            dayCells.forEach(cell => {
                cell.style.display = '';
                cell.rowSpan = 1;
            });
            
            // 時間順にソートされたセルを取得
            const sortedCells = Array.from(dayCells).sort((a, b) => {
                const timeA = a.dataset.time;
                const timeB = b.dataset.time;
                return timeA.localeCompare(timeB);
            });
            
            let mergeStart = null;
            let mergeCount = 0;
            let lastTitle = null;
            let lastColor = null;
            
            for (let i = 0; i < sortedCells.length; i++) {
                const cell = sortedCells[i];
                const cellId = cell.dataset.id;
                const schedule = this.schedules[cellId];
                
                if (schedule) {
                    const currentTitle = schedule.title;
                    const currentColor = schedule.color;
                    
                    if (currentTitle === lastTitle && currentColor === lastColor && mergeStart) {
                        // 同じ予定が連続している場合
                        mergeCount++;
                        cell.style.display = 'none'; // このセルを非表示
                    } else {
                        // 前の結合を完了
                        if (mergeStart && mergeCount > 0) {
                            mergeStart.rowSpan = mergeCount + 1;
                        }
                        
                        // 新しい結合を開始
                        mergeStart = cell;
                        mergeCount = 0;
                        lastTitle = currentTitle;
                        lastColor = currentColor;
                    }
                } else {
                    // 予定がない場合、前の結合を完了
                    if (mergeStart && mergeCount > 0) {
                        mergeStart.rowSpan = mergeCount + 1;
                    }
                    mergeStart = null;
                    mergeCount = 0;
                    lastTitle = null;
                    lastColor = null;
                }
            }
            
            // 最後の結合を完了
            if (mergeStart && mergeCount > 0) {
                mergeStart.rowSpan = mergeCount + 1;
            }
        });
    }
    
    // 選択開始
    startSelection(cell) {
        this.isSelecting = true;
        this.startCell = cell;
        this.selectedCells.clear();
        this.selectedCells.add(cell);
        this.updateSelectionDisplay();
    }
    
    // 選択更新
    updateSelection(endCell) {
        if (!this.startCell || !endCell) return;
        
        this.selectedCells.clear();
        
        const startDay = this.startCell.dataset.day;
        const endDay = endCell.dataset.day;
        const startTime = this.startCell.dataset.time;
        const endTime = endCell.dataset.time;
        
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const startDayIndex = days.indexOf(startDay);
        const endDayIndex = days.indexOf(endDay);
        
        // 時間を分に変換して比較
        const timeToMinutes = (timeStr) => {
            const [hour, minute] = timeStr.split(':').map(Number);
            return hour * 60 + minute;
        };
        
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        
        // 範囲を正規化
        const minDay = Math.min(startDayIndex, endDayIndex);
        const maxDay = Math.max(startDayIndex, endDayIndex);
        const minMinutes = Math.min(startMinutes, endMinutes);
        const maxMinutes = Math.max(startMinutes, endMinutes);
        
        // 選択範囲内のすべてのセルを選択
        for (let dayIndex = minDay; dayIndex <= maxDay; dayIndex++) {
            const day = days[dayIndex];
            const dayCells = document.querySelectorAll(`[data-day="${day}"]`);
            
            dayCells.forEach(cell => {
                const cellMinutes = timeToMinutes(cell.dataset.time);
                if (cellMinutes >= minMinutes && cellMinutes <= maxMinutes) {
                    this.selectedCells.add(cell);
                }
            });
        }
        
        this.updateSelectionDisplay();
    }
    
    // 選択表示更新
    updateSelectionDisplay() {
        // 全セルの選択状態をリセット
        document.querySelectorAll('.schedule-cell').forEach(cell => {
            cell.classList.remove('selected');
        });
        
        // 選択されたセルにクラス追加
        this.selectedCells.forEach(cell => {
            cell.classList.add('selected');
        });
        
        // 選択削除ボタンの表示更新
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        if (deleteBtn) {
            deleteBtn.style.display = this.selectedCells.size > 0 ? 'block' : 'none';
            deleteBtn.textContent = `選択削除 (${this.selectedCells.size})`;
        }
    }
    
    // 選択クリア
    clearSelection() {
        this.selectedCells.clear();
        this.isSelecting = false;
        this.startCell = null;
        this.updateSelectionDisplay();
    }
    
    // 選択削除ボタンを追加
    addSelectionDeleteButton() {
        const controls = document.querySelector('.controls');
        const deleteSelectedBtn = document.createElement('button');
        deleteSelectedBtn.id = 'deleteSelectedBtn';
        deleteSelectedBtn.textContent = '選択削除 (0)';
        deleteSelectedBtn.style.display = 'none';
        deleteSelectedBtn.addEventListener('click', () => {
            this.deleteSelectedCells();
        });
        controls.insertBefore(deleteSelectedBtn, controls.firstChild);
    }
    
    // 選択されたセルを削除
    deleteSelectedCells() {
        if (this.selectedCells.size === 0) return;
        
        if (confirm(`${this.selectedCells.size}個の選択されたスケジュールを削除しますか？`)) {
            this.selectedCells.forEach(cell => {
                const cellId = cell.dataset.id;
                delete this.schedules[cellId];
                this.clearCellDisplay(cell);
            });
            
            this.clearSelection();
            this.saveToLocalStorage();
            this.mergeCells();
        }
    }

    // 設定モーダルイベント
    bindSettingsEvents() {
        // 設定モーダルを開く
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').style.display = 'block';
        });
        
        // 設定モーダルを閉じる
        document.getElementById('closeSettings').addEventListener('click', () => {
            document.getElementById('settingsModal').style.display = 'none';
        });
        
        // モーダル外クリックで閉じる
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                document.getElementById('settingsModal').style.display = 'none';
            }
        });
        
        // JSON エクスポート
        document.getElementById('exportJsonBtn').addEventListener('click', () => {
            this.exportToJson();
            document.getElementById('settingsModal').style.display = 'none';
        });
        
        // インポート
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        
        document.getElementById('importFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importFromFile(file);
                e.target.value = ''; // ファイル選択をリセット
                document.getElementById('settingsModal').style.display = 'none';
            }
        });
    }
    
    // JSON エクスポート
    exportToJson() {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            schedules: this.schedules
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `schedule-${this.getDateString()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('JSONファイルをダウンロードしました！');
    }
    

    
    // ファイルからインポート
    importFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (file.name.endsWith('.json')) {
                    this.importFromJson(e.target.result);
                } else {
                    alert('JSONファイルを選択してください。');
                }
            } catch (error) {
                console.error('インポートエラー:', error);
                alert('ファイルの読み込みに失敗しました。ファイル形式を確認してください。');
            }
        };
        reader.readAsText(file);
    }
    
    // JSON インポート
    importFromJson(jsonText) {
        const data = JSON.parse(jsonText);
        
        // 新形式（version 1.0以降）
        if (data.version && data.schedules) {
            this.schedules = data.schedules;
        }
        // 旧形式（直接スケジュールオブジェクト）
        else if (typeof data === 'object') {
            this.schedules = data;
        }
        else {
            throw new Error('無効なJSON形式です');
        }
        
        this.renderSchedules();
        this.saveToLocalStorage();
        alert('JSONファイルからスケジュールをインポートしました！');
    }
    

    
    // 日付文字列を生成
    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    }


}

// DOM読み込み完了後にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    const app = new ScheduleManager();
    
    // グローバルに公開（デバッグ用）
    window.scheduleApp = app;
    
    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
        // Ctrl+S で保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            app.saveToLocalStorage();
            alert('スケジュールを保存しました！');
        }
        
        // Escキーでモーダルを閉じる
        if (e.key === 'Escape') {
            app.closeModal();
        }
    });
    
    console.log('スケジュール管理アプリケーションが正常に初期化されました。');
});