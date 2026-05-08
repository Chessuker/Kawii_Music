<script lang="ts">
    import { onMount } from 'svelte';

    let groupedData: any[] = $state([]);
    let isLoading = $state(true);
    let isLoadingMore = $state(false);
    let currentPage = $state(1);
    let hasMore = $state(true);
    let searchQuery = $state(''); 

    // 👇 1. เพิ่มตัวแปรจับเวลา (Timer) สำหรับระบบ Live Search
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

    // 👇 2. ฟังก์ชันทำงานระหว่างพิมพ์ (หน่วงเวลา 0.5 วิ ก่อนยิงค้นหา)
    function handleLiveSearch() {
        clearTimeout(searchTimeout); // ยกเลิกอันเก่าถ้ายังพิมพ์ไม่เสร็จ
        isLoading = true; // โชว์สถานะโหลดให้ User รู้ว่าแอปกำลังตอบสนอง
        
        searchTimeout = setTimeout(() => {
            loadAlbums(1);
        }, 500); // 500ms คือระยะเวลาที่กำลังดี ไม่ช้าไม่เร็วไป
    }

    // ฟังก์ชันกรณีกดปุ่ม Enter หรือคลิกปุ่มค้นหาตรงๆ
    function handleSearch(e: Event) {
        e.preventDefault();
        clearTimeout(searchTimeout); 
        loadAlbums(1); 
    }
</script>

<main style="max-width: 1200px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
    
<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; margin-bottom: 40px;">
        <h1 style="color: #333; margin: 0; font-size: 2.5em;">💿 คลังอัลบั้มทั้งหมด</h1>
        
        <form onsubmit={handleSearch} style="display: flex; gap: 10px; width: 100%; max-width: 450px;">
            <input 
                type="text" 
                bind:value={searchQuery} 
                oninput={handleLiveSearch} placeholder="🔍 ค้นหาชื่ออัลบั้ม หรือ ชื่อศิลปิน..." 
                style="flex: 1; padding: 12px 20px; border: 1px solid #ccc; border-radius: 50px; outline: none; font-size: 1em; transition: border 0.2s;" 
                onfocus={(e) => e.currentTarget.style.borderColor = '#1db954'}
                onblur={(e) => e.currentTarget.style.borderColor = '#ccc'}
            />
            <button 
                type="submit" 
                style="padding: 12px 30px; background: #1db954; color: white; border: none; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(29, 185, 84, 0.3); transition: transform 0.1s;"
                onmousedown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} 
                onmouseup={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                ค้นหา
            </button>
        </form>
    </div>

    {#if isLoading}
        <div style="text-align: center; padding: 50px; color: #888;">
            <p style="font-size: 1.2em;">⏳ กำลังค้นหาข้อมูล...</p>
        </div>
    {:else if groupedData.length === 0}
        <div style="text-align: center; padding: 50px; color: #888; background: #fff; border-radius: 12px; border: 1px dashed #ccc;">
            <span style="font-size: 4em;">👻</span>
            <p style="font-size: 1.2em; margin-top: 15px;">ไม่พบอัลบั้ม <b>"{searchQuery}"</b></p>
            <div style="margin-top: 20px; display: inline-block; text-align: left; background: #f9f9f9; padding: 15px 25px; border-radius: 8px; border-left: 4px solid #1db954;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">💡 คำแนะนำในการค้นหา:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 0.9em; color: #555;">
                    <li>ลองพิมพ์ชื่อให้สั้นลง เช่น พิมพ์แค่ <b>"Momentary"</b> แทนชื่อเต็ม</li>
                    <li>ตรวจสอบตัวสะกดอีกครั้ง</li>
                    <li>ค้นหาจากชื่อศิลปินแทน (เช่น <b>"Pink Floyd"</b>)</li>
                </ul>
            </div>
        </div>
    {:else}
        {#each groupedData as artistGroup}
            <section style="margin-bottom: 50px;">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                    <span style="font-size: 1.8em; background: #1db954; color: white; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 50%; box-shadow: 0 4px 10px rgba(29, 185, 84, 0.3);">🎤</span>
                    <h2 style="margin: 0; font-size: 1.8em; color: #222;">{artistGroup.name}</h2>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px;">
                    {#each artistGroup.albums as album}
                        <a href="/albums/{album.id}" style="text-decoration: none; color: inherit; display: block; transition: transform 0.2s;" onmouseover={(e) => e.currentTarget.style.transform = 'translateY(-8px)'} onmouseout={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                            <div style="background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08); border: 1px solid #f0f0f0;">
                                <div style="aspect-ratio: 1/1; background: #eee; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                    {#if album.imgUrl}
                                        <img src={album.imgUrl} alt={album.title} style="width: 100%; height: 100%; object-fit: cover;" />
                                    {:else}
                                        <span style="font-size: 4em;">💿</span>
                                    {/if}
                                </div>
                                <div style="padding: 12px;">
                                    <h3 style="margin: 0; font-size: 1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333;">{album.title}</h3>
                                    <p style="margin: 4px 0 0 0; font-size: 0.8em; color: #888;">Album</p>
                                </div>
                            </div>
                        </a>
                    {/each}
                </div>
            </section>
        {/each}

        {#if hasMore}
            <div style="text-align: center; margin-top: 40px; margin-bottom: 60px;">
                <button 
                    onclick={() => loadAlbums(currentPage + 1)} 
                    disabled={isLoadingMore}
                    style="padding: 12px 30px; background: #333; color: white; border: none; border-radius: 50px; font-weight: bold; font-size: 1.1em; cursor: pointer; transition: background 0.2s;"
                    onmouseover={(e) => e.currentTarget.style.background = '#555'} 
                    onmouseout={(e) => e.currentTarget.style.background = '#333'}
                >
                    {isLoadingMore ? '⏳ กำลังโหลด...' : '👇 โหลดเพิ่มเติม'}
                </button>
            </div>
        {/if}
    {/if}
</main>