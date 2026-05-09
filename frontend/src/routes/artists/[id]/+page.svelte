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

<main style="max-width: 1000px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
    <a href="/artists" style="color: #1db954; text-decoration: none; font-weight: bold;">← กลับไปหน้าศิลปิน</a>

    {#if loading}
        <p style="text-align: center; margin-top: 50px;">กำลังโหลดข้อมูล...</p>
    {:else if artist}
        <div style="display: flex; gap: 40px; align-items: center; margin: 40px 0; background: linear-gradient(135deg, #111, #282828); padding: 40px; border-radius: 15px; color: white;">
            <div style="width: 200px; height: 200px; background: linear-gradient(135deg, #1db954, #1976d2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 5em; font-weight: bold; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                {artist.name.charAt(0).toUpperCase()}
            </div>
            <div>
                <p style="margin: 0; font-weight: bold; text-transform: uppercase; font-size: 0.9em; letter-spacing: 2px; color: #1db954;">Artist</p>
                <h1 style="margin: 10px 0; font-size: 4em;">{artist.name}</h1>
                
                <div style="display: flex; gap: 15px; margin-top: 25px;">
                    <button onclick={() => tracks.length > 0 && playTrack(tracks[0], tracks)} style="padding: 12px 35px; background: #1db954; color: white; border: none; border-radius: 50px; font-weight: bold; font-size: 1.1em; cursor: pointer; {tracks.length === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">▶ เล่นเพลง</button>
                    <button onclick={toggleFollow} style="padding: 12px 35px; border: 2px solid #fff; color: {isFollowing ? '#000' : '#fff'}; background: {isFollowing ? '#fff' : 'transparent'}; border-radius: 50px; font-weight: bold; font-size: 1.1em; cursor: pointer; transition: all 0.2s;">
                        {isFollowing ? '✓ กำลังติดตาม' : 'ติดตาม'}
                    </button>
                </div>
            </div>
        </div>

        {#if albums.length > 0}
            <h2 style="margin-top: 50px;">💿 อัลบั้มของ {artist.name}</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; margin-bottom: 50px;">
                {#each albums as album}
                    <a href="/albums/{album.id}" style="text-decoration: none; color: inherit; display: block;">
                        <div style="background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #eee; transition: transform 0.2s;" onmouseover={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onmouseout={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                            <div style="aspect-ratio: 1/1; background: #eee; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                {#if album.imgUrl}
                                    <img src={album.imgUrl} alt={album.title} style="width: 100%; height: 100%; object-fit: cover;" />
                                {:else}
                                    <span style="font-size: 4em;">💿</span>
                                {/if}
                            </div>
                            <div style="padding: 15px;">
                                <h3 style="margin: 0; font-size: 1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{album.title}</h3>
                            </div>
                        </div>
                    </a>
                {/each}
            </div>
        {/if}

        {#if tracks.length > 0}
            <h2>🎵 เพลงฮิต</h2>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                {#each tracks as track, i}
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 6px; transition: background 0.2s; cursor: pointer; background: #fff; border: 1px solid #f0f0f0;" onmouseover={(e) => e.currentTarget.style.background = '#f9f9f9'} onmouseout={(e) => e.currentTarget.style.background = '#fff'} onclick={() => playTrack(track, tracks)}>
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <span style="color: #888; width: 20px; font-weight: bold;">{i + 1}</span>
                            <div>
                                <p style="margin: 0; font-weight: bold; color: #333;">{track.title}</p>
                                <p style="margin: 3px 0 0 0; font-size: 0.85em; color: #888;">ยอดวิว: {track.viewCount || 0}</p>
                            </div>
                        </div>
                        <span style="color: #888; font-size: 0.9em;">{track.duration}</span>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</main>