<script lang="ts">
    import { authState } from '$lib/auth.svelte';

    let followedArtists: any[] = $state([]);
    let loading = $state(true);
    let error: string | null = $state(null);

    $effect(() => {
        if (authState.currentUser?.id) {
            fetchFollows(authState.currentUser.id);
        } else if (authState.currentUser === null) {
            loading = false;
            error = "Please log in to see artists you follow";
        }
    });

    async function fetchFollows(userId: string) {
        try {
            loading = true;
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/follows`);
            const data = await res.json();
            if (data.success) {
                followedArtists = data.data;
            } else {
                error = data.error;
            }
        } catch (err: any) {
            error = "Unable to connect to server";
        } finally {
            loading = false;
        }
    }

    async function handleUnfollow(e: Event, artistId: string) {
        e.preventDefault();
        if (!authState.currentUser) return;
        
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/artists/${artistId}/follow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authState.currentUser.id })
            });
            const data = await res.json();
            
            if (data.success && !data.followed) {
                followedArtists = followedArtists.filter(a => a.id !== artistId);
            }
        } catch (err: any) { console.error("Unfollow error:", err.message); }
    }
</script>

<div class="flex flex-col gap-10">
    <div>
        <h1 class="text-5xl font-black tracking-tight mb-2">Following</h1>
        <p class="text-text-muted font-medium">Never miss an update from these creators</p>
    </div>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading your artists...</p>
        </div>
    {:else if error}
        <div class="flex flex-col items-center justify-center h-[40vh] text-center gap-6 bg-bg-elevated/30 rounded-3xl border border-white/5">
            <p class="text-xl font-bold text-text-muted">{error}</p>
            {#if error.includes('log in')}
                <a href="/login" class="bg-primary text-black px-8 py-3 rounded-full font-black hover:scale-105 transition-all">Log In</a>
            {/if}
        </div>
    {:else if followedArtists.length === 0}
        <div class="flex flex-col items-center justify-center py-20 text-center gap-6 bg-bg-elevated/30 rounded-3xl border-2 border-dashed border-white/10">
            <span class="text-7xl opacity-50">👻</span>
            <div>
                <h3 class="text-2xl font-bold mb-2">You aren't following anyone yet</h3>
                <p class="text-text-muted">Explore artists to fill up your library.</p>
            </div>
            <a href="/artists" class="bg-primary text-black px-8 py-3 rounded-full font-black hover:scale-105 transition-all">Browse Artists</a>
        </div>
    {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
            {#each followedArtists as artist}
                <div class="group flex flex-col items-center bg-bg-elevated/40 hover:bg-bg-highlight p-6 rounded-2xl transition-all duration-300 shadow-xl border border-white/5">
                    <a href="/artists/{artist.id}" class="flex flex-col items-center gap-4 w-full">
                        <div class="relative w-32 h-32 md:w-40 md:h-40 shrink-0">
                            <div class="w-full h-full bg-gradient-to-br from-primary to-indigo-900 rounded-full flex items-center justify-center text-5xl font-black shadow-2xl group-hover:scale-105 transition-transform duration-500">
                                {artist.name.charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div class="text-center w-full min-w-0">
                            <h3 class="font-black text-lg truncate mb-1 group-hover:text-primary transition-colors">{artist.name}</h3>
                            <p class="text-text-muted text-xs uppercase tracking-widest font-bold">Artist</p>
                        </div>
                    </a>
                    
                    <button 
                        onclick={(e) => handleUnfollow(e, artist.id)}
                        class="w-full mt-6 py-2 rounded-full font-black text-xs transition-all bg-primary border-2 border-primary text-black hover:bg-red-500 hover:border-red-500 hover:text-white group/btn"
                    >
                        <span class="group-hover/btn:hidden">FOLLOWING</span>
                        <span class="hidden group-hover/btn:inline">UNFOLLOW</span>
                    </button>
                </div>
            {/each}
        </div>
    {/if}
</div>
