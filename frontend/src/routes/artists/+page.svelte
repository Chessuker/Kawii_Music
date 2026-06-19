<script lang="ts">
    import { onMount } from 'svelte';
    import { authState } from '$lib/auth.svelte';

    let artists: any[] = $state([]);
    let isLoading = $state(true);
    let isLoadingMore = $state(false);
    let currentPage = $state(1);
    let hasMore = $state(true);
    let searchQuery = $state('');
    let searchTimeout: ReturnType<typeof setTimeout>;

    let followedArtistIds: string[] = $state([]);

    onMount(() => {
        loadArtists(1);
    });

    $effect(() => {
        if (authState.currentUser?.id) {
            fetchFollows(authState.currentUser.id);
        } else {
            followedArtistIds = [];
        }
    });

    async function fetchFollows(userId: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/follows`);
            const data = await res.json();
            if (data.success) {
                followedArtistIds = data.data.map((a: any) => a.id);
            }
        } catch (err) { console.error(err); }
    }

    async function toggleFollow(artistId: string) {
        if (!authState.currentUser) {
            alert('Please log in to follow artists 🎵');
            return;
        }
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/artists/${artistId}/follow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authState.currentUser.id })
            });
            const data = await res.json();
            
            if (data.success) {
                if (data.followed) {
                    followedArtistIds = [...followedArtistIds, artistId];
                } else {
                    followedArtistIds = followedArtistIds.filter(id => id !== artistId);
                }
            }
        } catch (err) { console.error(err); }
    }

    async function loadArtists(page: number) {
        if (page === 1) isLoading = true;
        else isLoadingMore = true;
        try {
            const url = `http://127.0.0.1:8787/api/artists/browse?page=${page}&limit=30&search=${encodeURIComponent(searchQuery)}`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.success) {
                if (page === 1) artists = result.data;
                else artists = [...artists, ...result.data];
                hasMore = result.hasMore;
                currentPage = page;
            }
        } catch (error) { console.error(error); }
        isLoading = false;
        isLoadingMore = false;
    }

    function handleLiveSearch() {
        clearTimeout(searchTimeout);
        isLoading = true;
        searchTimeout = setTimeout(() => { loadArtists(1); }, 500);
    }

    function handleSearch(e: Event) {
        e.preventDefault();
        clearTimeout(searchTimeout);
        loadArtists(1);
    }
</script>

<div class="flex flex-col gap-10">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
            <h1 class="text-5xl font-black tracking-tight mb-2">Artists</h1>
            <p class="text-text-muted font-medium">Discover your next favorite creator</p>
        </div>
        
        <form onsubmit={handleSearch} class="w-full max-w-md relative group">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary">🔍</span>
            <input 
                type="text" 
                bind:value={searchQuery} 
                oninput={handleLiveSearch} 
                placeholder="Search artists..." 
                class="w-full bg-bg-elevated border-none rounded-full py-3.5 pl-12 pr-6 text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-xl"
            />
        </form>
    </div>

    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading artists...</p>
        </div>
    {:else if artists.length === 0}
        <div class="flex flex-col items-center justify-center py-20 text-center gap-6 bg-bg-elevated/30 rounded-3xl border-2 border-dashed border-white/10">
            <span class="text-7xl opacity-50">👻</span>
            <div>
                <h3 class="text-2xl font-bold mb-2">No artists found</h3>
                <p class="text-text-muted">Try a different search term.</p>
            </div>
        </div>
    {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
            {#each artists as artist}
                <div class="group flex flex-col items-center bg-bg-elevated/40 hover:bg-bg-highlight p-6 rounded-2xl transition-all duration-300 shadow-xl border border-white/5">
                    <a href={`/artists/${artist.id}`} class="flex flex-col items-center gap-4 w-full">
                        <div class="relative w-32 h-32 md:w-40 md:h-40 shrink-0">
                            <div class="w-full h-full bg-gradient-to-br from-primary to-indigo-900 rounded-full flex items-center justify-center text-5xl font-black shadow-2xl group-hover:scale-105 transition-transform duration-500">
                                {artist.name.charAt(0).toUpperCase()}
                            </div>
                            <button class="absolute bottom-1 right-1 w-10 h-10 bg-primary rounded-full shadow-2xl flex items-center justify-center text-black opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-110 active:scale-95 z-10">
                                <span class="text-xl ml-0.5">▶</span>
                            </button>
                        </div>
                        
                        <div class="text-center w-full min-w-0">
                            <h3 class="font-black text-lg truncate mb-1 group-hover:text-primary transition-colors">{artist.name}</h3>
                            <p class="text-text-muted text-xs uppercase tracking-widest font-bold">Artist</p>
                        </div>
                    </a>
                    
                    <button 
                        onclick={() => toggleFollow(artist.id)}
                        class="w-full mt-6 py-2 rounded-full font-black text-xs transition-all border-2 {followedArtistIds.includes(artist.id) ? 'bg-primary border-primary text-black' : 'bg-transparent border-white/20 text-white hover:border-primary hover:text-primary'}"
                    >
                        {followedArtistIds.includes(artist.id) ? 'FOLLOWING' : 'FOLLOW'}
                    </button>
                </div>
            {/each}
        </div>

        {#if hasMore}
            <div class="flex justify-center mt-12 mb-10">
                <button 
                    onclick={() => loadArtists(currentPage + 1)} 
                    disabled={isLoadingMore}
                    class="bg-white text-black px-10 py-3 rounded-full font-black hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                >
                    {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
            </div>
        {/if}
    {/if}
</div>
