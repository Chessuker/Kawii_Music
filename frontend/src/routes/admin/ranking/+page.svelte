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

    function getRankMedal(index: number) {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `${index + 1}`;
    }
</script>

<div class="max-w-4xl mx-auto flex flex-col gap-10">
    <nav>
        <a href="/admin" class="text-primary hover:underline font-bold flex items-center gap-2">
            <span>&lsaquo;</span> Back to Dashboard
        </a>
    </nav>
    
    <header>
        <h1 class="text-4xl font-black tracking-tight mb-2">🏆 Artist Leaderboard</h1>
        <p class="text-text-muted font-medium">Analyzing popularity and follower growth (Top 20)</p>
    </header>

    <!-- Admin Navigation Modules -->
    <section class="bg-bg-elevated p-6 rounded-2xl border border-white/5 shadow-2xl">
        <p class="text-xs uppercase tracking-widest text-text-muted font-bold mb-4">Quick Navigation</p>
        <div class="flex flex-wrap gap-3">
            <a href="/admin/tracks" class="nav-module-btn border-l-teal-500 hover:border-teal-500">🎵 Tracks</a>
            <a href="/admin/artists" class="nav-module-btn border-l-emerald-500 hover:border-emerald-500">🎤 Artists</a>
            <a href="/admin/albums" class="nav-module-btn border-l-sky-500 hover:border-sky-500">💿 Albums</a>
            <a href="/admin/users" class="nav-module-btn border-l-indigo-500 hover:border-indigo-500">👤 Users</a>
            <a href="/admin/merch" class="nav-module-btn border-l-primary hover:border-primary">🛍️ Store</a>
            <a href="/admin/orders" class="nav-module-btn border-l-amber-500 hover:border-amber-500">📦 Orders</a>
            <a href="/admin/ranking" class="nav-module-btn border-l-pink-500 bg-white/5 border-pink-500">🏆 Ranking</a>
            <a href="/admin/logs" class="nav-module-btn border-l-gray-500 hover:border-gray-500">🛡️ Logs</a>
        </div>
    </section>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Calculating rankings...</p>
        </div>
    {:else if topArtists.length === 0}
        <div class="text-center py-20 text-text-muted italic">No artist data found in the system.</div>
    {:else}
        <div class="flex flex-col gap-4">
            {#each topArtists as artist, i}
                <div class="group flex items-center bg-bg-elevated hover:bg-bg-highlight p-6 rounded-2xl transition-all duration-300 border border-white/5 shadow-xl {i < 3 ? 'border-l-4' : ''}" 
                    style="border-left-color: {i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'transparent'}">
                    
                    <div class="w-16 text-center font-black text-2xl {i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-text-muted/40'}">
                        {getRankMedal(i)}
                    </div>
                    
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-indigo-900 flex items-center justify-center text-white font-black text-2xl shadow-2xl mr-6 shrink-0 group-hover:scale-105 transition-transform">
                        {artist.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <h2 class="text-xl font-black text-white group-hover:text-primary transition-colors truncate">{artist.name}</h2>
                        <p class="text-[10px] font-black uppercase tracking-widest text-text-muted mt-1">Verified Artist</p>
                    </div>
                    
                    <div class="text-right">
                        <span class="block text-2xl font-black text-primary leading-none">{artist.followerCount.toLocaleString()}</span>
                        <span class="text-[10px] font-black uppercase tracking-widest text-text-muted">Followers</span>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    @reference "../../layout.css";

    .nav-module-btn {
        @apply px-4 py-3 bg-bg-highlight text-white rounded-xl font-black text-sm border border-white/5 transition-all flex items-center gap-2 border-l-4;
    }
    
    .nav-module-btn:hover {
        @apply bg-white/10 -translate-y-1 shadow-xl;
    }
    
    .nav-module-btn:active {
        @apply translate-y-0;
    }
</style>
