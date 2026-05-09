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
            alert('กรุณาเข้าสู่ระบบเพื่อติดตามศิลปิน 🎵');
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

<main style="max-width: 1200px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; margin-bottom: 40px;">
        <h1 style="color: #333; margin: 0; font-size: 2.5em;">🎤 ศิลปินทั้งหมด</h1>
        
        <form onsubmit={handleSearch} style="display: flex; gap: 10px; width: 100%; max-width: 450px;">
            <input 
                type="text" 
                bind:value={searchQuery} 
                oninput={handleLiveSearch} 
                placeholder="🔍 ค้นหาชื่อศิลปิน..." 
                style="flex: 1; padding: 12px 20px; border: 1px solid #ccc; border-radius: 50px; outline: none; font-size: 1em; transition: border 0.2s;" 
                onfocus={(e) => e.currentTarget.style.borderColor = '#1db954'}
                onblur={(e) => e.currentTarget.style.borderColor = '#ccc'}
            />
        </form>
    </div>

    {#if isLoading}
        <div style="text-align: center; padding: 50px; color: #888;">
            <p style="font-size: 1.2em;">⏳ กำลังโหลดศิลปิน...</p>
        </div>
    {:else if artists.length === 0}
        <div style="text-align: center; padding: 50px; color: #888; background: #fff; border-radius: 12px; border: 1px dashed #ccc;">
            <span style="font-size: 4em;">👻</span>
            <p style="font-size: 1.2em; margin-top: 15px;">ไม่พบศิลปินที่คุณค้นหา</p>
        </div>
    {:else}
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 30px;">
            {#each artists as artist}
                <div style="background: #fff; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eee; transition: transform 0.2s;" onmouseover={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onmouseout={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <a href={`/artists/${artist.id}`} style="text-decoration: none; color: inherit; display: block;">
                        <div style="width: 100px; height: 100px; background: linear-gradient(135deg, #1db954, #1976d2); border-radius: 50%; margin: 0 auto 15px auto; display: flex; align-items: center; justify-content: center; color: white; font-size: 2.5em; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                            {artist.name.charAt(0).toUpperCase()}
                        </div>
                        
                        <h3 style="margin: 0 0 15px 0; font-size: 1.1em; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title={artist.name}>
                            {artist.name}
                        </h3>
                    </a>
                    
                    <button 
                        onclick={() => toggleFollow(artist.id)}
                        style="width: 100%; padding: 10px 0; border-radius: 50px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 2px solid #1db954; font-size: 0.9em; {followedArtistIds.includes(artist.id) ? 'background: #1db954; color: white;' : 'background: transparent; color: #1db954;'}"
                    >
                        {followedArtistIds.includes(artist.id) ? '✓ Following' : '+ Follow'}
                    </button>
                </div>
            {/each}
        </div>

        {#if hasMore}
            <div style="text-align: center; margin-top: 40px; margin-bottom: 60px;">
                <button 
                    onclick={() => loadArtists(currentPage + 1)} 
                    disabled={isLoadingMore}
                    style="padding: 12px 30px; background: #333; color: white; border: none; border-radius: 50px; font-weight: bold; cursor: pointer; transition: background 0.2s;"
                    onmouseover={(e) => e.currentTarget.style.background = '#555'} 
                    onmouseout={(e) => e.currentTarget.style.background = '#333'}
                >
                    {isLoadingMore ? '⏳ กำลังโหลด...' : '👇 โหลดศิลปินเพิ่มเติม'}
                </button>
            </div>
        {/if}
    {/if}
</main>