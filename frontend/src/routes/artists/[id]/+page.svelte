<script lang="ts">
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { playTrack } from '$lib/player.svelte';
    import { authState } from '$lib/auth.svelte';

    let artist: any = $state(null);
    let albums: any[] = $state([]);
    let tracks: any[] = $state([]);
    let loading = $state(true);
    let isFollowing = $state(false);

    onMount(async () => {
        const id = page.params.id;
        await loadArtistData(id);
    });

    $effect(() => {
        if (authState.currentUser?.id && artist?.id) {
            checkFollowStatus();
        }
    });

    async function loadArtistData(id: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/artists/${id}`);
            const data = await res.json();
            if (data.success) {
                artist = data.artist;
                albums = data.albums;
                tracks = data.tracks;
            }
        } catch (e) { console.error(e); }
        loading = false;
    }

    async function checkFollowStatus() {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${authState.currentUser.id}/follows`);
            const data = await res.json();
            if (data.success) {
                isFollowing = data.data.some((a: any) => a.id === artist.id);
            }
        } catch (e) { console.error(e); }
    }

    async function toggleFollow() {
        if (!authState.currentUser) {
            alert('กรุณาเข้าสู่ระบบเพื่อติดตามศิลปิน 🎵'); return;
        }
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/artists/${artist.id}/follow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authState.currentUser.id })
            });
            const data = await res.json();
            if (data.success) isFollowing = data.followed;
        } catch (e) { console.error(e); }
    }
</script>

<main class="max-w-5xl mx-auto py-10 px-5 font-sans">
    <a href="/artists" class="text-primary hover:text-primary-hover transition-colors font-bold mb-8 inline-block">← กลับไปหน้าศิลปิน</a>

    {#if loading}
        <div class="flex flex-col items-center justify-center mt-20 gap-4">
            <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p class="text-text-muted animate-pulse font-medium">กำลังโหลดข้อมูลศิลปิน...</p>
        </div>
    {:else if artist}
        <!-- Artist Header Banner -->
        <div class="relative overflow-hidden rounded-3xl mb-12 group">
            <div class="absolute inset-0 bg-gradient-to-br from-primary/40 to-black/80 z-10"></div>
            <div class="relative flex flex-col md:flex-row gap-8 items-center md:items-end p-8 md:p-12 z-20">
                <div class="w-48 h-48 md:w-64 md:h-64 bg-gradient-to-br from-primary to-purple-800 rounded-full flex items-center justify-center text-7xl md:text-9xl font-bold text-white shadow-2xl border-4 border-white/10 shrink-0">
                    {artist.name.charAt(0).toUpperCase()}
                </div>
                
                <div class="flex-1 text-center md:text-left">
                    <p class="flex items-center gap-2 font-bold uppercase text-xs md:text-sm tracking-[0.2em] text-primary mb-3">
                        <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        Verified Artist
                    </p>
                    <h1 class="text-5xl md:text-8xl font-black text-white mb-8 tracking-tighter drop-shadow-lg">{artist.name}</h1>
                    
                    <div class="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-6">
                        <button 
                            onclick={() => tracks.length > 0 && playTrack(tracks[0], tracks)} 
                            class="px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-full font-black text-lg shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            disabled={tracks.length === 0}
                        >
                            <span class="text-2xl">▶</span> เล่นเพลงทั้งหมด
                        </button>
                        
                        <button 
                            onclick={toggleFollow} 
                            class="px-8 py-4 rounded-full font-black text-lg border-2 transition-all flex items-center gap-2 hover:scale-105 active:scale-95 {isFollowing ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/20 hover:border-white'}"
                        >
                            {isFollowing ? '✓ กำลังติดตาม' : 'ติดตาม'}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Albums Section -->
        {#if albums.length > 0}
            <div class="mb-16">
                <div class="flex items-center justify-between mb-8">
                    <h2 class="text-3xl font-black text-white tracking-tight">💿 ผลงานอัลบั้ม</h2>
                    <span class="text-text-muted text-sm font-medium">{albums.length} อัลบั้ม</span>
                </div>
                
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {#each albums as album}
                        <a href="/albums/{album.id}" class="group block">
                            <div class="bg-bg-surface hover:bg-bg-highlight p-4 rounded-2xl transition-all duration-300 shadow-lg border border-white/5 hover:-translate-y-2">
                                <div class="aspect-square bg-bg-highlight rounded-xl flex items-center justify-center overflow-hidden mb-4 relative shadow-inner">
                                    {#if album.imgUrl}
                                        <img src={album.imgUrl} alt={album.title} class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    {:else}
                                        <span class="text-5xl opacity-20">💿</span>
                                    {/if}
                                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-xl translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                            <span class="text-white text-xl">▶</span>
                                        </div>
                                    </div>
                                </div>
                                <h3 class="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">{album.title}</h3>
                                <p class="text-xs text-text-muted mt-1">Album • {new Date().getFullYear()}</p>
                            </div>
                        </a>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Popular Tracks Section -->
        {#if tracks.length > 0}
            <div>
                <div class="flex items-center justify-between mb-8">
                    <h2 class="text-3xl font-black text-white tracking-tight">🎵 เพลงยอดนิยม</h2>
                    <span class="text-text-muted text-sm font-medium">{tracks.length} รายการ</span>
                </div>
                
                <div class="flex flex-col rounded-2xl overflow-hidden bg-bg-surface/50 border border-white/5 divide-y divide-white/5">
                    {#each tracks as track, i}
                        <div 
                            class="flex items-center justify-between p-4 hover:bg-white/5 transition-all group cursor-pointer"
                            onclick={() => playTrack(track, tracks)}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => e.key === 'Enter' && playTrack(track, tracks)}
                        >
                            <div class="flex items-center gap-4 min-w-0">
                                <div class="w-8 text-center text-text-muted font-bold group-hover:hidden">{i + 1}</div>
                                <div class="w-8 text-center text-primary font-bold hidden group-hover:block">▶</div>
                                
                                <div class="min-w-0">
                                    <p class="font-bold text-white truncate group-hover:text-primary transition-colors">{track.title}</p>
                                    <div class="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                        <span class="flex items-center gap-1">
                                            <span class="w-1 h-1 rounded-full bg-text-muted/50"></span>
                                            {track.viewCount || 0} views
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-6">
                                <span class="text-sm text-text-muted font-mono">{track.duration || '0:00'}</span>
                                <button class="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-primary text-xl" onclick={(e) => { e.stopPropagation(); /* handle favorite */ }}>
                                    💜
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</main>