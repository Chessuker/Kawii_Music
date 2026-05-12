<script lang="ts">
    import { playTrack } from '$lib/player.svelte';
    import { authState } from '$lib/auth.svelte';
    import { onMount } from 'svelte';

    // Track และ Metadata
    let tracks: any[] = $state([]);
    let availableArtists: any[] = $state([]);
    let availableGenres: any[] = $state([]);
    let availableAlbums: any[] = $state([]);
    let likedTrackIds: string[] = $state([]);

    // State สำหรับ Playlists
    let myPlaylists: any[] = $state([]);
    let newPlaylistName = $state('');
    let isCreating = $state(false);

    // Filter States
    let currentPage = $state(1);
    let totalPages = $state(1);
    let searchQuery = $state('');
    let filterArtist = $state('');
    let filterGenre = $state('');
    let filterAlbum = $state('');
    let isSearching = $state(false);

    let filteredSearchArtists = $derived.by(() => {
        const query = filterArtist.toLowerCase().trim();
        return availableArtists
            .filter(a => a.name.toLowerCase().includes(query))
            .sort((a, b) => {
                if (!query) return 0;
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aExact = aName === query;
                const bExact = bName === query;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                const aStarts = aName.startsWith(query);
                const bStarts = bName.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return 0;
            })
            .slice(0, 50);
    });
    let filteredSearchAlbums = $derived.by(() => {
        const query = filterAlbum.toLowerCase().trim();
        return availableAlbums
            .filter(a => a.title.toLowerCase().includes(query))
            .sort((a, b) => {
                if (!query) return 0;
                const aTitle = a.title.toLowerCase();
                const bTitle = b.title.toLowerCase();
                const aExact = aTitle === query;
                const bExact = bTitle === query;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                const aStarts = aTitle.startsWith(query);
                const bStarts = bTitle.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return 0;
            })
            .slice(0, 50);
    });
    let filteredSearchGenres = $derived.by(() => {
        const query = filterGenre.toLowerCase().trim();
        return availableGenres
            .filter(g => g.name.toLowerCase().includes(query))
            .sort((a, b) => {
                if (!query) return 0;
                const aName = g.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aExact = aName === query;
                const bExact = bName === query;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                const aStarts = aName.startsWith(query);
                const bStarts = bName.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return 0;
            })
            .slice(0, 50);
    });

    let recentHistory: any[] = $state([]);

    onMount(() => {
        loadMetadata();
        loadTracks(1);
    });

    async function loadMetadata() {
        try {
            const [metaRes, albumRes] = await Promise.all([
                fetch('http://127.0.0.1:8787/api/metadata'),
                fetch('http://127.0.0.1:8787/api/albums')
            ]);
            const metaData = await metaRes.json();
            const albumData = await albumRes.json();
            
            if (metaData.success) {
                availableArtists = metaData.artists;
                availableGenres = metaData.genres;
            }
            if (albumData.success) {
                availableAlbums = albumData.data;
            }
        } catch (e) { console.error(e); }
    }

    async function loadTracks(page = 1) {
        isSearching = true;
        currentPage = page;
        const queryParams = new URLSearchParams();
        queryParams.append('page', currentPage.toString());
        queryParams.append('limit', '30');
        if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());
        if (filterArtist) queryParams.append('artist', filterArtist);
        if (filterGenre) queryParams.append('genre', filterGenre);
        if (filterAlbum) queryParams.append('album', filterAlbum);

        try {
            const res = await fetch(`http://127.0.0.1:8787/api/tracks?${queryParams.toString()}`);
            const result = await res.json();
            if (result.success) {
                tracks = result.data;
                totalPages = result.pagination?.totalPages || 1;
            }
        } catch (error) {
            console.error(error);
        }
        isSearching = false;
    }

    function handleSearch(e: Event) {
        e.preventDefault();
        loadTracks(1);
    }

    $effect(() => {
        if (authState.currentUser?.id) {
            fetchPlaylists(authState.currentUser.id);
            fetchUserLikes(authState.currentUser.id);
            fetchHistory(authState.currentUser.id);
        } else {
            myPlaylists = []; 
            likedTrackIds = [];
            recentHistory = [];
        }
    });

    async function fetchHistory(userId: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/history`);
            const result = await res.json();
            if (result.success) recentHistory = result.data;
        } catch (error) {
            console.error(error);
        }
    }

    async function fetchUserLikes(userId: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/likes`);
            const result = await res.json();
            if (result.success) likedTrackIds = result.data;
        } catch (error) {
            console.error(error);
        }
    }

    async function toggleLike(trackId: string) {
        if (!authState.currentUser) {
            alert('กรุณาเข้าสู่ระบบเพื่อกดถูกใจเพลง 🎵');
            return;
        }
        
        // ⚡ Optimistic UI: อัปเดตหน้าจอก่อนเลยทันที เพื่อความลื่นไหล
        const isCurrentlyLiked = likedTrackIds.includes(trackId);
        if (isCurrentlyLiked) {
            likedTrackIds = likedTrackIds.filter(id => id !== trackId);
        } else {
            likedTrackIds = [...likedTrackIds, trackId];
        }
        
        try {
            // ยิง API แบบ Background
            await fetch(`http://127.0.0.1:8787/api/tracks/${trackId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authState.currentUser.id })
            });
            // (ถ้าต้องการความชัวร์ 100% อาจจะเช็ก result คืนมา ถ้า Error ค่อย Rollback ตัวแปรกลับ)
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    }

    async function fetchPlaylists(userId: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/playlists`);
            const result = await res.json();
            if (result.success) myPlaylists = result.data;
        } catch (e) { console.error(e); }
    }

    async function createPlaylist() {
        if (!newPlaylistName.trim() || !authState.currentUser) return;
        isCreating = true;
        
        try {
            const res = await fetch('http://127.0.0.1:8787/api/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newPlaylistName, userId: authState.currentUser.id })
            });
            const result = await res.json();
            if (result.success) {
                newPlaylistName = '';
                fetchPlaylists(authState.currentUser.id);
            }
        } catch (error) {
            alert('สร้างไม่ได้ ลองใหม่อีกครั้ง');
        }
        isCreating = false;
    }

    async function addToPlaylist(playlistId: string, trackId: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId })
            });
            const result = await res.json();
            if (result.success) {
                alert('✅ เพิ่มลงเพลย์ลิสต์แล้ว!');
            } else {
                alert('❌ ' + result.error);
            }
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    }
</script>

