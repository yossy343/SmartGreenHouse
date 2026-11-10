// ==========================================
// SUPABASE CONFIGURATION (PROJECT: umkubfawtnkdrwtprbnj)
// ==========================================
const SUPABASE_URL = "https://umkubfawtnkdrwtprbnj.supabase.co";
const SUPABASE_KEY = "sb_publishable_lt8ctuO2bz756MP2aTvaUA_IVvPt8bl";

// CONFIGURATION
const TIME_ZONE = "Asia/Bangkok";
const PAGE_SIZE = 1000;
const LUX_TO_PPFD_FACTOR = 0.0185;

// GLOBAL VARIABLES
let selectedGreenhouseID = null;
let selectedSensorID = null;
let selectedDate = null;
let selectedDisplayMode = "separated";
let dliTarget = 15.0;
let lampCount = 0;
let lampWatt = 0;
let currentRelayStatus = false;
let currentIntensity = 0;

let sensorList = [];
let greenhouseList = [];
let historyData = [];
let autoRefreshTimer = null;
let historyLoading = false;
let targetProfileData = [];

let historyLastTimestamp = null;
let historyInitialized = false;
let historyGreenhouseID = null;
let historyDate = null;

const SENSOR_ROLE_OVERRIDE = {};
let sensorRoleMap = {};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async function () {
    console.log("Dashboard Starting...");
    initializeDate();
    setupEvents();
    await loadGreenhouses();
    startAutoRefresh();
});

function switchTab(tabId, event) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    if (event && event.target) event.target.classList.add('active');

    if (tabId === 'summary') {
        syncAndLoadSummaryTable();
    }
}

