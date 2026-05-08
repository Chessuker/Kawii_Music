<script lang="ts">
    import { page } from '$app/stores';
    import { playTrack } from '$lib/player.svelte';
    
    let playlist: any = $state(null);
    let tracks: any[] = $state([]);
    let isLoading = $state(true);

    // ดึงข้อมูลเมื่อ ID ใน URL เปลี่ยนแปลง
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

    // ฟังก์ชันเล่นเพลงทั้งหมดในเพลย์ลิสต์ (เอาเพลงแรกเล่นก่อน และส่งทั้ง array เข้า queue)
    function playAll() {
        if (tracks.length > 0) {
            playTrack(tracks[0], tracks);
        }
    }
</script>

<main style="max-width: 800px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
    <a href="/" style="color: #1db954; text-decoration: none; font-weight: bold;">← กลับหน้าแรก</a>

    {#if isLoading}
        <p style="text-align: center; margin-top: 50px;">กำลังโหลดเพลย์ลิสต์...</p>
    {:else if playlist}
        
        <!-- Header ของเพลย์ลิสต์ -->
        <div style="display: flex; align-items: center; gap: 30px; margin-top: 30px; margin-bottom: 40px;">
            <div style="width: 150px; height: 150px; background: #282828; display: flex; justify-content: center; align-items: center; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <span style="font-size: 4em;">🎵</span>
            </div>
            <div>
                <p style="margin: 0; font-size: 0.9em; text-transform: uppercase; letter-spacing: 2px; color: #666;">Playlist</p>
                <h1 style="margin: 5px 0; font-size: 3.5em;">{playlist.name}</h1>
                <p style="margin: 5px 0 0 0; color: #666;">มีทั้งหมด {tracks.length} เพลง</p>
                
                {#if tracks.length > 0}
                    <button 
                        onclick={playAll}
                        style="margin-top: 20px; padding: 12px 30px; background: #1db954; color: white; border: none; border-radius: 50px; font-size: 1.1em; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(29, 185, 84, 0.4);"
                    >
                        ▶ เล่นทั้งหมด
                    </button>
                {/if}
            </div>
        </div>

        <!-- รายการเพลง -->
        {#if tracks.length > 0}
            <div style="display: flex; flex-direction: column; gap: 10px;">
                {#each tracks as track, index}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div 
                        onclick={() => playTrack(track, tracks)}
                        style="display: flex; align-items: center; padding: 15px; border-radius: 8px; cursor: pointer; transition: background 0.2s;"
                        onmouseover={(e) => e.currentTarget.style.background = '#f4f4f4'}
                        onmouseout={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style="width: 30px; color: #aaa; text-align: right; margin-right: 20px;">{index + 1}</div>
                        <div style="flex-grow: 1;">
                            <p style="margin: 0; font-weight: bold; font-size: 1.1em;">{track.title}</p>
                        </div>
                        <div style="color: #666; font-size: 0.9em;">
                            {track.duration}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div style="text-align: center; padding: 50px; background: #f9f9f9; border-radius: 8px; color: #888;">
                ยังไม่มีเพลงในเพลย์ลิสต์นี้ <br>กลับไปหน้าแรกเพื่อเพิ่มเพลงเลย!
            </div>
        {/if}
        
    {:else}
        <p style="text-align: center; margin-top: 50px; color: red;">ไม่พบข้อมูลเพลย์ลิสต์</p>
    {/if}
</main>