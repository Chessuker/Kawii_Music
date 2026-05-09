<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

    let topArtists: any[] = $state([]);
    let loading = $state(true);

    onMount(async () => {
        try {
            const res = await fetch('http://127.0.0.1:8787/api/admin/artists/ranking');
            const data = await res.json();
            if (data.success) {
                topArtists = data.data;
            }
        } catch (e) { console.error(e); }
        loading = false;
    });

    // Helper เพื่อแสดงเหรียญรางวัลสำหรับ Top 3
    function getRankMedal(index: number) {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `${index + 1}`;
    }
</script>

<main class="ranking-container">
    <nav style="margin-bottom: 2rem;">
        <a href="/admin" class="back-link">← กลับหน้า Dashboard</a>
    </nav>
    
    <header>
        <h1>🏆 จัดอันดับศิลปินยอดนิยม</h1>
        <p>วิเคราะห์กระแสตอบรับและจำนวนผู้ติดตามของศิลปิน (Top 20)</p>
    </header>

    {#if loading}
        <div class="status">กำลังประมวลผลข้อมูล...</div>
    {:else if topArtists.length === 0}
        <div class="status">ยังไม่มีข้อมูลศิลปินในระบบ</div>
    {:else}
        <div class="leaderboard">
            {#each topArtists as artist, i}
                <div class="rank-card" class:top-three={i < 3}>
                    <div class="rank-number" class:gold={i === 0} class:silver={i === 1} class:bronze={i === 2}>
                        {getRankMedal(i)}
                    </div>
                    
                    <div class="artist-avatar">
                        {artist.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div class="artist-info">
                        <h2>{artist.name}</h2>
                    </div>
                    
                    <div class="follower-count">
                        <span class="count-number">{artist.followerCount.toLocaleString()}</span>
                        <span class="count-label">ผู้ติดตาม</span>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</main>

<style>
    .ranking-container { padding: 2rem; max-width: 900px; margin: 0 auto; font-family: sans-serif; color: #333; }
    .back-link { color: #1db954; text-decoration: none; font-weight: bold; background: #e8f5e9; padding: 8px 15px; border-radius: 8px; }
    .back-link:hover { background: #c8e6c9; }
    
    h1 { margin: 0 0 0.5rem 0; color: #1db954; font-size: 2.2rem; }
    header p { color: #666; margin: 0 0 2rem 0; font-size: 1.1em; }
    
    .status { text-align: center; padding: 4rem; color: #888; background: #f8f9fa; border-radius: 12px; border: 1px dashed #ccc; }

    .leaderboard { display: flex; flex-direction: column; gap: 15px; }
    
    .rank-card {
        display: flex;
        align-items: center;
        background: #fff;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.03);
        border: 1px solid #f0f0f0;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .rank-card:hover {
        transform: scale(1.01);
        box-shadow: 0 6px 15px rgba(0,0,0,0.08);
    }
    
    /* สไตล์พิเศษสำหรับ Top 3 */
    .rank-card.top-three { border: 1px solid #eee; }
    .rank-card.top-three:nth-child(1) { background: linear-gradient(90deg, #fffbee, #fff); border-left: 5px solid #fbbf24; }
    .rank-card.top-three:nth-child(2) { background: linear-gradient(90deg, #f8fafc, #fff); border-left: 5px solid #94a3b8; }
    .rank-card.top-three:nth-child(3) { background: linear-gradient(90deg, #fff7ed, #fff); border-left: 5px solid #b45309; }

    .rank-number { width: 50px; font-size: 1.5rem; font-weight: bold; color: #999; text-align: center; }
    .rank-number.gold { font-size: 2rem; color: #fbbf24; }
    .rank-number.silver { font-size: 2rem; color: #94a3b8; }
    .rank-number.bronze { font-size: 2rem; color: #b45309; }

    .artist-avatar {
        width: 50px; height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1db954, #1976d2);
        color: white;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.5rem; font-weight: bold;
        margin-right: 20px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }

    .artist-info { flex: 1; }
    .artist-info h2 { margin: 0; font-size: 1.2rem; color: #222; }

    .follower-count { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .count-number { font-size: 1.5rem; font-weight: bold; color: #1db954; line-height: 1; }
    .count-label { font-size: 0.85rem; color: #888; margin-top: 5px; }
</style>