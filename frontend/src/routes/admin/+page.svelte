<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';
    
    // --- 📦 Visualization Tools ---
    import { Bar, Pie, Doughnut } from 'svelte-chartjs';
    import { Chart, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement, PointElement, LineElement } from 'chart.js';
    import { toPng } from 'html-to-image';
    import { jsPDF } from 'jspdf';

    Chart.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement, PointElement, LineElement);

    // --- 📊 Core App State ---
    let users = $state<any[]>([]);
    let logs = $state<any[]>([]);
    let rankings = $state<any[]>([]);
    let totalTracksCount = $state(0); 
    let isLoading = $state(true);
    let isExporting = $state(false);

    // --- 📈 Report Engine State ---
    let selectedMonth = $state('');
    let selectedYear = $state(new Date().getFullYear().toString());
    
    // 6 รายงานหลัก
    let topStreamedArtists = $state<any[]>([]);
    let genrePop = $state<any[]>([]);
    let merchRevenue = $state<any[]>([]);
    let followerEng = $state<any[]>([]);
    let activeUsersReport = $state<any[]>([]);
    let highValuePurchases = $state<any>({ systemAverage: 0, orders: [] });

    // --- 🔄 Fetch Engine ---
    async function fetchAllData() {
        const params = new URLSearchParams();
        if (selectedYear) params.append('year', selectedYear);
        if (selectedMonth) params.append('month', selectedMonth);
        const query = params.toString() ? `?${params.toString()}` : '';

        try {
            // ดึงข้อมูล Report ทั้ง 6 เส้น + ข้อมูลดิบพื้นฐาน
            const results = await Promise.allSettled([
                fetch(`http://127.0.0.1:8787/api/users`), // ข้อมูล User ทั้งหมด (ไม่กรองเวลา)
                fetch(`http://127.0.0.1:8787/api/admin/artists/ranking`), // อันดับยอดติดตาม (ไม่กรองเวลา)
                fetch(`http://127.0.0.1:8787/api/admin/reports/top-artists${query}`),
                fetch(`http://127.0.0.1:8787/api/admin/reports/genre-popularity${query}`),
                fetch(`http://127.0.0.1:8787/api/admin/reports/merch-revenue${query}`),
                fetch(`http://127.0.0.1:8787/api/admin/reports/follower-engagement${query}`),
                fetch(`http://127.0.0.1:8787/api/admin/reports/active-users${query}`),
                fetch(`http://127.0.0.1:8787/api/admin/reports/high-value-purchases${query}`),
                fetch(`http://127.0.0.1:8787/api/logs`)
            ]);

            // Mapping ข้อมูลเข้า State
            if (results[0].status === 'fulfilled') {
                const d = await results[0].value.json();
                if (d.success) users = d.data;
            }
            if (results[1].status === 'fulfilled') {
                const d = await results[1].value.json();
                if (d.success) rankings = d.data;
            }
            if (results[2].status === 'fulfilled') {
                const d = await results[2].value.json();
                if (d.success) topStreamedArtists = d.data;
            }
            if (results[3].status === 'fulfilled') {
                const d = await results[3].value.json();
                if (d.success) genrePop = d.data;
            }
            if (results[4].status === 'fulfilled') {
                const d = await results[4].value.json();
                if (d.success) merchRevenue = d.data;
            }
            if (results[5].status === 'fulfilled') {
                const d = await results[5].value.json();
                if (d.success) followerEng = d.data;
            }
            if (results[6].status === 'fulfilled') {
                const d = await results[6].value.json();
                if (d.success) activeUsersReport = d.data;
            }
            if (results[7].status === 'fulfilled') {
                const d = await results[7].value.json();
                if (d.success) highValuePurchases = d.data;
            }
            if (results[8].status === 'fulfilled') {
                const d = await results[8].value.json();
                if (d.success) logs = d.data;
            }

        } catch (e) { console.error("Report System Error:", e); }
        finally { isLoading = false; }
    }

    $effect(() => { fetchAllData(); });

    // --- 🎨 Chart Data Derivations ---
    let topArtistsChart = $derived({
        labels: topStreamedArtists.map(a => a.name),
        datasets: [{ label: 'Streams', data: topStreamedArtists.map(a => a.totalStreams), backgroundColor: '#a855f7', borderRadius: 4 }]
    });

    let genreChart = $derived({
        labels: genrePop.map(g => g.name),
        datasets: [{ data: genrePop.map(g => g.totalStreams), backgroundColor: ['#a855f7', '#6366f1', '#ec4899', '#f59e0b', '#10b981'], borderWidth: 0 }]
    });

    let merchRevenueChart = $derived({
        labels: merchRevenue.map(m => m.name),
        datasets: [{ label: 'Revenue (฿)', data: merchRevenue.map(m => m.totalRevenue), backgroundColor: '#10b981', borderRadius: 4 }]
    });

    let engagementChart = $derived({
        labels: ['Followers', 'Others'],
        datasets: [{
            data: [
                followerEng.reduce((acc, curr) => acc + curr.followerStreams, 0),
                followerEng.reduce((acc, curr) => acc + (curr.totalStreams - curr.followerStreams), 0)
            ],
            backgroundColor: ['#a855f7', '#333'],
            borderWidth: 0
        }]
    });

    // --- PDF Export Logic ---
    async function exportToPDF() {
        isExporting = true;
        try {
            const pdf    = new jsPDF('p', 'mm', 'a4');
            const PAGE_W = pdf.internal.pageSize.getWidth();   // 210mm
            const PAGE_H = pdf.internal.pageSize.getHeight();  // 297mm
            const M      = 8;  // margin (mm)
            const GAP    = 5;  // gap ระหว่าง block (mm)
            const COL_W  = (PAGE_W - M * 2 - GAP) / 2; // ความกว้าง column สำหรับ 2-col layout

            let y        = M;
            let pageNum  = 0;

            // --- Helpers ---
            const newPage = () => {
                if (pageNum > 0) pdf.addPage();
                pageNum++;
                y = M;
            };

            // Capture element เป็น PNG + คืน dataUrl กับ height (มม.)
            const snap = async (el: HTMLElement, w: number): Promise<{ url: string; h: number }> => {
                el.classList.add('print-mode');
                await new Promise(r => setTimeout(r, 80)); // รอ CSS apply
                const url = await toPng(el, { quality: 1, pixelRatio: 2, backgroundColor: '#ffffff' });
                el.classList.remove('print-mode');
                const h = (el.scrollHeight * w) / el.scrollWidth;
                return { url, h };
            };

            // วาง image ลง PDF ตำแหน่งที่กำหนด
            const place = (url: string, x: number, w: number, h: number) => {
                pdf.addImage(url, 'PNG', x, y, w, h);
            };

            newPage(); // หน้าแรก

            // ─── Block 1: KPI Grid (full width) ───────────────────────────────────
            const kpiGrid = document.querySelector('.kpi-grid') as HTMLElement | null;
            if (kpiGrid) {
                const { url, h } = await snap(kpiGrid, PAGE_W - M * 2);
                if (y + h > PAGE_H - M) newPage();
                place(url, M, PAGE_W - M * 2, h);
                y += h + GAP;
            }

            // ─── Block 2: Charts (2 columns ต่อแถว) ──────────────────────────────
            const charts = Array.from(document.querySelectorAll('.chart-box')) as HTMLElement[];
            for (let i = 0; i < charts.length; i += 2) {
                const pair = charts.slice(i, i + 2);

                // Snap ทั้งคู่ก่อน (ยังไม่วาด)
                const snaps = await Promise.all(pair.map(el => snap(el, COL_W)));
                const rowH  = Math.max(...snaps.map(s => s.h));

                // ถ้าแถวนี้ไม่จุในหน้าที่เหลือ → ขึ้นหน้าใหม่
                if (y + rowH > PAGE_H - M) newPage();

                snaps.forEach(({ url, h }, j) => {
                    place(url, M + j * (COL_W + GAP), COL_W, h);
                });
                y += rowH + GAP;
            }

            // ─── Block 3: Tables (2 columns ต่อแถว) ──────────────────────────────
            const tables = Array.from(document.querySelectorAll('.activity-box')) as HTMLElement[];
            for (let i = 0; i < tables.length; i += 2) {
                const pair  = tables.slice(i, i + 2);
                const snaps = await Promise.all(pair.map(el => snap(el, COL_W)));
                const rowH  = Math.max(...snaps.map(s => s.h));

                if (y + rowH > PAGE_H - M) newPage();

                snaps.forEach(({ url, h }, j) => {
                    place(url, M + j * (COL_W + GAP), COL_W, h);
                });
                y += rowH + GAP;
            }

            pdf.save(`Kawii_Dashboard_${selectedYear}_${selectedMonth || 'All'}.pdf`);

        } catch (e: any) {
            console.error('PDF Export Error:', e);
            alert(`Export ไม่สำเร็จ: ${e.message || String(e)}`);
        } finally {
            isExporting = false;
        }
    }

    const formatCurrency = (val: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
</script>

<div class="command-center">
    <header class="dashboard-header">
        <div class="header-content">
            <h1 class="title">Admin Dashboard</h1>
            <p class="subtitle">System Analytics & Operational Dashboard</p>
        </div>
        
        <div class="flex flex-col items-end gap-3">
            <div class="admin-badge">
                <span class="pulse-icon"></span>
                System Live: {adminAuthState.currentAdmin?.username}
            </div>
            <div class="flex gap-2 items-center">
                <select bind:value={selectedMonth} class="filter-select" disabled={!selectedYear}>
                    <option value="">All Months</option>
                    {#each Array(12) as _, i}
                        <option value={i + 1}>{new Date(0, i).toLocaleString('en', { month: 'short' })}</option>
                    {/each}
                </select>
                <select 
                    bind:value={selectedYear} 
                    class="filter-select"
                    onchange={() => { if (!selectedYear) selectedMonth = ''; }}
                >
                    <option value="">All Time</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                </select>
                <button onclick={exportToPDF} disabled={isExporting} class="pdf-btn">
                    {isExporting ? '⏳ Processing...' : '📄 Export PDF'}
                </button>
            </div>
        </div>
    </header>

    <section class="quick-actions mb-12">
        <h2 class="section-title text-2xl font-black mb-6 tracking-tight flex items-center gap-3">
            <span class="w-2 h-8 bg-primary rounded-full"></span>
            Operational Modules
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <a href="/admin/tracks" class="module-card group">
                <div class="module-icon tracks">🎵</div>
                <div class="module-details">
                    <strong class="module-name">Music Library</strong>
                    <span class="module-desc">Upload & Sync Assets</span>
                </div>
                <div class="module-arrow">→</div>
            </a>
            <a href="/admin/artists" class="module-card group">
                <div class="module-icon artists">🎤</div>
                <div class="module-details">
                    <strong class="module-name">Artists</strong>
                    <span class="module-desc">Profiles & Creators</span>
                </div>
                <div class="module-arrow">→</div>
            </a>
            <a href="/admin/albums" class="module-card group">
                <div class="module-icon albums">💿</div>
                <div class="module-details">
                    <strong class="module-name">Albums</strong>
                    <span class="module-desc">Collections & Covers</span>
                </div>
                <div class="module-arrow">→</div>
            </a>
            <a href="/admin/users" class="module-card group">
                <div class="module-icon users">👤</div>
                <div class="module-details">
                    <strong class="module-name">User Control</strong>
                    <span class="module-desc">Permissions & Safety</span>
                </div>
                <div class="module-arrow">→</div>
            </a>
            <a href="/admin/merch" class="module-card group">
                <div class="module-icon merch">🛍️</div>
                <div class="module-details">
                    <strong class="module-name">Store Mgmt</strong>
                    <span class="module-desc">Inventory & Pricing</span>
                </div>
                <div class="module-arrow">→</div>
            </a>
            <a href="/admin/orders" class="module-card group">
                <div class="module-icon orders">📦</div>
                <div class="module-details">
                    <strong class="module-name">Order Fulfillment</strong>
                    <span class="module-desc">Billing & Logistics</span>
                </div>
                <div class="module-arrow">→</div>
            </a>
        </div>
    </section>

    {#if isLoading}
        <div class="loader-container"><div class="spinner"></div></div>
    {:else}
        <div id="printable-dashboard" class="printable-area">
            
            <section class="kpi-grid">
                <div class="kpi-card">
                    <span class="kpi-label">Streams in Period</span>
                    <span class="kpi-value">{topStreamedArtists.reduce((acc, curr) => acc + curr.totalStreams, 0).toLocaleString()}</span>
                    <div class="kpi-trend positive">From {topStreamedArtists.length} Artists</div>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Merch Revenue</span>
                    <span class="kpi-value text-primary">{formatCurrency(merchRevenue.reduce((acc, curr) => acc + curr.totalRevenue, 0))}</span>
                    <div class="kpi-trend">Period Sales</div>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Avg. Order Value</span>
                    <span class="kpi-value">{formatCurrency(highValuePurchases.systemAverage)}</span>
                    <div class="kpi-trend">System Benchmark</div>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Active Users</span>
                    <span class="kpi-value">{activeUsersReport.length}</span>
                    <div class="kpi-trend premium">Performing Activities</div>
                </div>
            </section>

            <section class="data-viz grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div class="chart-box">
                    <h3 class="chart-title">Top Streamed Artists</h3>
                    <div class="h-[250px]"><Bar data={topArtistsChart} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
                <div class="chart-box">
                    <h3 class="chart-title">Genre Popularity</h3>
                    <div class="h-[250px]"><Pie data={genreChart} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
                <div class="chart-box">
                    <h3 class="chart-title">Merch Revenue by Artist</h3>
                    <div class="h-[250px]"><Bar data={merchRevenueChart} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
                <div class="chart-box">
                    <h3 class="chart-title">Follower Engagement Rate</h3>
                    <div class="h-[250px]"><Doughnut data={engagementChart} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
            </section>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section class="activity-box">
                    <h2 class="section-title">🏆 Most Active Users</h2>
                    <div class="table-wrapper">
                        <table>
                            <thead><tr><th>User</th><th>Listen</th><th>Playlists</th><th>Score</th></tr></thead>
                            <tbody>
                                {#each activeUsersReport.slice(0, 5) as u}
                                    <tr>
                                        <td><div class="flex items-center gap-2"><img src={u.pfpUrl || 'https://placehold.co/32'} class="w-6 h-6 rounded-full" /> {u.username}</div></td>
                                        <td>{u.listenCount}</td><td>{u.playlistCount}</td>
                                        <td class="text-primary font-bold">{u.activityScore}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section class="activity-box">
                    <h2 class="section-title">💎 High-Value Purchases</h2>
                    <div class="table-wrapper">
                        <table>
                            <thead><tr><th>Order</th><th>Customer</th><th>Total</th></tr></thead>
                            <tbody>
                                {#each highValuePurchases.orders.slice(0, 5) as o}
                                    <tr>
                                        <td class="font-mono text-xs">{o.orderId.slice(0, 8)}</td>
                                        <td>{o.username}</td>
                                        <td class="text-primary font-bold">฿{o.totalPrice.toLocaleString()}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                    <p class="text-[10px] text-gray-500 mt-4">* Orders higher than system average (฿{highValuePurchases.systemAverage.toFixed(2)})</p>
                </section>
            </div>
        </div>
    {/if}
</div>

<style>
    @reference "../layout.css";
    .command-center { max-width: 1300px; margin: 0 auto; padding: 2rem; color: #fff; font-family: 'Inter', sans-serif; }
    .dashboard-header { display: flex; justify-content: space-between; margin-bottom: 2rem; }
    .title { font-size: 2rem; font-weight: 900; background: linear-gradient(to right, #fff, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: rgba(255, 255, 255, 0.4); font-size: 0.9rem; }
    
    .filter-select { background: #111; border: 1px solid #333; color: #fff; padding: 0.4rem 0.8rem; rounded: 8px; font-size: 0.8rem; }
    .pdf-btn { background: #a855f7; color: #fff; font-weight: bold; padding: 0.4rem 1rem; rounded: 8px; font-size: 0.8rem; transition: transform 0.2s; }
    .pdf-btn:hover { transform: scale(1.05); }

    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .kpi-card { background: #0a0a0a; padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05); }
    .kpi-label { font-size: 0.65rem; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .kpi-value { display: block; font-size: 1.5rem; font-weight: 800; margin: 0.4rem 0; }
    .kpi-trend { font-size: 0.7rem; font-weight: bold; }
    .positive { color: #10b981; } .premium { color: #a855f7; }

    .chart-box { background: #0a0a0a; padding: 1.25rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05); }
    .chart-title { font-size: 0.8rem; font-weight: 700; color: #999; margin-bottom: 1rem; text-transform: uppercase; }
    
    .activity-box { background: #0a0a0a; padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05); }
    .section-title { font-size: 1rem; font-weight: 800; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { text-align: left; color: #444; padding-bottom: 0.8rem; font-size: 0.7rem; text-transform: uppercase; }
    td { padding: 0.6rem 0; border-top: 1px solid #1a1a1a; }
    
    .loader-container { height: 400px; display: flex; align-items: center; justify-content: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid #1a1a1a; border-top-color: #a855f7; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .admin-badge { background: #111; padding: 0.4rem 0.8rem; border-radius: 99px; font-size: 0.7rem; border: 1px solid #222; display: flex; align-items: center; gap: 0.5rem; }
    .pulse-icon { width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; }

    /* --- Operational Modules Styling --- */
    .module-card { 
        display: flex; 
        align-items: center; 
        gap: 1.25rem; 
        background: #0a0a0a; 
        padding: 1.25rem; 
        border-radius: 1rem; 
        border: 1px solid rgba(255,255,255,0.05); 
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
        text-decoration: none;
        position: relative;
        overflow: hidden;
    }
    .module-card:hover { 
        background: #111; 
        border-color: #a855f7; 
        transform: translateY(-4px) scale(1.02);
        box-shadow: 0 10px 30px -10px rgba(168, 85, 247, 0.3);
    }
    .module-icon { 
        width: 3.5rem; 
        height: 3.5rem; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        font-size: 1.75rem; 
        background: rgba(255, 255, 255, 0.03); 
        border-radius: 0.75rem; 
        transition: all 0.3s;
    }
    .module-card:hover .module-icon {
        background: rgba(168, 85, 247, 0.1);
        transform: rotate(-5deg);
    }
    .module-details { flex: 1; display: flex; flex-direction: column; }
    .module-name { color: #fff; font-size: 1rem; font-weight: 700; transition: color 0.3s; }
    .module-card:hover .module-name { color: #a855f7; }
    .module-desc { color: rgba(255, 255, 255, 0.4); font-size: 0.75rem; font-weight: 500; }
    .module-arrow { 
        color: rgba(255, 255, 255, 0.1); 
        font-size: 1.25rem; 
        font-weight: 900; 
        transition: all 0.3s; 
        transform: translateX(-10px);
        opacity: 0;
    }
    .module-card:hover .module-arrow {
        transform: translateX(0);
        opacity: 1;
        color: #a855f7;
    }

    /* ===== PRINT MODE (CSS Class สำหรับ html-to-image snapshot) ===== */
    :global(.print-mode),
    :global(.print-mode *:not(canvas)) {
        background-color: #ffffff !important;
        color: #111111 !important;
        border-color: #e0e0e0 !important;
    }
    :global(.print-mode .kpi-label),
    :global(.print-mode .chart-title),
    :global(.print-mode th) {
        color: #555555 !important;
    }
    :global(.print-mode .positive) { color: #059669 !important; }
    :global(.print-mode .premium)  { color: #7c3aed !important; }
    :global(.print-mode .text-primary) { color: #7c3aed !important; }

    /* ===== @media print สำหรับ Ctrl+P ===== */
    @media print {
        .dashboard-header .flex,
        .quick-actions,
        .admin-badge,
        .pdf-btn,
        .filter-select {
            display: none !important; /* ซ่อน UI ที่ไม่จำเป็น */
        }
        .command-center {
            padding: 0 !important;
            max-width: 100% !important;
            background: white !important;
            color: black !important;
        }
        .kpi-card, .chart-box, .activity-box {
            background: #f5f5f5 !important;
            border-color: #ccc !important;
            break-inside: avoid; /* ✅ ป้องกัน Card โดนตัดครึ่ง */
        }
        .kpi-value, .section-title, td, th { color: #111 !important; }
        .title {
            -webkit-text-fill-color: #111 !important; /* Gradient ไม่ Print ออกมา แก้เป็น solid */
            background: none !important;
        }
    }
</style>