<script lang="ts">
    import { authState } from '$lib/auth.svelte';
    import { playTrack } from '$lib/player.svelte';
    
    let favoriteTracks: any[] = $state([]);
    let isLoading = $state(true);

    // ดึงข้อมูลเมื่อผู้ใช้ล็อกอิน
    $effect(() => {
        if (authState.currentUser?.id) {
            fetchFavorites(authState.currentUser.id);
        } else {
            favoriteTracks = [];
            isLoading = false;
        }
    });

    async function fetchFavorites(userId: string) {
        isLoading = true;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/favorites`);
            const data = await res.json();
            if (data.success) {
                favoriteTracks = data.data;
            }
        } catch (error) {
            console.error(error);
        }
        isLoading = false;
    }

    async function toggleLike(trackId: string) {
        if (!authState.currentUser) return;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/tracks/${trackId}/like`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authState.currentUser.id })
            });
            const result = await res.json();
            
            if (result.success && !result.liked) {
                // อัปเดต UI ทันที: ลบเพลงออกจากลิสต์ถ้ากดยกเลิกถูกใจ
                favoriteTracks = favoriteTracks.filter(t => t.id !== trackId);
            }
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    }

    function playAll() {
        if (favoriteTracks.length > 0) {
            playTrack(favoriteTracks[0], favoriteTracks);
        }
    }
</script>

<main style="max-width: 900px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <a href="/" style="color: #1db954; text-decoration: none; font-weight: bold; font-size: 1.1em;">← กลับหน้าแรก</a>
    </div>

    {#if isLoading}
        <p style="text-align: center; color: #888;">กำลังโหลดเพลงโปรดของคุณ...</p>
    {:else if !authState.currentUser}
        <div style="text-align: center; padding: 50px; background: #ffebee; border-radius: 8px; color: #c62828;">
            <h2>กรุณาเข้าสู่ระบบ</h2>
            <p>คุณต้องเข้าสู่ระบบก่อนเพื่อดูเพลงที่ถูกใจ</p>
        </div>
    {:else}
        <!-- Header Section -->
        <div style="display: flex; align-items: center; gap: 30px; background: linear-gradient(135deg, #4a148c, #1e88e5); padding: 40px; border-radius: 12px; color: white; margin-bottom: 40px; box-shadow: 0 10px 20px rgba(0,0,0,0.15);">
            <div style="width: 150px; height: 150px; background: linear-gradient(135deg, #fff, #f0f0f0); display: flex; justify-content: center; align-items: center; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <span style="font-size: 5em;">❤️</span>
            </div>
            <div>
                <p style="margin: 0; font-size: 0.9em; text-transform: uppercase; letter-spacing: 2px;">Playlist</p>
                <h1 style="margin: 5px 0; font-size: 3.5em;">My Favorite Songs</h1>
                <p style="margin: 5px 0 0 0; font-size: 1.1em; opacity: 0.9;">โดย {authState.currentUser.username} • {favoriteTracks.length} เพลง</p>
                
                {#if favoriteTracks.length > 0}
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
        {#if favoriteTracks.length > 0}
            <div style="display: flex; flex-direction: column; gap: 10px;">
                {#each favoriteTracks as track, index}
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-radius: 8px; background: #fff; border: 1px solid #eee; transition: background 0.2s;" onmouseover={(e) => e.currentTarget.style.background = '#f9f9f9'} onmouseout={(e) => e.currentTarget.style.background = '#fff'}>
                        
                        <div style="display: flex; align-items: center; gap: 15px; flex-grow: 1;">
                            <div style="width: 30px; color: #aaa; text-align: right;">{index + 1}</div>
                            <div>
                                <h3 style="margin: 0 0 5px 0; font-size: 1.1em;">{track.title}</h3>
                                <p style="margin: 0; font-size: 0.85em; color: #1db954; font-weight: bold;">
                                    {track.artists?.map((a:any) => a.name).join(', ') || 'Unknown Artist'}
                                    {#if track.album} • 💿 {track.album.title}{/if}
                                </p>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 15px; align-items: center;">
                            <span style="color: #888; font-size: 0.9em;">{track.duration}</span>
                            
                            <!-- ปุ่ม Unlike -->
                            <button 
                                onclick={() => toggleLike(track.id)}
                                style="background: none; border: none; font-size: 1.5em; cursor: pointer; padding: 5px;"
                                title="ยกเลิกถูกใจ"
                            >❤️</button>

                            <!-- ปุ่ม Play -->
                            <button 
                                onclick={() => playTrack(track, favoriteTracks)}
                                style="padding: 8px 15px; background: #333; color: white; border: none; border-radius: 50px; cursor: pointer; font-weight: bold;"
                            >▶</button>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div style="text-align: center; padding: 50px; background: #f9f9f9; border-radius: 8px; color: #888; border: 2px dashed #ddd;">
                <span style="font-size: 3em;">🤍</span>
                <h3 style="margin: 10px 0;">ยังไม่มีเพลงโปรด</h3>
                <p style="margin: 0;">ไปที่หน้าแรกแล้วกดหัวใจให้เพลงที่คุณชอบดูสิ!</p>
            </div>
        {/if}
    {/if}
</main>