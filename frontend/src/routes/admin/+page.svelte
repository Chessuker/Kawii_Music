<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

    // State using Svelte 5 Runes
    let users = $state<any[]>([]);
    let logs = $state<any[]>([]);
    let orders = $state<any[]>([]);
    let rankings = $state<any[]>([]);
    let totalTracksCount = $state(0); // แยก State ออกมาเก็บจำนวนเพลงโดยเฉพาะ
    
    let isLoading = $state(true);
    let fetchErrors = $state<string[]>([]); // เก็บ Error ไว้แสดงผลเฉพาะจุด

    // Derived values for KPIs (คำนวณจาก Data จริงที่มี)
    let totalUsers = $derived(users.length);
    let activeUsers = $derived(users.filter(u => u.accountStatus === 'active').length); // อิงจาก ENUM ใน DB
    let totalRevenue = $derived(orders.reduce((acc, curr) => acc + Number(curr.order.totalPrice || 0), 0));
    
    // คำนวณยอดขายเฉลี่ยต่อบิล (AOV - Average Order Value) ให้ดูมีมิติวิเคราะห์มากขึ้น
    let avgOrderValue = $derived(orders.length > 0 ? totalRevenue / orders.length : 0);

    onMount(async () => {
        try {
            // ใช้ Promise.allSettled เพื่อให้ถ้าระบบใดระบบหนึ่งร่วง แดชบอร์ดส่วนอื่นยังทำงานต่อได้ (Fault-tolerant)
            const results = await Promise.allSettled([
                fetch('http://127.0.0.1:8787/api/users').then(r => r.json()),
                fetch('http://127.0.0.1:8787/api/logs').then(r => r.json()),
                fetch('http://127.0.0.1:8787/api/admin/orders').then(r => r.json()),
                fetch('http://127.0.0.1:8787/api/admin/artists/ranking').then(r => r.json()),
                fetch('http://127.0.0.1:8787/api/tracks?limit=1').then(r => r.json()) // แอบยิงไปเอา Pagination Metadata มาใช้
            ]);

            // แกะกล่อง Data แบบเป็นระบบ
            if (results[0].status === 'fulfilled' && results[0].value.success) users = results[0].value.data;
            if (results[1].status === 'fulfilled' && results[1].value.success) logs = results[1].value.data;
            if (results[2].status === 'fulfilled' && results[2].value.success) orders = results[2].value.data;
            if (results[3].status === 'fulfilled' && results[3].value.success) rankings = results[3].value.data;
            
            // ดึงจำนวนเพลงทั้งหมดจาก Pagination object
            if (results[4].status === 'fulfilled' && results[4].value.success) {
                totalTracksCount = results[4].value.pagination.totalTracks;
            }

            // แกะ Error ออกมา (ถ้ามี)
            results.forEach((res, index) => {
                if (res.status === 'rejected' || (res.status === 'fulfilled' && !res.value.success)) {
                    fetchErrors.push(`Module ${index + 1} Failed to sync`);
                }
            });

        } catch (error) {
            console.error("Dashboard core failure:", error);
        } finally {
            isLoading = false;
        }
    });

    const formatCurrency = (val: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
</script>

<div class="command-center">
    <!-- Header -->
    <header class="dashboard-header">
        <div class="header-content">
            <h1 class="title">Command Center</h1>
            <p class="subtitle">System Overview & Administrative Intelligence</p>
        </div>
        <div class="admin-badge">
            <span class="pulse-icon"></span>
            System Live: {adminAuthState.currentAdmin?.username}
        </div>
    </header>

    {#if isLoading}
        {:else}
        {#if fetchErrors.length > 0}
            <div class="system-warning" style="background: #7f1d1d; color: #fca5a5; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-family: monospace;">
                ⚠️ <strong>System Warning:</strong> {fetchErrors.join(' | ')}
            </div>
        {/if}
        <!-- Zone 1: KPIs -->
        <section class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-label">Total Users</span>
                <span class="kpi-value">{totalUsers.toLocaleString()}</span>
                <div class="kpi-trend positive">{activeUsers} Active Accounts</div>
            </div>
            <div class="kpi-card">
                <span class="kpi-label">Tracks in Database</span>
                <span class="kpi-value">{totalTracksCount.toLocaleString()}</span>
                <div class="kpi-trend premium">Indexed Audio Files</div>
            </div>
            <div class="kpi-card">
                <span class="kpi-label">Total Gross Revenue</span>
                <span class="kpi-value text-primary">{formatCurrency(totalRevenue)}</span>
                <div class="kpi-trend">From {orders.length} Completed Orders</div>
            </div>
            <div class="kpi-card">
                <span class="kpi-label">Average Order Value (AOV)</span>
                <span class="kpi-value">{formatCurrency(avgOrderValue)}</span>
                <div class="kpi-trend">Per Transaction</div>
            </div>
        </section>

        <!-- Zone 2: Quick Actions -->
        <section class="quick-actions">
            <h2 class="section-title">Operational Modules</h2>
            <div class="action-grid">
                <a href="/admin/tracks" class="action-btn tracks">
                    <span class="icon">🎵</span>
                    <div class="details">
                        <strong>Music Library</strong>
                        <span>Upload & Sync</span>
                    </div>
                </a>
                <a href="/admin/artists" class="action-btn artists">
                    <span class="icon">🎤</span>
                    <div class="details">
                        <strong>Artists</strong>
                        <span>Profiles & Creators</span>
                    </div>
                </a>
                <a href="/admin/albums" class="action-btn albums">
                    <span class="icon">💿</span>
                    <div class="details">
                        <strong>Albums</strong>
                        <span>Collections & Covers</span>
                    </div>
                </a>
                <a href="/admin/users" class="action-btn users">
                    <span class="icon">👤</span>
                    <div class="details">
                        <strong>User Control</strong>
                        <span>Permissions & Ban</span>
                    </div>
                </a>
                <a href="/admin/merch" class="action-btn merch">
                    <span class="icon">🛍️</span>
                    <div class="details">
                        <strong>Store Mgmt</strong>
                        <span>Inventory & Pricing</span>
                    </div>
                </a>
                <a href="/admin/orders" class="action-btn orders">
                    <span class="icon">📦</span>
                    <div class="details">
                        <strong>Order Fulfillment</strong>
                        <span>Billing & Shipping</span>
                    </div>
                </a>
            </div>
        </section>

        <!-- Zone 3: Recent Activities -->
        <div class="activity-split">
            <!-- Left: Recent Orders -->
            <section class="activity-box">
                <h2 class="section-title">Recent Orders</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each orders.slice(0, 5) as item}
                                <tr>
                                    <td class="font-mono text-xs">{item.order.id.slice(0, 8)}...</td>
                                    <td class="font-bold text-primary">฿{Number(item.order.totalPrice).toLocaleString()}</td>
                                    <td><span class="status-pill">Paid</span></td>
                                </tr>
                            {:else}
                                <tr><td colspan="3" class="empty">No recent orders</td></tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Right: Security Audit Logs -->
            <section class="activity-box">
                <h2 class="section-title">Security Audit</h2>
                <div class="log-list">
                    {#each logs.slice(0, 6) as log}
                        <div class="log-item">
                            <span class="log-time">{new Date(log.createdAt).toLocaleTimeString()}</span>
                            <div class="log-details">
                                <span class="log-actor">{log.actorName}</span>
                                <span class="log-action">{log.actionType}: {log.actionDetail}</span>
                            </div>
                        </div>
                    {:else}
                        <p class="empty">No security events logged</p>
                    {/each}
                </div>
            </section>
        </div>

        <!-- Zone 4: Data Visualization -->
        <section class="data-viz">
            <h2 class="section-title">Top Trending Artists</h2>
            <div class="chart-container">
                {#each rankings.slice(0, 5) as artist}
                    <div class="bar-group">
                        <div class="bar-label">
                            <span class="artist-name">{artist.name}</span>
                            <span class="artist-count">{artist.followerCount.toLocaleString()} fans</span>
                        </div>
                        <div class="bar-wrapper">
                            <div class="bar" style="width: {(artist.followerCount / (rankings[0]?.followerCount || 1)) * 100}%"></div>
                        </div>
                    </div>
                {/each}
            </div>
        </section>
    {/if}
</div>

<style>
    @reference "../layout.css";

    .command-center {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
        display: flex;
        flex-col: gap-10;
        flex-direction: column;
        color: #fff;
        font-family: 'Inter', system-ui, sans-serif;
    }

    /* Header */
    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 2.5rem;
    }
    .title {
        font-size: 2.5rem;
        font-weight: 900;
        letter-spacing: -0.025em;
        background: linear-gradient(to right, #fff, #a855f7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    .subtitle {
        color: rgba(255, 255, 255, 0.5);
        font-weight: 500;
    }
    .admin-badge {
        background: rgba(255, 255, 255, 0.05);
        padding: 0.5rem 1rem;
        border-radius: 99px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 0.8rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .pulse-icon {
        width: 8px;
        height: 8px;
        background: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 10px #10b981;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* Loader */
    .loader-container {
        height: 400px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        color: rgba(255, 255, 255, 0.5);
    }
    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(168, 85, 247, 0.1);
        border-top-color: #a855f7;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Zone 1: KPIs */
    .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1.5rem;
        margin-bottom: 3rem;
    }
    .kpi-card {
        background: #111;
        padding: 1.5rem;
        border-radius: 1.25rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        transition: transform 0.2s, border-color 0.2s;
    }
    .kpi-card:hover {
        transform: translateY(-4px);
        border-color: rgba(168, 85, 247, 0.3);
    }
    .kpi-label {
        font-size: 0.75rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 0.5rem;
    }
    .kpi-value {
        font-size: 1.875rem;
        font-weight: 900;
        margin-bottom: 0.5rem;
    }
    .kpi-trend {
        font-size: 0.7rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.3);
    }
    .kpi-trend.positive { color: #10b981; }
    .kpi-trend.premium { color: #a855f7; }

    /* Zone 2: Quick Actions */
    .section-title {
        font-size: 1.25rem;
        font-weight: 800;
        margin-bottom: 1.5rem;
        color: #fff;
    }
    .quick-actions {
        margin-bottom: 3rem;
    }
    .action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
    }
    .action-btn {
        background: rgba(255, 255, 255, 0.03);
        padding: 1.25rem;
        border-radius: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        gap: 1rem;
        text-decoration: none;
        transition: all 0.2s;
    }
    .action-btn:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.1);
        transform: scale(1.02);
    }
    .action-btn .icon {
        font-size: 1.5rem;
        background: rgba(255, 255, 255, 0.05);
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
    }
    .action-btn .details {
        display: flex;
        flex-direction: column;
    }
    .action-btn strong {
        font-size: 0.95rem;
        font-weight: 700;
        color: #fff;
    }
    .action-btn span {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
    }

    /* Zone 3: Recent Activities */
    .activity-split {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: 1.5rem;
        margin-bottom: 3rem;
    }
    .activity-box {
        background: #111;
        padding: 1.5rem;
        border-radius: 1.25rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .table-wrapper {
        overflow-x: auto;
    }
    table {
        width: 100%;
        border-collapse: collapse;
    }
    th {
        text-align: left;
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.3);
        padding-bottom: 1rem;
    }
    td {
        padding: 0.75rem 0;
        border-top: 1px solid rgba(255, 255, 255, 0.03);
        font-size: 0.875rem;
    }
    .status-pill {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
        padding: 0.2rem 0.6rem;
        border-radius: 99px;
        font-size: 0.65rem;
        font-weight: 900;
        text-transform: uppercase;
    }

    .log-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .log-item {
        display: flex;
        gap: 1rem;
        font-size: 0.8rem;
    }
    .log-time {
        color: rgba(255, 255, 255, 0.2);
        font-family: monospace;
        flex-shrink: 0;
    }
    .log-details {
        display: flex;
        flex-direction: column;
    }
    .log-actor {
        font-weight: 700;
        color: #a855f7;
    }
    .log-action {
        color: rgba(255, 255, 255, 0.5);
    }

    /* Zone 4: Data Viz */
    .data-viz {
        background: #111;
        padding: 1.5rem;
        border-radius: 1.25rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .chart-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }
    .bar-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .bar-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        font-weight: 700;
    }
    .artist-name { color: #fff; }
    .artist-count { color: rgba(255, 255, 255, 0.4); }
    .bar-wrapper {
        height: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 99px;
        overflow: hidden;
    }
    .bar {
        height: 100%;
        background: linear-gradient(to right, #a855f7, #6366f1);
        border-radius: 99px;
        transition: width 1s ease-out;
    }

    .empty {
        text-align: center;
        padding: 2rem;
        color: rgba(255, 255, 255, 0.2);
        font-style: italic;
        font-size: 0.8rem;
    }

    @media (max-width: 768px) {
        .activity-split {
            grid-template-columns: 1fr;
        }
        .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
        }
    }
</style>
