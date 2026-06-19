<script lang="ts">
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { playTrack } from '$lib/player.svelte';

    let albumData: any = $state(null);
    let tracks: any[] = $state([]);
    let isLoading = $state(true);

    onMount(async () => {
        const id = page.params.id;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/albums/${id}`);
            const data = await res.json();
            if (data.success) {
                albumData = data.album;
                tracks = data.tracks;
            }
        } catch (error) { console.error(error); }
        isLoading = false;
    });
</script>

<div class="flex flex-col gap-8">
    <a href="/albums" class="text-text-muted hover:text-white font-bold text-sm flex items-center gap-2 transition-colors">
        <span>&lsaquo;</span> Back to Albums
    </a>

    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading album...</p>
        </div>
    {:else if albumData}
        <div class="flex flex-col md:flex-row items-end gap-8 bg-gradient-to-t from-bg-surface/50 to-bg-highlight/40 p-10 rounded-3xl border border-white/5 shadow-2xl">
            <div class="w-64 h-64 bg-bg-highlight rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] shrink-0 overflow-hidden">
                {#if albumData.imgUrl || albumData.img_url}
                    <img src={albumData.imgUrl || albumData.img_url} alt="Cover" class="w-full h-full object-cover" />
                {:else}
                    <div class="w-full h-full flex items-center justify-center text-8xl">💿</div>
                {/if}
            </div>
            <div class="flex flex-col gap-2">
                <p class="text-xs font-black uppercase tracking-[0.2em]">Album</p>
                <h1 class="text-5xl md:text-7xl font-black tracking-tight mb-4">{albumData.title}</h1>
                <div class="flex items-center gap-2 text-sm font-bold">
                    <span class="text-primary">{albumData.artists?.map((a:any) => a.name).join(', ') || 'Unknown Artist'}</span>
                    <span class="text-text-muted">• {tracks.length} tracks</span>
                </div>
                <div class="mt-6">
                    <button 
                        onclick={() => playTrack(tracks[0], tracks)}
                        class="bg-primary hover:bg-primary-hover text-black px-10 py-3 rounded-full font-black text-lg transition-all hover:scale-105 active:scale-95 shadow-xl"
                    >
                        ▶ Play
                    </button>
                </div>
            </div>
        </div>

        <div class="px-2">
            <div class="bg-bg-elevated/30 rounded-2xl border border-white/5 overflow-hidden">
                <div class="grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-4 text-xs font-bold text-text-muted border-b border-white/10 uppercase tracking-widest">
                    <div class="w-10">#</div>
                    <div>Title</div>
                    <div class="pr-8">Duration</div>
                </div>

                <div class="flex flex-col py-2">
                    {#each tracks as track, i}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div 
                            class="group grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-3 items-center hover:bg-white/10 transition-colors rounded-md mx-2 cursor-pointer"
                            onclick={() => playTrack(track, tracks)}
                        >
                            <div class="w-10 text-text-muted text-sm group-hover:hidden">{i + 1}</div>
                            <button class="w-10 text-white text-sm hidden group-hover:block text-left">▶</button>
                            
                            <div class="min-w-0">
                                <div class="font-bold text-white text-base truncate">{track.title}</div>
                                <div class="text-text-muted text-sm truncate">
                                    {track.artists?.map((a:any) => a.name).join(', ') || 'Unknown'}
                                </div>
                            </div>
                            
                            <span class="text-sm text-text-muted w-12 text-right">{track.duration}</span>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>
