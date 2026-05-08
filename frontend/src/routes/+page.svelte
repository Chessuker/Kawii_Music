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

    let recentHistory: any[] = $state([]);

    onMount(() => {
        loadMetadata();
        loadTracks(1);
    });

    async function loadMetadata() {
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
            availableAlbums = albumData.data; // เก็บรายชื่ออัลบั้ม
        }
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
        if (filterAlbum) queryParams.append('album', filterAlbum); // 👇 เพิ่มบรรทัดนี้

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

    // ดึงข้อมูลเพลย์ลิสต์อัตโนมัติ ถ้ามี User ล็อกอินอยู่
    $effect(() => {
        if (authState.currentUser?.id) {
            fetchPlaylists(authState.currentUser.id);
            fetchUserLikes(authState.currentUser.id);
            fetchHistory(authState.currentUser.id); // 👇 เพิ่มบรรทัดนี้
        } else {
            myPlaylists = []; 
            likedTrackIds = [];
            recentHistory = []; // 👇 เพิ่มบรรทัดนี้
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
        
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/tracks/${trackId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authState.currentUser.id })
            });
            const result = await res.json();
            
            if (result.success) {
                // อัปเดต UI ทันทีโดยไม่ต้องรีเฟรชหน้า (Optimistic UI Update)
                if (result.liked) {
                    likedTrackIds = [...likedTrackIds, trackId];
                } else {
                    likedTrackIds = likedTrackIds.filter(id => id !== trackId);
                }
            }
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    }

    async function fetchPlaylists(userId: string) {
        const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/playlists`);
        const result = await res.json();
        if (result.success) myPlaylists = result.data;
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
                fetchPlaylists(authState.currentUser.id); // โหลดใหม่
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

<main style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
    <h1 style="color: #1db954;">🎧 คลังเพลง Kawii Music</h1>
    
    <!-- 👇 ส่วนของเพลย์ลิสต์ (แสดงเฉพาะตอนที่ล็อกอินแล้ว) 👇 -->
    {#if authState.currentUser}
        <section style="background: #282828; color: white; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="margin-top: 0;">📚 My Playlists</h2>
            
            <!-- ฟอร์มสร้างเพลย์ลิสต์ -->
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="text" bind:value={newPlaylistName} placeholder="ชื่อเพลย์ลิสต์ใหม่..." style="flex: 1; padding: 10px; border-radius: 4px; border: none;" />
                <button onclick={createPlaylist} disabled={isCreating} style="padding: 10px 20px; background: #1db954; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                    {isCreating ? '...' : '+ สร้าง'}
                </button>
            </div>

            <div style="display: flex; gap: 10px;">
                <a href="/albums" style="padding: 8px 15px; background: linear-gradient(135deg, #ff9800, #f44336); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 0.9em; box-shadow: 0 2px 5px rgba(244, 67, 54, 0.3);">
                    💿 All Albums
                </a>
                
                <a href="/favorites" style="padding: 8px 15px; background: linear-gradient(135deg, #4a148c, #1e88e5); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 0.9em; box-shadow: 0 2px 5px rgba(30, 136, 229, 0.3);">
                    ❤️ My Favorite Songs
                </a>
            </div>

            <!-- รายการเพลย์ลิสต์ -->
            {#if myPlaylists.length > 0}
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    {#each myPlaylists as pl}
                        <!-- 👇 เปลี่ยนเป็น <a> เพื่อลิงก์ไปหน้า Playlist 👇 -->
                        <a 
                            href="/playlist/{pl.id}" 
                            style="background: #3e3e3e; padding: 10px 15px; border-radius: 20px; font-size: 0.9em; color: white; text-decoration: none; display: inline-block; transition: background 0.2s;"
                            onmouseover={(e) => e.currentTarget.style.background = '#1db954'}
                            onmouseout={(e) => e.currentTarget.style.background = '#3e3e3e'}
                        >
                            🎵 {pl.name}
                        </a>
                    {/each}
                </div>
            {:else}
                <p style="color: #aaa; font-size: 0.9em;">ยังไม่มีเพลย์ลิสต์</p>
            {/if}
        </section>
    {/if}

    <!-- 👇 ส่วนฟังล่าสุด (Recently Played) 👇 -->
    {#if recentHistory.length > 0}
        <section style="margin-bottom: 30px;">
            <h2 style="margin-top: 0; color: #333; font-size: 1.4em;">🕒 ฟังล่าสุด</h2>
            
            <div style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: thin;">
                {#each recentHistory as track}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div 
                        onclick={() => playTrack(track, recentHistory)}
                        style="min-width: 160px; max-width: 160px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s;"
                        onmouseover={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                        onmouseout={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style="width: 100%; height: 130px; background: linear-gradient(135deg, #1db954, #1976d2); border-radius: 6px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 2em;">
                            🎵
                        </div>
                        <h4 style="margin: 0 0 5px 0; font-size: 1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{track.title}</h4>
                        <p style="margin: 0; font-size: 0.8em; color: #888;">{track.duration}</p>
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <!-- 👇 ส่วนค้นหาและกรองเพลงอัจฉริยะ (Smart Search) 👇 -->
    <section style="background: #fff; padding: 20px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <form onsubmit={handleSearch} style="display: flex; gap: 15px; flex-wrap: wrap;">
            
            <!-- ช่องค้นหาหลัก (รองรับ Query) -->
            <div style="flex: 1; min-width: 250px;">
                <label style="font-size: 0.85em; font-weight: bold; color: #555; padding-left: 10px;">🔍 ค้นหา หรือใช้คำสั่ง (เช่น artist:"Linkin Park")</label>
                <input type="text" bind:value={searchQuery} placeholder='พิมพ์ชื่อเพลง, ศิลปิน หรือ album:"Meteora"' style="width: 100%; padding: 12px 15px; margin-top: 5px; border: 1px solid #e0e0e0; border-radius: 50px; background: #f9f9f9; outline: none; box-sizing: border-box; transition: all 0.2s;" onfocus={(e) => e.currentTarget.style.borderColor = '#1db954'} onblur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'} />
            </div>
            
            <!-- ค้นหาศิลปิน (Datalist) -->
            <div style="flex: 1; min-width: 150px;">
                <label style="font-size: 0.85em; font-weight: bold; color: #555; padding-left: 10px;">🎤 ศิลปิน</label>
                <input list="user-artist-list" bind:value={filterArtist} placeholder="พิมพ์ชื่อศิลปิน..." style="width: 100%; padding: 12px 15px; margin-top: 5px; border: 1px solid #e0e0e0; border-radius: 50px; background: #f9f9f9; outline: none; box-sizing: border-box;" />
                <datalist id="user-artist-list">
                    {#each availableArtists as artist}
                        <option value={artist.name}></option>
                    {/each}
                </datalist>
            </div>

            <!-- ค้นหาอัลบั้ม (Datalist) -->
            <div style="flex: 1; min-width: 150px;">
                <label style="font-size: 0.85em; font-weight: bold; color: #555; padding-left: 10px;">💿 อัลบั้ม</label>
                <input list="user-album-list" bind:value={filterAlbum} placeholder="พิมพ์ชื่ออัลบั้ม..." style="width: 100%; padding: 12px 15px; margin-top: 5px; border: 1px solid #e0e0e0; border-radius: 50px; background: #f9f9f9; outline: none; box-sizing: border-box;" />
                <datalist id="user-album-list">
                    {#each availableAlbums as album}
                        <option value={album.title}></option>
                    {/each}
                </datalist>
            </div>

            <!-- ค้นหาแนวเพลง (Datalist) -->
            <div style="flex: 1; min-width: 150px;">
                <label style="font-size: 0.85em; font-weight: bold; color: #555; padding-left: 10px;">🎸 แนวเพลง</label>
                <input list="user-genre-list" bind:value={filterGenre} placeholder="พิมพ์แนวเพลง..." style="width: 100%; padding: 12px 15px; margin-top: 5px; border: 1px solid #e0e0e0; border-radius: 50px; background: #f9f9f9; outline: none; box-sizing: border-box;" />
                <datalist id="user-genre-list">
                    {#each availableGenres as genre}
                        <option value={genre.name}></option>
                    {/each}
                </datalist>
            </div>

            <!-- ปุ่มค้นหา -->
            <div style="display: flex; align-items: flex-end;">
                <button type="submit" disabled={isSearching} style="padding: 12px 30px; background: #1db954; color: white; border: none; border-radius: 50px; font-weight: bold; cursor: pointer; height: 45px; box-shadow: 0 4px 10px rgba(29, 185, 84, 0.3); transition: transform 0.1s;" onmousedown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onmouseup={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    {isSearching ? '⏳...' : 'ค้นหาเลย'}
                </button>
            </div>
        </form>
    </section>

    <!-- 👇 ส่วนคลังเพลง 👇 -->
    <section style="background: #f4f4f9; padding: 20px; border-radius: 8px;">
        <h2 style="margin-top: 0; color: #333;">🎵 เพลงทั้งหมด</h2>

        {#if isSearching}
            <p style="color: #555; margin-bottom: 15px;">กำลังโหลดเพลง...</p>
        {/if}

        {#if tracks.length > 0}
            <div style="display: flex; flex-direction: column; gap: 15px;">
                {#each tracks as track}
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: background 0.2s;" onmouseover={(e) => e.currentTarget.style.background = '#f9f9f9'} onmouseout={(e) => e.currentTarget.style.background = '#fff'}>
                        
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 55px; height: 55px; border-radius: 6px; overflow: hidden; background: linear-gradient(135deg, #e0e0e0, #f5f5f5); flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                {#if track.album?.imgUrl || track.album?.img_url}
                                    <img src={track.album.imgUrl || track.album.img_url} alt="Cover" style="width: 100%; height: 100%; object-fit: cover;" />
                                {:else}
                                    <span style="font-size: 1.8em;">🎵</span>
                                {/if}
                            </div>
                            
                            <div>
                                <h3 style="margin: 0 0 5px 0; font-size: 1.1em; color: #222;">{track.title}</h3>
                                <p style="margin: 0 0 5px 0; font-size: 0.85em; color: #1db954; font-weight: bold;">
                                    {track.artists?.map((a:any) => a.name).join(', ') || 'Unknown Artist'}
                                    {#if track.album} • {track.album.title}{/if}
                                </p>
                                <p style="margin: 0; font-size: 0.85em; color: #777;">
                                    {track.genres?.map((g:any) => g.name).join(', ') || '-'} | ความยาว: {track.duration} | ยอดวิว: {track.viewCount || track.view_count}
                                </p>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button 
                                onclick={() => toggleLike(track.id)}
                                style="background: none; border: none; font-size: 1.5em; cursor: pointer; padding: 5px; transition: transform 0.2s;"
                                onmousedown={(e) => e.currentTarget.style.transform = 'scale(0.8)'}
                                onmouseup={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                title={likedTrackIds.includes(track.id) ? "ยกเลิกถูกใจ" : "ถูกใจ"}
                            >
                                {likedTrackIds.includes(track.id) ? '❤️' : '🤍'}
                            </button>

                            {#if myPlaylists.length > 0}
                                <select 
                                    onchange={(e) => {
                                        if(e.currentTarget.value) {
                                            addToPlaylist(e.currentTarget.value, track.id);
                                            e.currentTarget.value = ""; 
                                        }
                                    }}
                                    style="padding: 8px; border-radius: 4px; border: 1px solid #ccc; background: #f9f9f9; color: #333;"
                                >
                                    <option value="" disabled selected>+ เพิ่มลง...</option>
                                    {#each myPlaylists as pl}
                                        <option value={pl.id}>{pl.name}</option>
                                    {/each}
                                </select>
                            {/if}

                            <button 
                                onclick={() => playTrack(track, tracks)}
                                style="padding: 10px 20px; background: #1db954; color: white; border: none; border-radius: 50px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 5px rgba(29, 185, 84, 0.4); transition: background 0.2s;"
                                onmouseover={(e) => e.currentTarget.style.background = '#1aa34a'}
                                onmouseout={(e) => e.currentTarget.style.background = '#1db954'}
                            >
                                ▶ Play
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
            
            <div style="display: flex; justify-content: center; gap: 20px; align-items: center; margin-top: 30px;">
                <button
                    disabled={currentPage === 1}
                    onclick={() => loadTracks(currentPage - 1)}
                    style="padding: 10px 20px; background: {currentPage === 1 ? '#ccc' : '#333'}; color: white; border: none; border-radius: 50px; cursor: pointer;"
                >&laquo; ก่อนหน้า</button>
                <span>หน้า {currentPage} / {totalPages}</span>
                <button
                    disabled={currentPage === totalPages}
                    onclick={() => loadTracks(currentPage + 1)}
                    style="padding: 10px 20px; background: {currentPage === totalPages ? '#ccc' : '#333'}; color: white; border: none; border-radius: 50px; cursor: pointer;"
                >ถัดไป &raquo;</button>
            </div>
        {:else}
            <p>ยังไม่มีเพลงในระบบ</p>
        {/if}
    </section>
</main>