async function loadSummaryTableData() {
    const tbody = document.getElementById("summaryArchiveTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">กำลังโหลดข้อมูลสรุปย้อนหลัง...</td></tr>';

    try {
        let url = `${SUPABASE_URL}/rest/v1/daily_light_summary?select=*&order=summary_date.desc,greenhouse_id.asc&limit=100`;
        if (selectedGreenhouseID) {
            url = `${SUPABASE_URL}/rest/v1/daily_light_summary?select=*&greenhouse_id=eq.${selectedGreenhouseID}&order=summary_date.desc&limit=100`;
        }

        const response = await fetch(url, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        tbody.innerHTML = "";
        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted);">ไม่พบข้อมูลสรุปย้อนหลังในฐานข้อมูล</td></tr>';
            return;
        }

        data.forEach(row => {
            const targetVal = (row.target_dli !== undefined && row.target_dli !== null) ? row.target_dli : row.Target_DLI;
            const powerCons = (row.power_consumption !== undefined && row.power_consumption !== null) 
                ? Number(row.power_consumption).toFixed(3) 
                : ((row.energy_kwh !== undefined && row.energy_kwh !== null) ? Number(row.energy_kwh).toFixed(3) : '-');

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${row.summary_date || '-'}</strong></td>
                <td>${row.greenhouse_id || '-'}</td>
                <td>${row.s1_dli !== null ? Number(row.s1_dli).toFixed(2) : '-'}</td>
                <td>${row.s2_dli !== null ? Number(row.s2_dli).toFixed(2) : '-'}</td>
                <td><strong style="color: #2563eb;">${row.comb_dli !== null ? Number(row.comb_dli).toFixed(2) : '-'}</strong></td>
                <td><strong style="color: #e11d48;">${targetVal !== undefined && targetVal !== null ? Number(targetVal).toFixed(2) : '-'}</strong></td>
                <td>${row.s2_on_hours !== undefined && row.s2_on_hours !== null ? Number(row.s2_on_hours).toFixed(1) + ' ชม.' : '-'}</td>
                <td>${row.s2_avg_dimming !== undefined && row.s2_avg_dimming !== null ? Math.round(row.s2_avg_dimming) + '%' : '-'}</td>
                <td><strong style="color: #f59e0b;">${powerCons}</strong></td>
                <td>${row.comb_lux_min ?? '-'} / ${row.comb_lux_avg ?? '-'} / ${row.comb_lux_max ?? '-'}</td>
                <td><small>${row.updated_at ? formatThaiTimestamp(row.updated_at) : '-'}</small></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("loadSummaryTableData() ERROR:", error);
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #c62828;">โหลดข้อมูลสรุปย้อนหลังล้มเหลว</td></tr>';
    }
}

/*
async function loadSummaryTableData() {
    const tbody = document.getElementById("summaryArchiveTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">กำลังโหลดข้อมูลสรุปย้อนหลัง...</td></tr>';

    try {
        // เพิ่ม limit เป็น 365 หรือเอา limit ออกเพื่อให้แสดงผลข้อมูลย้อนหลังทั้งหมดได้อย่างครบถ้วน
        let url = `${SUPABASE_URL}/rest/v1/daily_light_summary?select=*&order=summary_date.desc,greenhouse_id.asc&limit=365`;
        if (selectedGreenhouseID) {
            url = `${SUPABASE_URL}/rest/v1/daily_light_summary?select=*&greenhouse_id=eq.${selectedGreenhouseID}&order=summary_date.desc&limit=365`;
        }

        const response = await fetch(url, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        tbody.innerHTML = "";
        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted);">ไม่พบข้อมูลสรุปย้อนหลังในฐานข้อมูล</td></tr>';
            return;
        }

        data.forEach(row => {
            const targetVal = (row.target_dli !== undefined && row.target_dli !== null) ? row.target_dli : row.Target_DLI;
            const powerCons = (row.power_consumption !== undefined && row.power_consumption !== null) 
                ? Number(row.power_consumption).toFixed(3) 
                : ((row.energy_kwh !== undefined && row.energy_kwh !== null) ? Number(row.energy_kwh).toFixed(3) : '-');

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${row.summary_date || '-'}</strong></td>
                <td>${row.greenhouse_id || '-'}</td>
                <td>${row.s1_dli !== null ? Number(row.s1_dli).toFixed(2) : '-'}</td>
                <td>${row.s2_dli !== null ? Number(row.s2_0_dli ?? row.s2_dli).toFixed(2) : '-'}</td>
                <td><strong style="color: #2563eb;">${row.comb_dli !== null ? Number(row.comb_dli).toFixed(2) : '-'}</strong></td>
                <td><strong style="color: #e11d48;">${targetVal !== undefined && targetVal !== null ? Number(targetVal).toFixed(2) : '-'}</strong></td>
                <td>${row.s2_on_hours !== undefined && row.s2_on_hours !== null ? Number(row.s2_on_hours).toFixed(1) + ' ชม.' : '-'}</td>
                <td>${row.s2_avg_dimming !== undefined && row.s2_avg_dimming !== null ? Math.round(row.s2_avg_dimming) + '%' : '-'}</td>
                <td><strong style="color: #f59e0b;">${powerCons}</strong></td>
                <td>${row.comb_lux_min ?? '-'} / ${row.comb_lux_avg ?? '-'} / ${row.comb_lux_max ?? '-'}</td>
                <td><small>${row.updated_at ? formatThaiTimestamp(row.updated_at) : '-'}</small></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("loadSummaryTableData() ERROR:", error);
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #c62828;">โหลดข้อมูลสรุปย้อนหลังล้มเหลว</td></tr>';
    }
}
    */
function initializeDate() {
    const today = getTodayThailand();
    selectedDate = today;
    const dateEl = document.getElementById("dateSelect");
    if (dateEl) dateEl.value = today;
}

function resetHistoryState() {
    historyData = [];
    historyLastTimestamp = null;
    historyInitialized = false;
    historyGreenhouseID = null;
    historyDate = null;
}

// ==========================================
// EVENT HANDLERS
// ==========================================
function setupEvents() {
    const ghSelect = document.getElementById("greenhouseSelect");
    if (ghSelect) {
        ghSelect.addEventListener("change", async function () {
            selectedGreenhouseID = this.value ? Number(this.value) : null;
            applyDliTargetFromSelectedGreenhouse();
            resetHistoryState();
            await loadSensors();
        });
    }

    const sensorSelect = document.getElementById("sensorSelect");
    if (sensorSelect) {
        sensorSelect.addEventListener("change", async function () {
            const val = this.value;
            selectedSensorID = (!val || val.includes(",")) ? null : Number(val);
            resetHistoryState();
            await refreshAll();
        });
    }

    const modeSelect = document.getElementById("displayModeSelect");
    if (modeSelect) {
        modeSelect.addEventListener("change", function () {
            selectedDisplayMode = this.value;
            const processed = processHistoryData(historyData);
            drawLightChart(processed);
            drawDLIChart(processed);
            updateDashboardMetrics(processed);
        });
    }

    const dliInput = document.getElementById("dliTargetInput");
    if (dliInput) {
        dliInput.addEventListener("change", async function () {
            let val = parseFloat(this.value);
            if (isNaN(val) || val <= 0) {
                val = 15.0;
                this.value = val;
            }
            dliTarget = val;
            await updateDliTargetInDatabase(val);
            const processed = processHistoryData(historyData);
            drawDLIChart(processed);
            updateDashboardMetrics(processed);
        });
    }

    // อีเวนต์ช่องกรอกจำนวนหลอดและกำลังไฟ
    const countInput = document.getElementById("lampCountInput");
    if (countInput) {
        countInput.addEventListener("change", async function () {
            let val = parseInt(this.value, 10);
            if (isNaN(val) || val < 0) val = 0;
            lampCount = val;
            this.value = val;
            await updateLampConfigInDatabase();
            const processed = processHistoryData(historyData);
            updateDashboardMetrics(processed);
        });
    }

    const wattInput = document.getElementById("lampWattInput");
    if (wattInput) {
        wattInput.addEventListener("change", async function () {
            let val = parseFloat(this.value);
            if (isNaN(val) || val < 0) val = 0;
            lampWatt = val;
            this.value = val;
            await updateLampConfigInDatabase();
            const processed = processHistoryData(historyData);
            updateDashboardMetrics(processed);
        });
    }

    const dateSelect = document.getElementById("dateSelect");
    if (dateSelect) {
        dateSelect.addEventListener("change", async function () {
            selectedDate = this.value;
            resetHistoryState();
            await refreshAll();
        });
    }

    const refreshSelect = document.getElementById("refreshSelect");
    if (refreshSelect) {
        refreshSelect.addEventListener("change", function () {
            startAutoRefresh();
        });
    }
}

// ==========================================
// SUPABASE OPERATIONS
// ==========================================
async function loadGreenhouses() {
    const select = document.getElementById("greenhouseSelect");
    if (!select) return;
    select.innerHTML = '<option value="">Loading...</option>';

    try {
        const url = `${SUPABASE_URL}/rest/v1/greenhouse?select=id,greenhouse_code,greenhouse_name,dli_target,lamp_count,lamp_watt&order=id.asc`;
        const response = await fetch(url, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        greenhouseList = Array.isArray(data) ? data : [];

        select.innerHTML = "";
        if (greenhouseList.length === 0) {
            select.innerHTML = '<option value="">ไม่พบโรงเรือน</option>';
            return;
        }

        greenhouseList.forEach(gh => {
            const option = document.createElement("option");
            option.value = gh.id;
            option.textContent = gh.greenhouse_name ? `${gh.greenhouse_code} - ${gh.greenhouse_name}` : gh.greenhouse_code;
            select.appendChild(option);
        });

        selectedGreenhouseID = greenhouseList[0].id;
        select.value = selectedGreenhouseID;
        applyDliTargetFromSelectedGreenhouse();
        await loadSensors();
    } catch (error) {
        console.error("loadGreenhouses() ERROR:", error);
        select.innerHTML = '<option value="">Load error</option>';
        setStatus("โหลดข้อมูลโรงเรือนล้มเหลว", "error");
    }
}

function applyDliTargetFromSelectedGreenhouse() {
    const selectedGh = greenhouseList.find(g => Number(g.id) === Number(selectedGreenhouseID));
    const inputEl = document.getElementById("dliTargetInput");
    const countEl = document.getElementById("lampCountInput");
    const wattEl = document.getElementById("lampWattInput");

    dliTarget = (selectedGh && selectedGh.dli_target) ? parseFloat(selectedGh.dli_target) : 15.0;
    if (inputEl) inputEl.value = dliTarget;

    lampCount = (selectedGh && selectedGh.lamp_count) ? parseInt(selectedGh.lamp_count, 10) : 0;
    if (countEl) countEl.value = lampCount;

    lampWatt = (selectedGh && selectedGh.lamp_watt) ? parseFloat(selectedGh.lamp_watt) : 0;
    if (wattEl) wattEl.value = lampWatt;
}

async function updateLampConfigInDatabase() {
    if (!selectedGreenhouseID) return;
    try {
        const urlGH = `${SUPABASE_URL}/rest/v1/greenhouse?id=eq.${selectedGreenhouseID}`;
        await fetch(urlGH, {
            method: "PATCH",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ lamp_count: lampCount, lamp_watt: lampWatt })
        });

        const gh = greenhouseList.find(g => Number(g.id) === Number(selectedGreenhouseID));
        if (gh) {
            gh.lamp_count = lampCount;
            gh.lamp_watt = lampWatt;
        }
        setStatus("อัปเดตข้อมูลหลอดไฟสำเร็จ", "normal");
    } catch (error) {
        console.error("Error updating lamp config:", error);
    }
}

async function updateDliTargetInDatabase(newTarget) {
    if (!selectedGreenhouseID) return;
    const statusEl = document.getElementById("dliSaveStatus");
    if (statusEl) statusEl.textContent = "กำลังบันทึก...";

    try {
        const urlGH = `${SUPABASE_URL}/rest/v1/greenhouse?id=eq.${selectedGreenhouseID}`;
        await fetch(urlGH, {
            method: "PATCH",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ dli_target: newTarget })
        });

        const urlLC = `${SUPABASE_URL}/rest/v1/light_control?greenhouse_id=eq.${selectedGreenhouseID}`;
        await fetch(urlLC, {
            method: "PATCH",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ target_dli: newTarget })
        });

        const todayStr = getTodayThailand();
        const urlDLS = `${SUPABASE_URL}/rest/v1/daily_light_summary?greenhouse_id=eq.${selectedGreenhouseID}&summary_date=eq.${todayStr}`;
        await fetch(urlDLS, {
            method: "PATCH",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({ target_dli: newTarget, Target_DLI: newTarget })
        });

        const gh = greenhouseList.find(g => Number(g.id) === Number(selectedGreenhouseID));
        if (gh) gh.dli_target = newTarget;

        if (statusEl) {
            statusEl.textContent = "บันทึกเรียบร้อย";
            setTimeout(() => { statusEl.textContent = ""; }, 2500);
        }
        setStatus("อัปเดต DLI Target สำเร็จ", "normal");
    } catch (error) {
        console.error("Error updating DLI Target:", error);
        if (statusEl) statusEl.textContent = "บันทึกล้มเหลว";
    }
}