<div class="max-w-6xl mx-auto flex flex-col gap-10">
    <!-- Hero / Welcome -->
    <section>
        <h1 class="text-4xl font-black mb-6 tracking-tight">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
        </h1>
        
        {#if authState.currentUser}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <a href="/favorites" class="group flex items-center bg-white/10 hover:bg-white/20 transition-colors rounded overflow-hidden">
                    <div class="w-20 h-20 bg-gradient-to-br from-indigo-700 to-purple-400 flex items-center justify-center text-3xl shadow-lg">💜</div>
                    <span class="px-4 font-bold">Liked Songs</span>
                </a>
                <a href="/albums" class="group flex items-center bg-white/10 hover:bg-white/20 transition-colors rounded overflow-hidden">
                    <div class="w-20 h-20 bg-gradient-to-br from-orange-600 to-red-400 flex items-center justify-center text-3xl shadow-lg">💿</div>
                    <span class="px-4 font-bold">All Albums</span>
                </a>
                {#each myPlaylists.slice(0, 4) as pl}
                    <a href="/playlist/{pl.id}" class="group flex items-center bg-white/10 hover:bg-white/20 transition-colors rounded overflow-hidden">
                        <div class="w-20 h-20 bg-bg-highlight flex items-center justify-center text-3xl shadow-lg">🎵</div>
                        <span class="px-4 font-bold truncate">{pl.name}</span>
                    </a>
                {/each}
            </div>
        {/if}
    </section>

    <!-- Recently Played -->
    {#if recentHistory.length > 0}
        <section>
            <div class="flex items-center justify-between mb-4">
                <a href="/recently-played">
                    <h2 class="text-2xl font-bold hover:underline cursor-pointer">Recently Played</h2>
                </a>
                <a href="/recently-played" class="text-text-muted text-sm font-bold hover:underline">Show all</a>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {#each recentHistory.slice(0, 6) as track}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div 
                        onclick={() => playTrack(track, recentHistory)}
                        class="bg-bg-elevated hover:bg-bg-highlight p-4 rounded-lg transition-all duration-300 cursor-pointer group shadow-xl"
                    >
                        <div class="relative aspect-square mb-4 shadow-2xl overflow-hidden rounded-md">
                            <div class="w-full h-full bg-gradient-to-br from-primary to-indigo-900 flex items-center justify-center text-4xl">
                                🎵
                            </div>
                            <button class="absolute bottom-2 right-2 w-12 h-12 bg-primary rounded-full shadow-2xl flex items-center justify-center text-black opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-105 active:scale-95">
                                <span class="text-2xl ml-1">▶</span>
                            </button>
                        </div>
                        <h4 class="font-bold truncate text-sm mb-1">{track.title}</h4>
                        <p class="text-text-muted text-xs truncate">By {track.artists?.[0]?.name || 'Unknown'}</p>
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <!-- Search & Filters -->
    <section class="bg-bg-elevated p-6 rounded-xl shadow-2xl border border-white/5">
        <h2 class="text-xl font-bold mb-6">Search Library</h2>
        <form onsubmit={handleSearch} class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div class="relative">
                <input 
                    type="text" 
                    bind:value={searchQuery} 
                    placeholder="Search titles..." 
                    class="w-full bg-bg-highlight border-none rounded-full py-3 px-12 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                />
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
            </div>
            
            <div class="relative">
                <input list="user-artist-list" bind:value={filterArtist} placeholder="Artist" class="w-full bg-bg-highlight border-none rounded-full py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                <datalist id="user-artist-list">
                    {#each filteredSearchArtists as artist}<option value={artist.name}></option>{/each}
                </datalist>
            </div>

            <div class="relative">
                <input list="user-album-list" bind:value={filterAlbum} placeholder="Album" class="w-full bg-bg-highlight border-none rounded-full py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                <datalist id="user-album-list">
                    {#each filteredSearchAlbums as album}<option value={album.title}></option>{/each}
                </datalist>
            </div>

            <div class="relative">
                <input list="user-genre-list" bind:value={filterGenre} placeholder="Genre" class="w-full bg-bg-highlight border-none rounded-full py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                <datalist id="user-genre-list">
                    {#each filteredSearchGenres as genre}<option value={genre.name}></option>{/each}
                </datalist>
            </div>

            <button type="submit" disabled={isSearching} class="bg-primary hover:bg-primary-hover text-black font-bold py-3 rounded-full transition-all disabled:opacity-50">
                {isSearching ? 'Searching...' : 'Search'}
            </button>
        </form>
    </section>

    <!-- Track List -->
    <section>
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold">Recommended for you</h2>
        </div>

        <div class="bg-bg-elevated/50 rounded-xl overflow-hidden border border-white/5">
            <div class="grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-3 text-xs font-bold text-text-muted border-b border-white/10 uppercase tracking-widest">
                <div class="w-10">#</div>
                <div>Title</div>
                <div class="pr-4">Action</div>
            </div>

            <div class="flex flex-col">
                {#each tracks as track, i}
                    <div class="group grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-3 items-center hover:bg-white/10 transition-colors rounded-md mx-2 my-1">
                        <div class="w-10 text-text-muted text-sm font-medium group-hover:hidden">{i + 1}</div>
                        <button onclick={() => playTrack(track, tracks)} class="w-10 text-white text-sm hidden group-hover:block">▶</button>
                        
                        <div class="flex items-center gap-4 min-w-0">
                            <div class="w-10 h-10 bg-bg-highlight rounded overflow-hidden shrink-0">
                                {#if track.album?.imgUrl || track.album?.img_url}
                                    <img src={track.album.imgUrl || track.album.img_url} alt="" class="w-full h-full object-cover" />
                                {:else}
                                    <div class="w-full h-full flex items-center justify-center text-xs">🎵</div>
                                {/if}
                            </div>
                            <div class="min-w-0">
                                <div class="font-bold text-white text-sm truncate">{track.title}</div>
                                <div class="text-text-muted text-xs truncate hover:underline cursor-pointer">
                                    {track.artists?.map((a:any) => a.name).join(', ') || 'Unknown'}
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-4">
                            <button 
                                onclick={() => toggleLike(track.id)}
                                class="text-xl transition-transform hover:scale-120 active:scale-90"
                            >
                                {likedTrackIds.includes(track.id) ? '💜' : '🤍'}
                            </button>

                            {#if myPlaylists.length > 0}
                                <select 
                                    onchange={(e) => {
                                        if(e.currentTarget.value) {
                                            addToPlaylist(e.currentTarget.value, track.id);
                                            e.currentTarget.value = ""; 
                                        }
                                    }}
                                    class="bg-bg-highlight text-xs border-none rounded-full px-3 py-1 text-text-muted focus:ring-1 focus:ring-primary outline-none"
                                >
                                    <option value="" disabled selected>+ Add to</option>
                                    {#each myPlaylists as pl}
                                        <option value={pl.id}>{pl.name}</option>
                                    {/each}
                                </select>
                            {/if}
                            
                            <span class="text-xs text-text-muted w-12 text-right">{track.duration}</span>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
        
        <!-- Pagination -->
        <div class="flex justify-center gap-4 items-center mt-10">
            <button
                disabled={currentPage === 1}
                onclick={() => loadTracks(currentPage - 1)}
                class="px-6 py-2 bg-bg-highlight hover:bg-bg-elevated border border-white/10 rounded-full font-bold transition-all disabled:opacity-30"
            >Previous</button>
            <span class="text-sm font-bold text-text-muted">Page {currentPage} of {totalPages}</span>
            <button
                disabled={currentPage === totalPages}
                onclick={() => loadTracks(currentPage + 1)}
                class="px-6 py-2 bg-bg-highlight hover:bg-bg-elevated border border-white/10 rounded-full font-bold transition-all disabled:opacity-30"
            >Next</button>
        </div>
    </section>

    <!-- Create Playlist (Floating at bottom if needed, or inline) -->
    {#if authState.currentUser}
        <section class="bg-gradient-to-r from-purple-900/40 to-black p-8 rounded-2xl border border-white/5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
                <h2 class="text-2xl font-black mb-2">Create your own playlist</h2>
                <p class="text-text-muted">Curate the perfect mood for your next session.</p>
            </div>
            <div class="flex gap-4 w-full md:w-auto">
                <input type="text" bind:value={newPlaylistName} placeholder="My Awesome Playlist" class="flex-1 md:w-64 bg-bg-highlight border-none rounded-full py-3 px-6 text-sm outline-none" />
                <button onclick={createPlaylist} disabled={isCreating} class="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 active:scale-100 transition-transform">
                    {isCreating ? 'Creating...' : 'Create'}
                </button>
            </div>
        </section>
    {/if}
</div>
