<script lang="ts">
    import { page } from '$app/stores';
    import { playTrack } from '$lib/player.svelte';
    
    let playlist: any = $state(null);
    let tracks: any[] = $state([]);
    let isLoading = $state(true);

    $effect(() => {
        const currentId = $page.params.id;
        if (currentId) {
            fetchPlaylistData(currentId);
        }
    });

    async function fetchPlaylistData(id: string) {
        isLoading = true;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/playlists/${id}`);
            const data = await res.json();
            if (data.success) {
                playlist = data.playlist;
                tracks = data.tracks;
            }
        } catch (error) {
            console.error(error);
        }
        isLoading = false;
    }

    function playAll() {
        if (tracks.length > 0) {
            playTrack(tracks[0], tracks);
        }
    }
</script>

<div class="flex flex-col gap-8">
    <a href="/" class="text-text-muted hover:text-white font-bold text-sm flex items-center gap-2 transition-colors">
        <span>&lsaquo;</span> Back to Home
    </a>

    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading playlist...</p>
        </div>
    {:else if playlist}
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row items-end gap-8 bg-gradient-to-t from-bg-surface/50 to-bg-highlight/40 p-10 rounded-3xl border border-white/5 shadow-2xl">
            <div class="w-64 h-64 bg-gradient-to-br from-purple-800 to-indigo-900 flex items-center justify-center rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] shrink-0">
                <span class="text-9xl filter drop-shadow-lg">🎵</span>
            </div>
            <div class="flex flex-col gap-2">
                <p class="text-xs font-black uppercase tracking-[0.2em]">Playlist</p>
                <h1 class="text-5xl md:text-7xl font-black tracking-tight mb-4">{playlist.name}</h1>
                <div class="flex items-center gap-2 text-sm font-bold">
                    <span class="text-white">Created for you</span>
                    <span class="text-text-muted">• {tracks.length} tracks</span>
                </div>
                <div class="mt-6">
                    <button 
                        onclick={playAll}
                        class="bg-primary hover:bg-primary-hover text-black px-10 py-3 rounded-full font-black text-lg transition-all hover:scale-105 active:scale-95 shadow-xl"
                    >
                        ▶ Play
                    </button>
                </div>
            </div>
        </div>

        <div class="px-2">
            {#if tracks.length > 0}
                <div class="bg-bg-elevated/30 rounded-2xl border border-white/5 overflow-hidden">
                    <div class="grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-4 text-xs font-bold text-text-muted border-b border-white/10 uppercase tracking-widest">
                        <div class="w-10">#</div>
                        <div>Title</div>
                        <div class="pr-8">Duration</div>
                    </div>

                    <div class="flex flex-col py-2">
                        {#each tracks as track, index}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div 
                                class="group grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-3 items-center hover:bg-white/10 transition-colors rounded-md mx-2 cursor-pointer"
                                onclick={() => playTrack(track, tracks)}
                            >
                                <div class="w-10 text-text-muted text-sm group-hover:hidden">{index + 1}</div>
                                <button class="w-10 text-white text-sm hidden group-hover:block text-left">▶</button>
                                
                                <div class="flex items-center gap-4 min-w-0">
                                    <div class="w-12 h-12 bg-bg-highlight rounded overflow-hidden shrink-0 shadow-lg flex items-center justify-center text-xl">
                                        {#if track.album?.imgUrl || track.album?.img_url}
                                            <img src={track.album.imgUrl || track.album.img_url} alt="" class="w-full h-full object-cover" />
                                        {:else}
                                            🎵
                                        {/if}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-bold text-white text-base truncate">{track.title}</div>
                                        <div class="text-text-muted text-sm truncate">
                                            {track.artists?.map((a:any) => a.name).join(', ') || 'Unknown'}
                                        </div>
                                    </div>
                                </div>
                                
                                <span class="text-sm text-text-muted w-12 text-right">{track.duration}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            {:else}
                <div class="flex flex-col items-center justify-center py-20 text-center gap-6 bg-bg-elevated/30 rounded-3xl border-2 border-dashed border-white/10">
                    <span class="text-7xl opacity-50">🎧</span>
                    <div>
                        <h3 class="text-2xl font-bold mb-2">This playlist is empty</h3>
                        <p class="text-text-muted">Go back to the home page and add some songs!</p>
                    </div>
                    <a href="/" class="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-all">Find songs</a>
                </div>
            {/if}
        </div>
    {:else}
        <div class="flex flex-col items-center justify-center h-64 text-center">
            <p class="text-red-400 font-bold text-xl">Playlist not found</p>
            <a href="/" class="text-primary hover:underline mt-4">Go back Home</a>
        </div>
    {/if}
</div>
