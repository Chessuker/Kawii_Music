<script lang="ts">
    import { onMount } from 'svelte';
    import { authState } from '$lib/auth.svelte';

    let stats: any = $state(null);
    let loading = $state(true);

    $effect(() => {
        if (authState.currentUser?.id) fetchAnalytics(authState.currentUser.id);
    });

    async function fetchAnalytics(userId: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/analytics`);
            const result = await res.json();
            if (result.success) stats = result.data;
        } catch (e) { console.error(e); }
        loading = false;
    }
</script>

<main class="analytics-container">
    <header>
        <h1>📊 Listening Analytics</h1>
        <p>วิเคราะห์ตัวตนผ่านเสียงเพลงที่คุณฟัง</p>
    </header>

    {#if loading}
        <p class="status">กำลังคำนวณข้อมูลเชิงลึก...</p>
    {:else if stats}
        <div class="stats-grid">
            <section class="card">
                <h2>🎤 ศิลปินโปรดของคุณ</h2>
                <div class="list">
                    {#each stats.topArtists as artist, i}
                        <div class="item">
                            <span class="rank">{i + 1}</span>
                            <span class="name">{artist.name}</span>
                            <span class="count">{artist.playCount} ครั้ง</span>
                        </div>
                    {/each}
                </div>
            </section>

            <section class="card">
                <h2>🎸 แนวเพลงที่ใช่</h2>
                <div class="list">
                    {#each stats.topGenres as genre, i}
                        <div class="item">
                            <span class="badge">{genre.name}</span>
                            <div class="progress-bar">
                                <div class="fill" style="width: {(genre.playCount / stats.topGenres[0].playCount) * 100}%"></div>
                            </div>
                            <span class="count">{genre.playCount}</span>
                        </div>
                    {/each}
                </div>
            </section>
        </div>

        <section class="card trend">
            <h2>📈 สถิติการฟัง 7 วันล่าสุด</h2>
            <div class="trend-chart">
                {#each stats.listeningTrend as day}
                    <div class="bar-wrapper">
                        <div class="bar" style="height: {(day.count / Math.max(...stats.listeningTrend.map(d=>d.count))) * 150}px">
                            <span class="tooltip">{day.count} เพลง</span>
                        </div>
                        <span class="date-label">{new Date(day.date).toLocaleDateString('th-TH', {weekday: 'short'})}</span>
                    </div>
                {/each}
            </div>
        </section>
    {/if}
</main>

<style>
    .analytics-container { padding: 3rem 2rem; max-width: 1000px; margin: 0 auto; color: #fff; font-family: sans-serif; }
    h1 { font-size: 2.5rem; color: #1db954; margin: 0; }
    header p { color: #888; margin-top: 10px; }

    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 3rem; }
    @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr; } }

    .card { background: #1a1a1a; padding: 2rem; border-radius: 16px; border: 1px solid #333; }
    .card h2 { font-size: 1.2rem; margin-bottom: 1.5rem; color: #ccc; }

    .list { display: flex; flex-direction: column; gap: 1rem; }
    .item { display: flex; align-items: center; gap: 15px; }
    .rank { font-weight: bold; color: #1db954; font-size: 1.2rem; width: 25px; }
    .name { flex: 1; font-weight: bold; }
    .count { color: #888; font-size: 0.9rem; }

    .progress-bar { flex: 1; height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
    .fill { height: 100%; background: #1db954; }

    .trend-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 200px; margin-top: 2rem; border-bottom: 1px solid #333; }
    .bar-wrapper { display: flex; flex-direction: column; align-items: center; gap: 10px; flex: 1; }
    .bar { width: 30px; background: #1db954; border-radius: 4px 4px 0 0; position: relative; transition: filter 0.2s; }
    .bar:hover { filter: brightness(1.2); }
    .tooltip { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: #fff; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; opacity: 0; transition: opacity 0.2s; }
    .bar:hover .tooltip { opacity: 1; }
    .date-label { font-size: 0.8rem; color: #666; }
</style>