async function fetchSupplementalLightStatus() {
    if (!selectedGreenhouseID) return;
    try {
        const url = `${SUPABASE_URL}/rest/v1/light_control?greenhouse_id=eq.${selectedGreenhouseID}&select=*&order=updated_at.desc,id.desc&limit=1`;
        const response = await fetch(url, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
            cache: "no-store"
        });

        if (!response.ok) return;
        const data = await response.json();

        if (data && data.length > 0) {
            const status = data[0].relay_status ?? data[0].status;
            const intensity = data[0].intensity !== undefined ? data[0].intensity : 100;
            const badge = document.getElementById("relayStatusBadge");
            const intensityEl = document.getElementById("s2Intensity");
            const isOn = status === true || String(status).toUpperCase() === "ON" || status === 1;

            currentRelayStatus = isOn;
            currentIntensity = isOn ? intensity : 0;

            if (badge) {
                badge.textContent = isOn ? "ON" : "OFF";
                badge.className = `status-badge ${isOn ? 'badge-on' : 'badge-off'}`;
            }
            if (intensityEl) intensityEl.textContent = isOn ? `${intensity}%` : "0%";
        }
    } catch (error) {
        console.error("Error fetching light status:", error);
    }
}

async function loadLightTargetProfile() {
    try {
        const url = `${SUPABASE_URL}/rest/v1/light_target_profile?select=hour,target_lux,target_ppfd&order=hour.asc`;
        const response = await fetch(url, {
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`
            },
            cache: "no-store"
        });

        if (response.ok) {
            targetProfileData = await response.json();
        } else {
            targetProfileData = [];
        }
    } catch (error) {
        console.error("Error loading light_target_profile:", error);
        targetProfileData = [];
    }
}

async function loadSensors() {
    const select = document.getElementById("sensorSelect");
    if (!select) return;
    select.innerHTML = '<option value="">Loading...</option>';

    if (!selectedGreenhouseID) {
        select.innerHTML = '<option value="">ไม่มีโรงเรือน</option>';
        return;
    }

    try {
        const url = `${SUPABASE_URL}/rest/v1/sensor?select=id,sensor_code,greenhouse_id,sensor_type,description&greenhouse_id=eq.${selectedGreenhouseID}&order=id.asc`;
        const response = await fetch(url, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        sensorList = Array.isArray(data) ? data : [];

        sensorRoleMap = {};
        sensorList.forEach(sensor => {
            const id = Number(sensor.id);
            const text = [sensor.sensor_type, sensor.description, sensor.sensor_code].filter(Boolean).join(" ").toLowerCase();
            let role = SENSOR_ROLE_OVERRIDE[id] || null;
            if (!role) {
                if (/supplement|artificial|grow.?light|led|_02|_04|_06|_08|_10/.test(text)) role = "supplement";
                else if (/natural|ambient|sun|solar|_01|_03|_05|_07|_09/.test(text)) role = "natural";
            }
            sensorRoleMap[id] = role || "natural";
        });

        select.innerHTML = "";
        if (sensorList.length === 0) {
            select.innerHTML = '<option value="">ไม่พบเซนเซอร์</option>';
            selectedSensorID = null;
            return;
        }

        const allOption = document.createElement("option");
        allOption.value = sensorList.map(s => s.id).join(",");
        allOption.textContent = "All Sensors (Sensor 1 & Sensor 2)";
        select.appendChild(allOption);

        sensorList.forEach(sensor => {
            const displayName = formatSensorDisplayName(sensor.sensor_code, sensor.id);
            const option = document.createElement("option");
            option.value = sensor.id;
            option.textContent = sensor.description ? `${displayName} - ${sensor.description}` : displayName;
            select.appendChild(option);
        });

        selectedSensorID = null;
        select.value = allOption.value;
        resetHistoryState();
        await refreshAll();
    } catch (error) {
        console.error("loadSensors() ERROR:", error);
        setStatus("โหลดเซนเซอร์ล้มเหลว", "error");
    }
}

// ==========================================
// HISTORICAL SUMMARY & SENSOR DATA OPERATIONS
// ==========================================
async function fetchSensorHistory(incremental = false) {
    if (!selectedGreenhouseID || !selectedDate) return [];
    
    const tableName = `sensor_data_greenhouse${selectedGreenhouseID}`;
    const range = getUTCDateRange(selectedDate);

    let targetSensorIDs = selectedSensorID ? [selectedSensorID] : sensorList.map(s => Number(s.id)).filter(Number.isFinite);
    if (targetSensorIDs.length === 0) return [];

    const sensorFilter = `sensor_id=in.(${targetSensorIDs.join(",")})`;

    if (incremental && historyLastTimestamp && historyGreenhouseID === selectedGreenhouseID && historyDate === selectedDate) {
        const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&${sensorFilter}&timestamp=gt.${encodeURIComponent(historyLastTimestamp)}&timestamp=lt.${encodeURIComponent(range.end)}&order=timestamp.asc`;
        const response = await fetch(url, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
            cache: "no-store"
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    }

    let allData = [];
    let offset = 0;

    while (true) {
        const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&${sensorFilter}&timestamp=gte.${encodeURIComponent(range.start)}&timestamp=lt.${encodeURIComponent(range.end)}&order=timestamp.asc`;
        const response = await fetch(url, {
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Range": `${offset}-${offset + PAGE_SIZE - 1}`,
                "Prefer": "count=exact"
            },
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) break;

        allData = allData.concat(data);
        if (data.length < PAGE_SIZE || allData.length >= 100000) break;
        offset += PAGE_SIZE;
    }

    return allData;
}

async function saveDailySummaryToDB(greenhouseId, dateStr, summaryStats) {
    try {
        const payload = {
            greenhouse_id: greenhouseId,
            summary_date: dateStr,
            s1_lux_min: summaryStats.s1Lux.min, s1_lux_avg: summaryStats.s1Lux.avg, s1_lux_max: summaryStats.s1Lux.max,
            s1_ppfd_min: summaryStats.s1PPFD.min, s1_ppfd_avg: summaryStats.s1PPFD.avg, s1_ppfd_max: summaryStats.s1PPFD.max,
            s1_dli: summaryStats.s1DLI,
            s2_lux_min: summaryStats.s2Lux.min, s2_lux_avg: summaryStats.s2Lux.avg, s2_lux_max: summaryStats.s2Lux.max,
            s2_ppfd_min: summaryStats.s2PPFD.min, s2_ppfd_avg: summaryStats.s2PPFD.avg, s2_ppfd_max: summaryStats.s2PPFD.max,
            s2_dli: summaryStats.s2DLI,
            comb_lux_min: summaryStats.combLux.min, comb_lux_avg: summaryStats.combLux.avg, comb_lux_max: summaryStats.combLux.max,
            comb_ppfd_min: summaryStats.combPPFD.min, comb_ppfd_avg: summaryStats.combPPFD.avg, comb_ppfd_max: summaryStats.combPPFD.max,
            comb_dli: summaryStats.combDLI,
            //target_dli: dliTarget,
            Target_DLI: dliTarget,
            s2_on_hours: summaryStats.s2OnHours || 0,
            s2_avg_dimming: summaryStats.s2AvgDimming || 0,
            lamp_count: lampCount,
            lamp_watt: lampWatt,
            power_consumption: summaryStats.energyKWh,
            energy_kwh: summaryStats.energyKWh,
            updated_at: new Date().toISOString()
        };

        const url = `${SUPABASE_URL}/rest/v1/daily_light_summary?on_conflict=greenhouse_id,summary_date`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Save daily summary failed:", await response.text());
        } else {
            console.log("Saved daily summary to database successfully.");
        }
    } catch (e) {
        console.error("Error saving daily summary:", e);
    }
}

// ==========================================
// DATA PROCESSING
// ==========================================
function getLightRole(item) {
    const sId = Number(item.sensor_id);
    const codeStr = String(item.sensor_code || "").toUpperCase();
    if (sId === 2 || sId === 4 || sId === 6 || sId === 8 || sId === 10 || codeStr.endsWith("_02") || codeStr.endsWith("_04") || codeStr.endsWith("_06") || codeStr.endsWith("_08") || codeStr.endsWith("_10")) return "supplement";
    if (sId === 1 || sId === 3 || sId === 5 || sId === 7 || sId === 9 || codeStr.endsWith("_01") || codeStr.endsWith("_03") || codeStr.endsWith("_05") || codeStr.endsWith("_07") || codeStr.endsWith("_09")) return "natural";
    
    const explicit = String(item.light_type ?? "").trim().toLowerCase();
    if (explicit === "supplement") return "supplement";
    return sensorRoleMap[sId] || "natural";
}

function processHistoryData(rawData) {
    if (!rawData || rawData.length === 0) return [];

    const sorted = [...rawData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let processed = [];
    let accumulatedNaturalDLI = 0;
    let accumulatedSupplementDLI = 0;
    let lastDateStr = null;
    let latestNaturalLux = 0;
    let latestSupplementLux = 0;
    let lastTimestampByRole = { natural: null, supplement: null };

    for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        const dateObj = new Date(item.timestamp);
        const currentDateStr = new Intl.DateTimeFormat("en-CA", {
            timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
        }).format(dateObj);

        if (lastDateStr && currentDateStr !== lastDateStr) {
            accumulatedNaturalDLI = 0;
            accumulatedSupplementDLI = 0;
            latestNaturalLux = 0;
            latestSupplementLux = 0;
            lastTimestampByRole = { natural: null, supplement: null };
        }
        lastDateStr = currentDateStr;

        const role = getLightRole(item);
        const currentLux = Number(item.lux) || 0;
        const dbPPFD = Number(item.ppfd);
        const currentPPFD = (Number.isFinite(dbPPFD) && dbPPFD > 0) ? dbPPFD : calculatePPFD(currentLux);

        const dbDLI = Number(item.dli_today);

        let currentDeltaDLI = 0;
        const prevTime = lastTimestampByRole[role];
        if (prevTime) {
            const dtSec = (dateObj - new Date(prevTime)) / 1000;
            if (dtSec > 0 && dtSec < 3600) {
                currentDeltaDLI = (currentPPFD * dtSec) / 1000000;
            }
        }
        lastTimestampByRole[role] = item.timestamp;

        let deltaNat = 0, deltaSup = 0;
        if (role === "supplement") {
            latestSupplementLux = currentLux;
            deltaSup = currentDeltaDLI;
            accumulatedSupplementDLI = (Number.isFinite(dbDLI) && dbDLI > accumulatedSupplementDLI) ? dbDLI : (accumulatedSupplementDLI + currentDeltaDLI);
        } else {
            latestNaturalLux = currentLux;
            deltaNat = currentDeltaDLI;
            accumulatedNaturalDLI = (Number.isFinite(dbDLI) && dbDLI > accumulatedNaturalDLI) ? dbDLI : (accumulatedNaturalDLI + currentDeltaDLI);
        }

        const naturalPPFD = calculatePPFD(latestNaturalLux);
        const supplementPPFD = calculatePPFD(latestSupplementLux);

        processed.push({
            ...item,
            light_role: role,
            delta_dli_natural: deltaNat,
            delta_dli_supplement: deltaSup,
            lux_natural: latestNaturalLux,
            lux_supplement: latestSupplementLux,
            lux_total: latestNaturalLux + latestSupplementLux,
            ppfd_natural: naturalPPFD,
            ppfd_supplement: supplementPPFD,
            ppfd_total: naturalPPFD + supplementPPFD,
            dli_natural_calc: accumulatedNaturalDLI,
            dli_supplement_calc: accumulatedSupplementDLI,
            dli_today_calc: accumulatedNaturalDLI + accumulatedSupplementDLI
        });
    }

    return processed;
}

// ==========================================
// UI & METRICS UPDATE
// ==========================================
function updateDashboardMetrics(processedData) {
    if (!processedData || processedData.length === 0) return;

    const latest = processedData[processedData.length - 1];

    const setElText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setElText("s1Lux", latest.lux_natural.toFixed(2));
    setElText("s1PPFD", latest.ppfd_natural.toFixed(2));
    setElText("s1DLI", latest.dli_natural_calc.toFixed(4));
    setElText("s1DeltaDLI", latest.delta_dli_natural ? latest.delta_dli_natural.toFixed(8) : "0.00000000");

    setElText("s2Lux", latest.lux_supplement.toFixed(2));
    setElText("s2PPFD", latest.ppfd_supplement.toFixed(2));
    setElText("s2DLI", latest.dli_supplement_calc.toFixed(4));
    setElText("s2DeltaDLI", latest.delta_dli_supplement ? latest.delta_dli_supplement.toFixed(8) : "0.00000000");

    setElText("combLux", latest.lux_total.toFixed(2));
    setElText("combPPFD", latest.ppfd_total.toFixed(2));
    setElText("combDLI", latest.dli_today_calc.toFixed(4));
    setElText("lastUpdate", formatThaiTimestamp(latest.timestamp));

    const totalDLI = latest.dli_today_calc;
    const s1Share = totalDLI > 0 ? (latest.dli_natural_calc / totalDLI) * 100 : 0;
    const s2Share = totalDLI > 0 ? (latest.dli_supplement_calc / totalDLI) * 100 : 0;

    setElText("s1ShareText", `${s1Share.toFixed(1)}%`);
    const s1Bar = document.getElementById("s1ShareBar");
    if (s1Bar) s1Bar.style.width = `${Math.min(100, s1Share)}%`;

    setElText("s2ShareText", `${s2Share.toFixed(1)}%`);
    const s2Bar = document.getElementById("s2ShareBar");
    if (s2Bar) s2Bar.style.width = `${Math.min(100, s2Share)}%`;

    // Target Progress
    const combPct = Math.min(100, (latest.dli_today_calc / dliTarget) * 100);
    setElText("combProgressText", `${combPct.toFixed(1)}%`);
    const combBar = document.getElementById("combProgressBar");
    if (combBar) combBar.style.width = `${combPct}%`;
    setElText("combRemDLI", Math.max(0, dliTarget - latest.dli_today_calc).toFixed(2));

    setElText("sumNaturalDLI", `${latest.dli_natural_calc.toFixed(4)} mol/m²/d`);
    setElText("sumSupplementDLI", `${latest.dli_supplement_calc.toFixed(4)} mol/m²/d`);
    setElText("sumTotalDLI", `${latest.dli_today_calc.toFixed(4)} mol/m²/d`);

    // คำนวณชั่วโมงเปิดไฟ และพลังงานไฟฟ้า (kWh) จากการกรอกวัตต์
    const s2Records = processedData.filter(d => d.light_role === "supplement");
    const { onHours: s2OnHours, avgDimming: s2AvgDimming, energyKWh: calculatedKWh } = calculateSupplementalStats(s2Records);

    // คำนวณกำลังไฟที่ใช้อยู่ ณ ปัจจุบัน (Watt)
    const currentPower = currentRelayStatus ? (lampCount * lampWatt * (currentIntensity / 100.0)) : 0;

    setElText("s2OnHours", `${s2OnHours.toFixed(1)} ชม.`);
    setElText("s2AvgDimming", `${Math.round(s2AvgDimming)}%`);
    setElText("currentPowerWatt", `${Math.round(currentPower)} W`);
    setElText("s2EnergyKWh", `${calculatedKWh.toFixed(3)} kWh`);

    const powerBadge = document.getElementById("powerStatusBadge");
    if (powerBadge) {
        powerBadge.textContent = `${Math.round(currentPower)} W`;
        powerBadge.className = `status-badge ${currentPower > 0 ? 'badge-on' : 'badge-off'}`;
    }

    updateDailyStatistics(processedData);
}

async function syncAndLoadSummaryTable() {
    const tbody = document.getElementById("summaryArchiveTableBody");
    
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #2563eb;">🔄 กำลังตรวจสอบและประมวลผลข้อมูลสรุปย้อนหลัง...</td></tr>';
    }

    try {
        if (!selectedGreenhouseID) {
            await loadSummaryTableData();
            return;
        }

        const tableName = `sensor_data_greenhouse${selectedGreenhouseID}`;
        const existingUrl = `${SUPABASE_URL}/rest/v1/daily_light_summary?select=summary_date,comb_lux_avg,comb_dli&greenhouse_id=eq.${selectedGreenhouseID}`;
        const existingRes = await fetch(existingUrl, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
            cache: "no-store"
        });
        
        let completedDates = new Set();
        if (existingRes.ok) {
            const existingData = await existingRes.json();
            completedDates = new Set(
                (Array.isArray(existingData) ? existingData : [])
                    .filter(row => row.comb_lux_avg !== null && Number(row.comb_dli) > 0)
                    .map(row => row.summary_date)
            );
        }

        const missingDates = [];
        for (let i = 1; i <= 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = new Intl.DateTimeFormat("en-CA", {
                timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
            }).format(d);

            if (!completedDates.has(dateStr)) {
                missingDates.push(dateStr);
            }
        }

        if (missingDates.length > 0) {
            const targetSensorIDs = sensorList.map(s => Number(s.id)).filter(Number.isFinite);

            if (targetSensorIDs.length > 0) {
                const sensorFilter = `sensor_id=in.(${targetSensorIDs.join(",")})`;

                for (const targetDate of missingDates) {
                    const range = getUTCDateRange(targetDate);
                    let allRawData = [];
                    let offset = 0;

                    while (true) {
                        const dataUrl = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&${sensorFilter}&timestamp=gte.${encodeURIComponent(range.start)}&timestamp=lt.${encodeURIComponent(range.end)}&order=timestamp.asc`;
                        
                        const res = await fetch(dataUrl, {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": `Bearer ${SUPABASE_KEY}`,
                                "Range": `${offset}-${offset + PAGE_SIZE - 1}`,
                                "Prefer": "count=exact"
                            },
                            cache: "no-store"
                        });

                        if (!res.ok) break;
                        const pageData = await res.json();
                        if (!Array.isArray(pageData) || pageData.length === 0) break;

                        allRawData = allRawData.concat(pageData);
                        if (pageData.length < PAGE_SIZE) break;
                        offset += PAGE_SIZE;
                    }

                    if (allRawData.length > 0) {
                        const processed = processHistoryData(allRawData);
                        const latest = processed[processed.length - 1];

                        const getStatsObj = (values) => {
                            const valid = values.filter(v => Number.isFinite(v));
                            if (valid.length === 0) return { min: 0, avg: 0, max: 0 };
                            return {
                                min: Number(Math.min(...valid).toFixed(1)),
                                avg: Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)),
                                max: Number(Math.max(...valid).toFixed(1))
                            };
                        };

                        const s2Recs = processed.filter(d => d.light_role === "supplement");
                        const { onHours: s2OnHours, avgDimming: s2AvgDim, energyKWh: calculatedKWh } = calculateSupplementalStats(s2Recs);

                        const summaryPayload = {
                            s1Lux: getStatsObj(processed.map(d => d.lux_natural)),
                            s1PPFD: getStatsObj(processed.map(d => d.ppfd_natural)),
                            s1DLI: Number(latest.dli_natural_calc.toFixed(4)),
                            s2Lux: getStatsObj(processed.map(d => d.lux_supplement)),
                            s2PPFD: getStatsObj(processed.map(d => d.ppfd_supplement)),
                            s2DLI: Number(latest.dli_supplement_calc.toFixed(4)),
                            combLux: getStatsObj(processed.map(d => d.lux_total)),
                            combPPFD: getStatsObj(processed.map(d => d.ppfd_total)),
                            combDLI: Number(latest.dli_today_calc.toFixed(4)),
                            s2OnHours: Number(s2OnHours.toFixed(1)),
                            s2AvgDimming: Number(s2AvgDim.toFixed(1)),
                            energyKWh: Number(calculatedKWh.toFixed(3))
                        };

                        await saveDailySummaryToDB(selectedGreenhouseID, targetDate, summaryPayload);
                    }
                }
            }
        }

        await loadSummaryTableData();

    } catch (error) {
        console.error("syncAndLoadSummaryTable() ERROR:", error);
        await loadSummaryTableData();
    }
}

