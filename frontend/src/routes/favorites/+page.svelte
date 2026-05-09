<script lang="ts">
    import { authState } from '$lib/auth.svelte';
    import { playTrack } from '$lib/player.svelte';
    
    let favoriteTracks: any[] = $state([]);
    let isLoading = $state(true);

    $effect(() => {
        if (authState.currentUser?.id) {
            fetchFavorites(authState.currentUser.id);
        } else {
            favoriteTracks = [];
            isLoading = false;
        }
    });

    async function fetchFavorites(userId: string) {
        isLoading = true;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/favorites`);
            const data = await res.json();
            if (data.success) {
                favoriteTracks = data.data;
            }
        } catch (error) {
            console.error(error);
        }
        isLoading = false;
    }

    async function toggleLike(trackId: string) {
        if (!authState.currentUser) return;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/tracks/${trackId}/like`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authState.currentUser.id })
            });
            const result = await res.json();
            
            if (result.success && !result.liked) {
                favoriteTracks = favoriteTracks.filter(t => t.id !== trackId);
            }
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    }

    function playAll() {
        if (favoriteTracks.length > 0) {
            playTrack(favoriteTracks[0], favoriteTracks);
        }
    }
</script>

<div class="flex flex-col gap-8">
    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading your favorite songs...</p>
        </div>
    {:else if !authState.currentUser}
        <div class="flex flex-col items-center justify-center h-[50vh] text-center gap-6">
            <div class="text-7xl mb-4">🔐</div>
            <h2 class="text-3xl font-black">Please log in</h2>
            <p class="text-text-muted max-w-md">You need to be logged in to see your favorite songs.</p>
            <a href="/login" class="bg-primary hover:bg-primary-hover text-black px-10 py-3 rounded-full font-bold text-lg transition-all hover:scale-105">Log In</a>
        </div>
    {:else}
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row items-end gap-8 bg-gradient-to-t from-bg-surface/50 to-purple-900/40 p-10 rounded-3xl border border-white/5 shadow-2xl">
            <div class="w-64 h-64 bg-gradient-to-br from-indigo-700 to-purple-400 flex items-center justify-center rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] shrink-0">
                <span class="text-9xl filter drop-shadow-lg">💜</span>
            </div>
            <div class="flex flex-col gap-2">
                <p class="text-xs font-black uppercase tracking-[0.2em]">Playlist</p>
                <h1 class="text-6xl md:text-8xl font-black tracking-tight mb-4">Liked Songs</h1>
                <div class="flex items-center gap-2 text-sm font-bold">
                    {#if authState.currentUser.pfpUrl || authState.currentUser.pfp_url}
                        <img src={authState.currentUser.pfpUrl || authState.currentUser.pfp_url} alt="" class="w-6 h-6 rounded-full" />
                    {/if}
                    <span>{authState.currentUser.displayName || authState.currentUser.username}</span>
                    <span class="text-text-muted">• {favoriteTracks.length} songs</span>
                </div>
            </div>
        </div>

        <div class="px-2">
            {#if favoriteTracks.length > 0}
                <div class="flex items-center gap-8 mb-8">
                    <button 
                        onclick={playAll}
                        class="w-16 h-16 bg-primary rounded-full shadow-2xl flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all duration-300"
                    >
                        <span class="text-3xl ml-1">▶</span>
                    </button>
                    <button class="text-3xl text-text-muted hover:text-white transition-colors">💜</button>
                </div>

                <div class="bg-bg-elevated/30 rounded-2xl border border-white/5 overflow-hidden">
                    <div class="grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-4 text-xs font-bold text-text-muted border-b border-white/10 uppercase tracking-widest">
                        <div class="w-10">#</div>
                        <div>Title</div>
                        <div class="pr-8">Duration</div>
                    </div>

                    <div class="flex flex-col py-2">
                        {#each favoriteTracks as track, index}
                            <div class="group grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-3 items-center hover:bg-white/10 transition-colors rounded-md mx-2">
                                <div class="w-10 text-text-muted text-sm group-hover:hidden">{index + 1}</div>
                                <button onclick={() => playTrack(track, favoriteTracks)} class="w-10 text-white text-sm hidden group-hover:block">▶</button>
                                
                                <div class="flex items-center gap-4 min-w-0">
                                    <div class="w-12 h-12 bg-bg-highlight rounded overflow-hidden shrink-0 shadow-lg">
                                        {#if track.album?.imgUrl || track.album?.img_url}
                                            <img src={track.album.imgUrl || track.album.img_url} alt="" class="w-full h-full object-cover" />
                                        {:else}
                                            <div class="w-full h-full flex items-center justify-center text-xl">🎵</div>
                                        {/if}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-bold text-white text-base truncate">{track.title}</div>
                                        <div class="text-text-muted text-sm truncate hover:underline cursor-pointer">
                                            {track.artists?.map((a:any) => a.name).join(', ') || 'Unknown'}
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="flex items-center gap-6">
                                    <button 
                                        onclick={() => toggleLike(track.id)}
                                        class="text-2xl transition-transform hover:scale-120 active:scale-90"
                                    >💜</button>
                                    <span class="text-sm text-text-muted w-12 text-right">{track.duration}</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {:else}
                <div class="flex flex-col items-center justify-center py-20 text-center gap-6 bg-bg-elevated/30 rounded-3xl border-2 border-dashed border-white/10">
                    <span class="text-7xl opacity-50">🤍</span>
                    <div>
                        <h3 class="text-2xl font-bold mb-2">Songs you like will appear here</h3>
                        <p class="text-text-muted">Save songs by tapping the heart icon.</p>
                    </div>
                    <a href="/" class="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-all">Find songs</a>
                </div>
            {/if}
        </div>
    {/if}
</div>
