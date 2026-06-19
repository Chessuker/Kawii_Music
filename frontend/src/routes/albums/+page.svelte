<script lang="ts">
    import { onMount } from 'svelte';

    let groupedData: any[] = $state([]);
    let isLoading = $state(true);
    let isLoadingMore = $state(false);
    let currentPage = $state(1);
    let hasMore = $state(true);
    let searchQuery = $state(''); 

    let searchTimeout: ReturnType<typeof setTimeout>;

    onMount(() => {
        loadAlbums(1);
    });

    async function loadAlbums(page: number) {
        if (page === 1) isLoading = true;
        else isLoadingMore = true;

        try {
            const url = `http://127.0.0.1:8787/api/albums/grouped?page=${page}&limit=15&search=${encodeURIComponent(searchQuery)}`;
            const res = await fetch(url);
            const result = await res.json();
            
            if (result.success) {
                if (page === 1) {
                    groupedData = result.data;
                } else {
                    groupedData = [...groupedData, ...result.data];
                }
                hasMore = result.hasMore;
                currentPage = page;

                if (result.data.length === 0 && result.hasMore) {
                    loadAlbums(page + 1);
                }
            }
        } catch (error) { 
            console.error(error); 
        }
        
        isLoading = false;
        isLoadingMore = false;
    }

    function handleLiveSearch() {
        clearTimeout(searchTimeout);
        isLoading = true;
        
        searchTimeout = setTimeout(() => {
            loadAlbums(1);
        }, 500);
    }

    function handleSearch(e: Event) {
        e.preventDefault();
        clearTimeout(searchTimeout); 
        loadAlbums(1); 
    }
</script>

<div class="flex flex-col gap-10">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
            <h1 class="text-5xl font-black tracking-tight mb-2">Albums</h1>
            <p class="text-text-muted font-medium">Browse through our curated collections</p>
        </div>
        
        <form onsubmit={handleSearch} class="w-full max-w-md relative group">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary">🔍</span>
            <input 
                type="text" 
                bind:value={searchQuery} 
                oninput={handleLiveSearch} 
                placeholder="Search albums or artists..." 
                class="w-full bg-bg-elevated border-none rounded-full py-3.5 pl-12 pr-6 text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-xl"
            />
        </form>
    </div>

    {#if isLoading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Searching library...</p>
        </div>
    {:else if groupedData.length === 0}
        <div class="flex flex-col items-center justify-center py-20 text-center gap-6 bg-bg-elevated/30 rounded-3xl border-2 border-dashed border-white/10">
            <span class="text-7xl opacity-50">👻</span>
            <div>
                <h3 class="text-2xl font-bold mb-2">No albums found for "{searchQuery}"</h3>
                <p class="text-text-muted">Try searching for a different keyword or artist.</p>
            </div>
        </div>
    {:else}
        {#each groupedData as artistGroup}
            <section class="mb-10">
                <div class="flex items-center gap-4 mb-6 border-b border-white/5 pb-4">
                    <div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-black text-xl font-black shadow-lg">🎤</div>
                    <h2 class="text-2xl font-black tracking-tight">{artistGroup.name}</h2>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {#each artistGroup.albums as album}
                        <a href="/albums/{album.id}" class="group bg-bg-elevated/40 hover:bg-bg-highlight p-4 rounded-xl transition-all duration-300 shadow-xl border border-white/5 relative">
                            <div class="aspect-square bg-bg-highlight rounded-lg overflow-hidden mb-4 shadow-2xl relative">
                                {#if album.imgUrl}
                                    <img src={album.imgUrl} alt={album.title} class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                {:else}
                                    <div class="w-full h-full flex items-center justify-center text-6xl">💿</div>
                                {/if}
                                <button class="absolute bottom-2 right-2 w-10 h-10 bg-primary rounded-full shadow-2xl flex items-center justify-center text-black opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-105 active:scale-95 z-10">
                                    <span class="text-xl ml-0.5">▶</span>
                                </button>
                            </div>
                            <div class="min-w-0">
                                <h3 class="font-bold text-sm truncate mb-1 text-white group-hover:text-primary transition-colors">{album.title}</h3>
                                <p class="text-text-muted text-[10px] font-black tracking-widest uppercase">Album</p>
                            </div>
                        </a>
                    {/each}
                </div>
            </section>
        {/each}

        {#if hasMore}
            <div class="flex justify-center mt-12 mb-10">
                <button 
                    onclick={() => loadAlbums(currentPage + 1)} 
                    disabled={isLoadingMore}
                    class="bg-white text-black px-10 py-3 rounded-full font-black hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                >
                    {isLoadingMore ? 'Loading...' : 'Show More'}
                </button>
            </div>
        {/if}
    {/if}
</div>