async function loadHistoryAndUpdate(forceFullReload = false) {
    if (!selectedGreenhouseID || !selectedDate || historyLoading) return;
    historyLoading = true;

    try {
        const isToday = (selectedDate === getTodayThailand());
        const badgeEl = document.getElementById("chartModeBadge");
        if (badgeEl) badgeEl.textContent = isToday ? "[โหมด Real-time วันนี้]" : `[โหมดดูย้อนหลัง: ${selectedDate}]`;

        const needFullLoad = forceFullReload || !historyInitialized || historyGreenhouseID !== selectedGreenhouseID || historyDate !== selectedDate;

        if (needFullLoad) {
            historyData = await fetchSensorHistory(false);
            historyInitialized = true;
            historyGreenhouseID = selectedGreenhouseID;
            historyDate = selectedDate;
            historyLastTimestamp = historyData.length > 0 ? historyData[historyData.length - 1].timestamp : null;
        } else {
            const newData = await fetchSensorHistory(true);
            if (newData.length > 0) {
                historyData = historyData.concat(newData);
                historyLastTimestamp = newData[newData.length - 1].timestamp;
            }
        }

        const countEl = document.getElementById("recordCount");
        if (countEl) countEl.textContent = historyData.length.toLocaleString();

        const processedData = processHistoryData(historyData);
        updateDashboardMetrics(processedData);
        drawLightChart(processedData);
        drawDLIChart(processedData);

        if (!isToday && processedData.length > 0) {
            const latest = processedData[processedData.length - 1];
            const getStatsObj = (values) => {
                const valid = values.filter(v => Number.isFinite(v));
                if (valid.length === 0) return { min: 0, avg: 0, max: 0 };
                return {
                    min: Number(Math.min(...valid).toFixed(1)),
                    avg: Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)),
                    max: Number(Math.max(...valid).toFixed(1))
                };
            };

            const s2Recs = processedData.filter(d => d.light_role === "supplement");
            const { onHours: s2OnHours, avgDimming: s2AvgDim, energyKWh: calculatedKWh } = calculateSupplementalStats(s2Recs);

            const summaryPayload = {
                s1Lux: getStatsObj(processedData.map(d => d.lux_natural)),
                s1PPFD: getStatsObj(processedData.map(d => d.ppfd_natural)),
                s1DLI: Number(latest.dli_natural_calc.toFixed(4)),
                s2Lux: getStatsObj(processedData.map(d => d.lux_supplement)),
                s2PPFD: getStatsObj(processedData.map(d => d.ppfd_supplement)),
                s2DLI: Number(latest.dli_supplement_calc.toFixed(4)),
                combLux: getStatsObj(processedData.map(d => d.lux_total)),
                combPPFD: getStatsObj(processedData.map(d => d.ppfd_total)),
                combDLI: Number(latest.dli_today_calc.toFixed(4)),
                s2OnHours: Number(s2OnHours.toFixed(1)),
                s2AvgDimming: Number(s2AvgDim.toFixed(1)),
                energyKWh: Number(calculatedKWh.toFixed(3))
            };

            await saveDailySummaryToDB(selectedGreenhouseID, selectedDate, summaryPayload);
        }
    } catch (error) {
        console.error("loadHistoryAndUpdate() ERROR:", error);
        setStatus("โหลดข้อมูลย้อนหลังล้มเหลว", "error");
    } finally {
        historyLoading = false;
    }
}

