<script lang="ts">
    import { page } from '$app/state'; // SvelteKit 2+ ดึง ID จาก URL
    import { onMount } from 'svelte';
    import { playTrack } from '$lib/player.svelte';

    let albumData: any = $state(null);
    let tracks: any[] = $state([]);
    let isLoading = $state(true);

    onMount(async () => {
        const id = page.params.id; // ดึง ID จาก URL
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

<main style="max-width: 1000px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
    <a href="/albums" style="color: #1db954; text-decoration: none; font-weight: bold;">← กลับไปหน้าอัลบั้ม</a>

    {#if isLoading}
        <p style="text-align: center; margin-top: 50px;">กำลังโหลดเพลงในอัลบั้ม...</p>
    {:else if albumData}
        <div style="display: flex; gap: 40px; align-items: flex-end; margin: 40px 0; background: linear-gradient(to bottom, #333, #121212); padding: 40px; border-radius: 15px; color: white;">
            <div style="width: 230px; height: 230px; background: #282828; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                {#if albumData.imgUrl || albumData.img_url}
                    <img src={albumData.imgUrl || albumData.img_url} alt="Cover" style="width: 100%; height: 100%; object-fit: cover;" />
                {:else}
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 6em;">💿</div>
                {/if}
            </div>
            <div>
                <p style="margin: 0; font-weight: bold; text-transform: uppercase; font-size: 0.8em; letter-spacing: 1px;">ALBUM</p>
                <h1 style="margin: 10px 0; font-size: 4em;">{albumData.title}</h1>
                <p style="margin: 0; opacity: 0.8; font-size: 1.1em; font-weight: bold;">
                    {albumData.artists && albumData.artists.length > 0 ? albumData.artists.map(a => a.name).join(', ') : 'Unknown Artist'}
                </p>
                <p style="margin: 10px 0 0 0; opacity: 0.8;">{tracks.length} เพลงในอัลบั้มนี้</p>
                <button onclick={() => playTrack(tracks[0], tracks)} style="margin-top: 25px; padding: 15px 40px; background: #1db954; color: white; border: none; border-radius: 50px; font-weight: bold; font-size: 1.1em; cursor: pointer;">▶ เล่นทั้งหมด</button>
            </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
            {#each tracks as track, i}
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 6px; transition: background 0.2s; cursor: pointer;" onmouseover={(e) => e.currentTarget.style.background = '#f1f1f1'} onmouseout={(e) => e.currentTarget.style.background = 'transparent'} onclick={() => playTrack(track, tracks)}>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <span style="color: #888; width: 20px;">{i + 1}</span>
                        <div>
                            <p style="margin: 0; font-weight: bold;">{track.title}</p>
                            <p style="margin: 3px 0 0 0; font-size: 0.85em; color: #666;">{track.artists?.map((a:any) => a.name).join(', ') || 'Unknown Artist'}</p>
                        </div>
                    </div>
                    <span style="color: #888; font-size: 0.9em;">{track.duration}</span>
                </div>
            {/each}
        </div>
    {/if}
</main>