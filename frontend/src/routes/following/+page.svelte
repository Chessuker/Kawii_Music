<script lang="ts">
    import { authState } from '$lib/auth.svelte';

    let followedArtists: any[] = $state([]);
    let loading = $state(true);
    let error: string | null = $state(null);

    // 👇 ใช้ $effect รอจนกว่าระบบ Auth จะดึงข้อมูลเสร็จ
    $effect(() => {
        if (authState.currentUser?.id) {
            fetchFollows(authState.currentUser.id);
        } else if (authState.currentUser === null) {
            loading = false;
            error = "กรุณาเข้าสู่ระบบเพื่อดูศิลปินที่คุณติดตาม";
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
            error = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
        } finally {
            loading = false;
        }
    }

    async function handleUnfollow(e: Event, artistId: string) {
        e.preventDefault(); // ป้องกันไม่ให้กดปุ่มแล้วเด้งไปหน้าอื่น
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

<main style="max-width: 1000px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
    <div style="margin-bottom: 40px;">
        <h1 style="color: #333; margin: 0; font-size: 2.5em;">❤️ ศิลปินที่ติดตาม</h1>
        <p style="color: #888; font-size: 1.1em; margin-top: 10px;">ศิลปินที่คุณไม่พลาดทุกผลงานใหม่</p>
    </div>

    {#if loading}
        <div style="text-align: center; padding: 50px; color: #888;">⏳ กำลังโหลด...</div>
    {:else if error}
        <div style="text-align: center; padding: 50px; color: #888; background: #fff; border-radius: 12px; border: 1px dashed #ccc;">
            <p style="font-size: 1.2em;">{error}</p>
        </div>
    {:else if followedArtists.length === 0}
        <div style="text-align: center; padding: 50px; color: #888; background: #fff; border-radius: 12px; border: 1px dashed #ccc;">
            <span style="font-size: 4em;">👻</span>
            <p style="font-size: 1.2em; margin-top: 15px;">คุณยังไม่ได้ติดตามศิลปินคนไหนเลย</p>
            <a href="/artists" style="display: inline-block; margin-top: 15px; padding: 12px 30px; background: #1db954; color: white; text-decoration: none; border-radius: 50px; font-weight: bold;">ค้นหาศิลปิน</a>
        </div>
    {:else}
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 30px;">
            {#each followedArtists as artist}
                <a href="/artists/{artist.id}" style="text-decoration: none; color: inherit; display: block;">
                    <div style="background: #fff; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eee; transition: transform 0.2s;" onmouseover={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onmouseout={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                        <div style="width: 100px; height: 100px; background: linear-gradient(135deg, #1db954, #1976d2); border-radius: 50%; margin: 0 auto 15px auto; display: flex; align-items: center; justify-content: center; color: white; font-size: 2.5em; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                            {artist.name.charAt(0).toUpperCase()}
                        </div>
                        <h3 style="margin: 0 0 15px 0; font-size: 1.1em; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{artist.name}</h3>
                        
                        <button 
                            onclick={(e) => handleUnfollow(e, artist.id)}
                            style="width: 100%; padding: 10px 0; border-radius: 50px; font-weight: bold; cursor: pointer; transition: all 0.2s; border: 2px solid #1db954; font-size: 0.9em; background: #1db954; color: white;"
                        >
                            ✓ Following
                        </button>
                    </div>
                </a>
            {/each}
        </div>
    {/if}
</main>