// ==========================================
// CANVAS RENDER ENGINE
// ==========================================
function prepareCanvas(canvas) {
    if (!canvas) return null;
    const w = canvas.parentElement ? canvas.parentElement.clientWidth - 30 : 600;
    const h = 280;
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "bold 13px Segoe UI, Arial";
    return { ctx, width: w, height: h };
}

function drawLegend(ctx, items) {
    let x = 60, y = 15;
    items.forEach(item => {
        ctx.fillStyle = item.color;
        if (item.dashed) {
            ctx.save();
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(x, y - 4);
            ctx.lineTo(x + 15, y - 4);
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.fillRect(x, y - 8, 14, 4);
        }
        ctx.fillStyle = "#2d3748";
        ctx.font = "bold 13px Segoe UI, Arial";
        ctx.textAlign = "left";
        ctx.fillText(item.name, x + 18, y);
        x += 18 + ctx.measureText(item.name).width + 20;
    });
}

function getTimeScaleRange(dateStr) {
    const activeDate = dateStr || getTodayThailand();
    const startMs = new Date(`${activeDate}T05:00:00+07:00`).getTime();
    const endMs = new Date(`${activeDate}T23:00:00+07:00`).getTime();
    return { startMs, endMs, totalMs: endMs - startMs };
}

function drawTargetProfileLine(ctx, profileList, left, chartW, top, chartH, maxVal) {
    if (!profileList || profileList.length === 0) return;

    const profileMap = {};
    profileList.forEach(item => {
        profileMap[Number(item.hour)] = Number(item.target_ppfd) || 0;
    });

    const { startMs, totalMs } = getTimeScaleRange(selectedDate);
    const activeDate = selectedDate || getTodayThailand();

    ctx.save();
    ctx.strokeStyle = "#ff5722";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();

    let isStarted = false;
    let lastY = 0;

    for (let h = 5; h <= 23; h++) {
        const hStr = h < 10 ? `0${h}` : `${h}`;
        const tMs = new Date(`${activeDate}T${hStr}:00:00+07:00`).getTime();
        const x = left + Math.max(0, Math.min(1, (tMs - startMs) / totalMs)) * chartW;
        const targetPPFD = profileMap[h] || 0;
        const y = top + chartH * (1 - Math.min(Math.max(targetPPFD / maxVal, 0), 1));

        if (!isStarted) {
            ctx.moveTo(x, y);
            isStarted = true;
        } else {
            ctx.lineTo(x, lastY);
            ctx.lineTo(x, y);
        }
        lastY = y;
    }

    ctx.stroke();
    ctx.restore();
}

function drawLightChart(data) {
    const canvas = document.getElementById("lightChart");
    const engine = prepareCanvas(canvas);
    if (!engine) return;
    const { ctx, width, height } = engine;

    const left = 60, right = 20, top = 35, bottom = 40;
    const chartW = width - left - right;
    const chartH = height - top - bottom;

    let seriesList = [];
    if (selectedDisplayMode === "combined") {
        seriesList.push({ name: "Combined PPFD", color: "#1976d2", key: "ppfd_total" });
    } else if (selectedDisplayMode === "natural") {
        seriesList.push({ name: "Sensor 1 (Natural)", color: "#f39c12", key: "ppfd_natural" });
    } else if (selectedDisplayMode === "supplement") {
        seriesList.push({ name: "Sensor 2 (Supplement)", color: "#9b59b6", key: "ppfd_supplement" });
    } else if (selectedDisplayMode === "separated") {
        seriesList.push({ name: "Sensor 1 (Natural)", color: "#f39c12", key: "ppfd_natural" });
        seriesList.push({ name: "Sensor 2 (Supplement)", color: "#9b59b6", key: "ppfd_supplement" });
        seriesList.push({ name: "Combined PPFD", color: "#1976d2", key: "ppfd_total" });
    }

    let maxVal = 10;
    if (data && data.length > 0) {
        data.forEach(d => {
            seriesList.forEach(s => {
                const v = Number(d[s.key]) || 0;
                if (v > maxVal) maxVal = v;
            });
        });
    }

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = top + (chartH * i / 4);
        const val = maxVal * (1 - i / 4);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();

        ctx.fillStyle = "#4a5568";
        ctx.font = "12px Segoe UI, Arial";
        ctx.textAlign = "right";
        ctx.fillText(val.toFixed(1), left - 8, y + 4);
    }

    const timeTicks = ["05:00", "08:00", "11:00", "14:00", "17:00", "20:00", "23:00"];
    const { startMs, endMs, totalMs } = getTimeScaleRange(selectedDate);
    const activeDate = selectedDate || getTodayThailand();

    ctx.fillStyle = "#4a5568";
    ctx.font = "12px Segoe UI, Arial";
    ctx.textAlign = "center";

    timeTicks.forEach(tick => {
        const tickMs = new Date(`${activeDate}T${tick}:00+07:00`).getTime();
        const x = left + ((tickMs - startMs) / totalMs) * chartW;
        ctx.fillText(tick, x, height - 10);

        ctx.save();
        ctx.strokeStyle = "#f1f5f9";
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, top + chartH);
        ctx.stroke();
        ctx.restore();
    });

    if (targetProfileData && targetProfileData.length > 0) {
        drawTargetProfileLine(ctx, targetProfileData, left, chartW, top, chartH, maxVal);
    }

    if (data && data.length > 0) {
        seriesList.forEach(s => {
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            let isStarted = false;

            data.forEach(d => {
                const tMs = new Date(d.timestamp).getTime();
                if (tMs >= startMs && tMs <= endMs + 60000) {
                    const x = left + Math.max(0, Math.min(1, (tMs - startMs) / totalMs)) * chartW;
                    const val = Number(d[s.key]) || 0;
                    const y = top + chartH * (1 - Math.min(val / maxVal, 1));

                    if (!isStarted) {
                        ctx.moveTo(x, y);
                        isStarted = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });
            ctx.stroke();
        });
    }

    const legendItems = [...seriesList];
    if (targetProfileData && targetProfileData.length > 0) {
        legendItems.push({ name: "Target Profile (PPFD)", color: "#ff5722", dashed: true });
    }
    drawLegend(ctx, legendItems);
}

function drawDLIChart(data) {
    const canvas = document.getElementById("dliChart");
    const engine = prepareCanvas(canvas);
    if (!engine) return;
    const { ctx, width, height } = engine;

    const left = 60, right = 20, top = 35, bottom = 40;
    const chartW = width - left - right;
    const chartH = height - top - bottom;

    let seriesList = [];
    if (selectedDisplayMode === "combined") {
        seriesList.push({ name: "Combined DLI", color: "#2e7d32", key: "dli_today_calc" });
    } else if (selectedDisplayMode === "natural") {
        seriesList.push({ name: "Sensor 1 DLI", color: "#e67e22", key: "dli_natural_calc" });
    } else if (selectedDisplayMode === "supplement") {
        seriesList.push({ name: "Sensor 2 DLI", color: "#8e44ad", key: "dli_supplement_calc" });
    } else if (selectedDisplayMode === "separated") {
        seriesList.push({ name: "Sensor 1 DLI", color: "#e67e22", key: "dli_natural_calc" });
        seriesList.push({ name: "Sensor 2 DLI", color: "#8e44ad", key: "dli_supplement_calc" });
        seriesList.push({ name: "Combined DLI", color: "#2e7d32", key: "dli_today_calc" });
    }

    let maxVal = dliTarget || 15;
    if (data && data.length > 0) {
        data.forEach(d => {
            seriesList.forEach(s => {
                const v = Number(d[s.key]) || 0;
                if (v > maxVal) maxVal = v;
            });
        });
    }

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = top + (chartH * i / 4);
        const val = maxVal * (1 - i / 4);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();

        ctx.fillStyle = "#4a5568";
        ctx.font = "12px Segoe UI, Arial";
        ctx.textAlign = "right";
        ctx.fillText(val.toFixed(1), left - 8, y + 4);
    }

    const timeTicks = ["05:00", "08:00", "11:00", "14:00", "17:00", "20:00", "23:00"];
    const { startMs, endMs, totalMs } = getTimeScaleRange(selectedDate);
    const activeDate = selectedDate || getTodayThailand();

    ctx.fillStyle = "#4a5568";
    ctx.font = "12px Segoe UI, Arial";
    ctx.textAlign = "center";

    timeTicks.forEach(tick => {
        const tickMs = new Date(`${activeDate}T${tick}:00+07:00`).getTime();
        const x = left + ((tickMs - startMs) / totalMs) * chartW;
        ctx.fillText(tick, x, height - 10);
    });

    const targetY = top + chartH * (1 - Math.min(dliTarget / maxVal, 1));
    ctx.save();
    ctx.strokeStyle = "#e11d48";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(left, targetY);
    ctx.lineTo(width - right, targetY);
    ctx.stroke();
    ctx.restore();

    if (data && data.length > 0) {
        seriesList.forEach(s => {
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            let isStarted = false;

            data.forEach(d => {
                const tMs = new Date(d.timestamp).getTime();
                if (tMs >= startMs && tMs <= endMs + 60000) {
                    const x = left + Math.max(0, Math.min(1, (tMs - startMs) / totalMs)) * chartW;
                    const val = Number(d[s.key]) || 0;
                    const y = top + chartH * (1 - Math.min(val / maxVal, 1));

                    if (!isStarted) {
                        ctx.moveTo(x, y);
                        isStarted = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });
            ctx.stroke();
        });
    }

    const legendItems = [...seriesList, { name: `Target (${dliTarget} DLI)`, color: "#e11d48", dashed: true }];
    drawLegend(ctx, legendItems);
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function calculateSupplementalStats(s2Records) {
    if (!s2Records || s2Records.length === 0) {
        return { onHours: 0, avgDimming: 0, energyKWh: 0 };
    }

    const sorted = [...s2Records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let totalOnSeconds = 0;
    let weightedDimmingSum = 0;
    let totalWattSeconds = 0;
    const DEFAULT_INTERVAL_SEC = 300;

    for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        const luxVal = Number(curr.lux ?? curr.lux_supplement ?? 0);
        
        const isOn = curr.light_status === true || 
                     String(curr.light_status).toLowerCase() === "true" || 
                     curr.light_status === 1 || 
                     luxVal > 10;

        const dimLevel = (curr.dimming_level !== undefined && curr.dimming_level !== null) 
            ? Number(curr.dimming_level) 
            : (isOn ? 100 : 0);

        if (isOn || dimLevel > 0) {
            let dtSec = DEFAULT_INTERVAL_SEC;
            
            if (i > 0) {
                const prevTime = new Date(sorted[i - 1].timestamp).getTime();
                const currTime = new Date(curr.timestamp).getTime();
                const diffSec = (currTime - prevTime) / 1000;
                
                if (diffSec > 0 && diffSec <= 900) {
                    dtSec = diffSec;
                }
            }
            
            totalOnSeconds += dtSec;
            weightedDimmingSum += dimLevel * dtSec;

            // คำนวณพลังงานไฟฟ้าสะสม (Watt * Seconds)
            const activePowerWatts = (lampCount * lampWatt) * (dimLevel / 100.0);
            totalWattSeconds += activePowerWatts * dtSec;
        }
    }

    const onHours = totalOnSeconds / 3600.0;
    const avgDimming = totalOnSeconds > 0 ? (weightedDimmingSum / totalOnSeconds) : 0;
    const energyKWh = totalWattSeconds / (3600.0 * 1000.0);

    return {
        onHours: Number(onHours.toFixed(1)),
        avgDimming: Number(avgDimming.toFixed(1)),
        energyKWh: Number(energyKWh.toFixed(3))
    };
}

function formatSensorDisplayName(sensorCode, sensorId) {
    if (!sensorCode) return `Sensor ${sensorId || ''}`;
    const codeUpper = String(sensorCode).toUpperCase();
    if (codeUpper.includes("BH1750_01") || codeUpper.endsWith("_01")) return "Sensor 1";
    if (codeUpper.includes("BH1750_02") || codeUpper.endsWith("_02")) return "Sensor 2";
    return sensorCode.replace(/BH1750_/i, "Sensor ");
}

function getTodayThailand() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
}

function getUTCDateRange(thaiDate) {
    const start = new Date(`${thaiDate}T00:00:00+07:00`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
}

function calculatePPFD(lux) {
    return (Number.isFinite(lux) && lux > 0) ? lux * LUX_TO_PPFD_FACTOR : 0;
}

function formatThaiTimestamp(timestamp) {
    if (!timestamp) return "-";
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: TIME_ZONE,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(new Date(timestamp));
}

async function refreshAll() {
    setStatus("กำลังอัปเดต...", "normal");
    await loadLightTargetProfile();
    await fetchSupplementalLightStatus();
    await loadHistoryAndUpdate();
    setStatus("เชื่อมต่อสำเร็จ", "normal");
}

async function manualRefresh() {
    const button = document.getElementById("refreshButton");
    if (button) {
        button.disabled = true;
        button.textContent = "Updating...";
    }
    try {
        await refreshAll();
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Refresh";
        }
    }
}

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    const refreshEl = document.getElementById("refreshSelect");
    const interval = refreshEl ? Number(refreshEl.value) : 30000;

    autoRefreshTimer = setInterval(async function () {
        if (selectedDate === getTodayThailand()) {
            await fetchSupplementalLightStatus();
            await loadHistoryAndUpdate();
        }
        setStatus("เชื่อมต่อปกติ • Auto Refresh", "normal");
    }, interval);
}

function setStatus(message, type = "normal") {
    const box = document.getElementById("statusBox");
    const title = document.getElementById("statusTitle");
    const time = document.getElementById("statusTime");

    if (title) title.textContent = message;
    if (time) time.textContent = `อัปเดตล่าสุด: ${formatThaiTimestamp(new Date().toISOString())}`;
    if (box) {
        box.className = "status-box";
        if (type === "error") box.classList.add("error");
    }
}

function updateDailyStatistics(processedData) {
    if (!processedData || processedData.length === 0) return;

    const calcStats = (values) => {
        const valid = values.filter(v => Number.isFinite(v));
        if (valid.length === 0) return { min: "-", avg: "-", max: "-" };
        const min = Math.min(...valid);
        const max = Math.max(...valid);
        const sum = valid.reduce((a, b) => a + b, 0);
        const avg = sum / valid.length;
        return { min: min.toFixed(1), avg: avg.toFixed(1), max: max.toFixed(1) };
    };

    const s1Lux = processedData.map(d => d.lux_natural);
    const s1PPFD = processedData.map(d => d.ppfd_natural);
    const s2Lux = processedData.map(d => d.lux_supplement);
    const s2PPFD = processedData.map(d => d.ppfd_supplement);
    const combLux = processedData.map(d => d.lux_total);
    const combPPFD = processedData.map(d => d.ppfd_total);

    const s1LuxStats = calcStats(s1Lux);
    const s1PPFDStats = calcStats(s1PPFD);
    const s2LuxStats = calcStats(s2Lux);
    const s2PPFDStats = calcStats(s2PPFD);
    const combLuxStats = calcStats(combLux);
    const combPPFDStats = calcStats(combPPFD);

    document.getElementById("s1LuxMin").textContent = s1LuxStats.min;
    document.getElementById("s1LuxAvg").textContent = s1LuxStats.avg;
    document.getElementById("s1LuxMax").textContent = s1LuxStats.max;
    document.getElementById("s1PPFDMin").textContent = s1PPFDStats.min;
    document.getElementById("s1PPFDAvg").textContent = s1PPFDStats.avg;
    document.getElementById("s1PPFDMax").textContent = s1PPFDStats.max;

    document.getElementById("s2LuxMin").textContent = s2LuxStats.min;
    document.getElementById("s2LuxAvg").textContent = s2LuxStats.avg;
    document.getElementById("s2LuxMax").textContent = s2LuxStats.max;
    document.getElementById("s2PPFDMin").textContent = s2PPFDStats.min;
    document.getElementById("s2PPFDAvg").textContent = s2PPFDStats.avg;
    document.getElementById("s2PPFDMax").textContent = s2PPFDStats.max;

    document.getElementById("combLuxMin").textContent = combLuxStats.min;
    document.getElementById("combLuxAvg").textContent = combLuxStats.avg;
    document.getElementById("combLuxMax").textContent = combLuxStats.max;
    document.getElementById("combPPFDMin").textContent = combPPFDStats.min;
    document.getElementById("combPPFDAvg").textContent = combPPFDStats.avg;
    document.getElementById("combPPFDMax").textContent = combPPFDStats.max;
}

window.addEventListener("resize", function () {
    const processed = processHistoryData(historyData);
    drawLightChart(processed);
    drawDLIChart(processed);
});
