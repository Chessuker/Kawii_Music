<script lang="ts">
    import { onMount } from 'svelte';

    // ==============================================
    // 1. STATES
    // ==============================================
    // Metadata States
    let availableArtists: any[] = $state([]);
    let availableGenres: any[] = $state([]);
    let availableAlbums: any[] = $state([]);
    let allTracks: any[] = $state([]);

    // Pagination & Filter States
    let currentPage = $state(1);
    let totalPages = $state(1);
    let totalTracks = $state(0);
    let searchQuery = $state('');
    let filterArtist = $state('');
    let filterGenre = $state('');
    let filterAlbum = $state('');
    
    // Batch Upload States
    let files: FileList | null = $state(null);
    let uploadQueue: any[] = $state([]);
    let selectedArtists: string[] = $state([]);
    let selectedGenres: string[] = $state([]);
    let selectedAlbum: string = $state('');
    let isUploadingBatch = $state(false);
    
    // Quick Add States
    let newAlbumTitle = $state('');
    let newArtistName = $state('');
    let newGenreName = $state('');

    // Edit States
    let isEditMode = $state(false);
    let editingTrackId: string | null = $state(null);
    let editTitle = $state('');
    let isSavingEdit = $state(false);

    onMount(() => {
        loadMetadata();
        loadTracks();
    });

    // IA Sync States
    let iaIdentifier = $state('');
    let isSyncingIA = $state(false);

    async function syncFromIA() {
        if (!iaIdentifier) {
            alert('กรุณากรอก Identifier เช่น redtopia-flac-01');
            return;
        }
        isSyncingIA = true;
        try {
            const res = await fetch('http://127.0.0.1:8787/api/sync-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: iaIdentifier,
                    albumId: selectedAlbum, // ใช้ Album ที่เลือกไว้ฝั่งซ้ายได้เลย
                    artistIds: selectedArtists, // ใช้ Artist ที่เลือกไว้ได้เลย
                    genreIds: selectedGenres  // ใช้ Genre ที่เลือกไว้ได้เลย
                })
            });
            const result = await res.json();
            if (result.success) {
                alert(`✅ ${result.message}`);
                loadTracks(); // โหลดตารางเพลงใหม่
                iaIdentifier = ''; // เคลียร์ช่อง
            } else {
                alert('❌ เกิดข้อผิดพลาด: ' + result.error);
            }
        } catch (error) {
            alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
        }
        isSyncingIA = false;
    }

    // 👇 1. เพิ่ม State สำหรับกล่องค้นหา Checkbox
    let searchArtistText = $state('');
    let searchGenreText = $state('');

    // 👇 2. ใช้ $derived เพื่อกรองข้อมูลแบบ Real-time ทันทีที่พิมพ์
    let filteredEditArtists = $derived(
        availableArtists.filter(a => a.name.toLowerCase().includes(searchArtistText.toLowerCase()))
    );
    let filteredEditGenres = $derived(
        availableGenres.filter(g => g.name.toLowerCase().includes(searchGenreText.toLowerCase()))
    );

    // ==============================================
    // 2. DATA FETCHING
    // ==============================================
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
        if (albumData.success) availableAlbums = albumData.data;
    }

    async function loadTracks(page = 1) {
        currentPage = page;
        const queryParams = new URLSearchParams({
            page: currentPage.toString(),
            limit: '20',
            search: searchQuery,
            artist: filterArtist,
            genre: filterGenre,
            album: filterAlbum
        });

        const res = await fetch(`http://127.0.0.1:8787/api/tracks?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success) {
            allTracks = data.data;
            totalPages = data.pagination.totalPages;
            totalTracks = data.pagination.totalTracks;
        }
    }

    // ฟังก์ชันสำหรับกดปุ่มค้นหา
    function applyFilter(e: Event) {
        e.preventDefault();
        loadTracks(1); // ค้นหาใหม่ให้กลับไปหน้า 1
    }

    // ==============================================
    // 3. UPLOAD & QUICK ADD LOGIC
    // ==============================================
    async function handleFileSelection(e: Event) {
        if (!files) return;
        uploadQueue = []; 

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let rawTitle = file.name.replace(/\.[^/.]+$/, ""); 
            let cleanTitle = rawTitle.replace(/^\d+[\s-._]*/, "");
            const durationSec = await getAudioDuration(file);
            
            uploadQueue.push({
                file: file,
                title: cleanTitle,
                duration: formatDuration(durationSec),
                status: 'pending' 
            });
        }
    }

    async function startBatchUpload() {
        isUploadingBatch = true;
        for (let i = 0; i < uploadQueue.length; i++) {
            if (uploadQueue[i].status === 'success') continue;
            uploadQueue[i].status = 'uploading';
            const track = uploadQueue[i];

            const formData = new FormData();
            formData.append('title', track.title);
            formData.append('file', track.file);
            formData.append('duration', track.duration);
            formData.append('artistIds', JSON.stringify(selectedArtists));
            formData.append('genreIds', JSON.stringify(selectedGenres));
            if (selectedAlbum) formData.append('albumId', selectedAlbum);

            try {
                const res = await fetch('http://127.0.0.1:8787/api/upload', {
                    method: 'POST', body: formData
                });
                const result = await res.json();
                uploadQueue[i].status = result.success ? 'success' : 'error';
            } catch (error) {
                uploadQueue[i].status = 'error';
            }
        }
        isUploadingBatch = false;
        files = null; 
        loadTracks(); 
        alert('อัปโหลด Batch เสร็จสิ้น!');
    }

    async function createAlbum() {
        if (!newAlbumTitle) return;
        const res = await fetch('http://127.0.0.1:8787/api/albums', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newAlbumTitle })
        });
        const result = await res.json();
        if (result.success) { newAlbumTitle = ''; loadMetadata(); selectedAlbum = result.data.id; }
    }

    async function createArtist() {
        if (!newArtistName) return;
        const res = await fetch('http://127.0.0.1:8787/api/artists', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newArtistName })
        });
        const result = await res.json();
        if (result.success) { newArtistName = ''; loadMetadata(); selectedArtists = [...selectedArtists, result.data.id]; }
    }

    async function createGenre() {
        if (!newGenreName) return;
        const res = await fetch('http://127.0.0.1:8787/api/genres', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newGenreName })
        });
        const result = await res.json();
        if (result.success) { newGenreName = ''; loadMetadata(); selectedGenres = [...selectedGenres, result.data.id]; }
    }

    // ==============================================
    // 4. EDIT & DELETE LOGIC
    // ==============================================
    function startEdit(track: any) {
        isEditMode = true;
        editingTrackId = track.id;
        editTitle = track.title;
        // ดึงข้อมูลเดิมมาใส่ Form
        selectedArtists = track.artists ? track.artists.map((a: any) => a.id) : [];
        selectedGenres = track.genres ? track.genres.map((g: any) => g.id) : [];
        selectedAlbum = track.album ? track.album.id : '';
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }

    function cancelEdit() {
        isEditMode = false;
        editingTrackId = null;
        editTitle = '';
        selectedArtists = [];
        selectedGenres = [];
        selectedAlbum = '';
    }

    async function saveEdit() {
        if (!editingTrackId) return;
        isSavingEdit = true;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/tracks/${editingTrackId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editTitle,
                    artistIds: selectedArtists,
                    genreIds: selectedGenres,
                    albumId: selectedAlbum
                })
            });
            const result = await res.json();
            if (result.success) {
                alert('แก้ไขข้อมูลสำเร็จ!');
                cancelEdit();
                loadTracks();
            } else alert('เกิดข้อผิดพลาด: ' + result.error);
        } catch (error) {
            alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
        }
        isSavingEdit = false;
    }

    async function handleDelete(trackId: string, trackTitle: string) {
        if (!confirm(`ลบเพลง "${trackTitle}" ถาวรหรือไม่?`)) return;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/tracks/${trackId}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                loadTracks(); 
                if (editingTrackId === trackId) cancelEdit();
            } else alert('ลบไม่ได้: ' + result.error);
        } catch (error) {
            alert('เซิร์ฟเวอร์ขัดข้อง');
        }
    }

    // ==============================================
    // 5. UTILS
    // ==============================================
    function toggleSelection(array: string[], id: string) {
        return array.includes(id) ? array.filter(itemId => itemId !== id) : [...array, id];
    }
    function getAudioDuration(file: File): Promise<number> {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const audio = new Audio(url);
            audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(audio.duration); };
        });
    }
    function formatDuration(totalSeconds: number): string {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
</script>

<main style="max-width: 1000px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <h1 style="color: #1db954; margin: 0;">🎛 Admin Dashboard</h1>
        <a href="/admin/logs" style="padding: 10px 20px; background: #333; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">🛡️ View Audit Logs</a>
    </div>
    
    {#if !isEditMode}
        <!-- ================= โหมด UPLOAD ================= -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
            <section style="background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <h2 style="margin-top: 0; color: #333;">1. ตั้งค่า Metadata สำหรับ Batch</h2>
                
                <!-- อัลบั้ม -->
                <div style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 6px; border: 1px solid #ddd;">
                    <label style="font-weight: bold;">เลือกอัลบั้ม:</label>
                    <select bind:value={selectedAlbum} style="width: 100%; padding: 8px; margin-top: 5px; margin-bottom: 10px;">
                        <option value="">-- ไม่อยู่ในอัลบั้ม --</option>
                        {#each availableAlbums as album}
                            <option value={album.id}>{album.title}</option>
                        {/each}
                    </select>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" bind:value={newAlbumTitle} placeholder="...หรือสร้างใหม่" style="flex: 1; padding: 8px;" />
                        <button onclick={createAlbum} style="padding: 8px 15px; background: #333; color: white; border: none; cursor: pointer;">สร้าง</button>
                    </div>
                </div>

                <!-- ศิลปิน -->
                <div style="margin-bottom: 20px;">
                    <label style="font-weight: bold; display: block; margin-bottom: 8px;">🎤 ศิลปิน (Artists):</label>
                    
                    <input 
                        type="text" 
                        bind:value={searchArtistText} 
                        placeholder="🔍 พิมพ์ค้นหาชื่อศิลปิน..." 
                        style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" 
                    />
                    
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 12px; border-radius: 4px; background: #fdfdfd; display: flex; flex-direction: column; gap: 8px;">
                        {#each filteredEditArtists as artist}
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                                <input type="checkbox" bind:group={selectedArtists} value={artist.id}> {artist.name}
                            </label>
                        {:else}
                            <p style="color: #999; font-size: 0.9em; margin: 0; text-align: center;">ไม่พบศิลปินที่ค้นหา</p>
                        {/each}
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <input type="text" bind:value={newArtistName} placeholder="+ เพิ่มศิลปินใหม่..." style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
                        <button type="button" onclick={createArtist} style="padding: 8px 15px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">เพิ่ม</button>
                    </div>
                </div>

                <!-- แนวเพลง -->
                <div style="margin-bottom: 20px;">
                    <label style="font-weight: bold; display: block; margin-bottom: 8px;">🎸 แนวเพลง (Genres):</label>
                    
                    <input 
                        type="text" 
                        bind:value={searchGenreText} 
                        placeholder="🔍 พิมพ์ค้นหาแนวเพลง..." 
                        style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" 
                    />
                    
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 12px; border-radius: 4px; background: #fdfdfd; display: flex; flex-direction: column; gap: 8px;">
                        {#each filteredEditGenres as genre}
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                                <input type="checkbox" bind:group={selectedGenres} value={genre.id}> {genre.name}
                            </label>
                        {:else}
                            <p style="color: #999; font-size: 0.9em; margin: 0; text-align: center;">ไม่พบแนวเพลงที่ค้นหา</p>
                        {/each}
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <input type="text" bind:value={newGenreName} placeholder="+ เพิ่มแนวเพลงใหม่..." style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
                        <button type="button" onclick={createGenre} style="padding: 8px 15px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">เพิ่ม</button>
                    </div>
                </div>
            </section>

            <section style="background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <h2 style="margin-top: 0; color: #333;">2. เลือกไฟล์ทั้งหมด</h2>
                <input 
                    type="file" accept=".mp3, .wav, .flac" multiple 
                    bind:files={files} onchange={handleFileSelection}
                    style="width: 100%; padding: 10px; background: #e8f5e9; border: 2px dashed #1db954; border-radius: 8px; cursor: pointer;"
                />

                {#if uploadQueue.length > 0}
                    <div style="margin-top: 20px; max-height: 400px; overflow-y: auto;">
                        {#each uploadQueue as track}
                            <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
                                <div style="display: flex; flex-direction: column;">
                                    <input type="text" bind:value={track.title} style="border: none; font-weight: bold; background: transparent; width: 250px;" />
                                    <span style="font-size: 0.8em; color: #888;">{track.duration}</span>
                                </div>
                                <div>
                                    {#if track.status === 'pending'} ⏳ รอ
                                    {:else if track.status === 'uploading'} 🔄 อัป..
                                    {:else if track.status === 'success'} ✅ เสร็จ
                                    {:else} ❌ พัง
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>

                    <button 
                        onclick={startBatchUpload} disabled={isUploadingBatch}
                        style="width: 100%; margin-top: 20px; padding: 15px; background: #1db954; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1em; cursor: pointer;"
                    >
                        {isUploadingBatch ? 'กำลังประมวลผล Batch...' : `เริ่มอัปโหลด ${uploadQueue.length} เพลง`}
                    </button>
                {/if}
            </section>
        </div>

            <!-- เพิ่ม Section ใหม่สำหรับ Internet Archive ต่อท้าย Section เลือกไฟล์ -->
            <section style="background: #e3f2fd; padding: 25px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); grid-column: span 2; margin-top: -10px;">
                <h2 style="margin-top: 0; color: #1565c0;">🌐 ดึงข้อมูลอัตโนมัติจาก Internet Archive (Automate Sync)</h2>
                <p style="font-size: 0.9em; color: #555; margin-bottom: 15px;">
                    ดึงไฟล์ .mp3 / .flac ทั้งหมดใน Collection รวดเดียว โดยอิง Metadata (อัลบั้ม, ศิลปิน, แนวเพลง) จากกล่องหมายเลข 1 ด้านบน
                </p>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <div style="flex: 1;">
                        <label style="font-weight: bold; display: block; margin-bottom: 5px;">IA Identifier (เช่น redtopia-flac-01):</label>
                        <input type="text" bind:value={iaIdentifier} placeholder="redtopia-flac-01" style="width: 100%; padding: 12px; border: 1px solid #90caf9; border-radius: 4px; box-sizing: border-box;" />
                    </div>
                    <button 
                        onclick={syncFromIA} 
                        disabled={isSyncingIA}
                        style="padding: 12px 30px; background: #1976d2; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 1.1em; cursor: pointer; margin-top: 25px;"
                    >
                        {isSyncingIA ? 'กำลังดึงข้อมูล... ⏳' : 'ดูดเพลงลง Database ⚡'}
                    </button>
                </div>
            </section>

    {:else}
        <!-- ================= โหมด EDIT ================= -->
        <section style="background: #fff3e0; padding: 25px; border-radius: 8px; border: 2px solid #ff9800; margin-bottom: 40px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0; color: #e65100;">✏️ โหมดแก้ไขเพลง</h2>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <label style="font-weight: bold;">ชื่อเพลง:</label>
                    <input type="text" bind:value={editTitle} style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
                </div>

                <div>
                    <label style="font-weight: bold;">อัปเดตอัลบั้ม:</label>
                    <select bind:value={selectedAlbum} style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="">-- ไม่อยู่ในอัลบั้ม --</option>
                        {#each availableAlbums as album}
                            <option value={album.id}>{album.title}</option>
                        {/each}
                    </select>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="font-weight: bold; display: block; margin-bottom: 8px;">🎤 ศิลปิน (Artists):</label>
                    
                    <!-- ช่องค้นหา -->
                    <input 
                        type="text" 
                        bind:value={searchArtistText} 
                        placeholder="🔍 พิมพ์ค้นหาชื่อศิลปิน..." 
                        style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" 
                    />
                    
                    <!-- กล่อง Scroll ที่ขัง Checkbox ไว้ -->
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 12px; border-radius: 4px; background: #fdfdfd; display: flex; flex-direction: column; gap: 8px;">
                        {#each filteredEditArtists as artist}
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                                <!-- หมายเหตุ: เปลี่ยน editTrack.artistIds เป็นชื่อตัวแปรฟอร์มของคุณ -->
                                <input type="checkbox" bind:group={selectedArtists} value={artist.id}> {artist.name}
                            </label>
                        {:else}
                            <p style="color: #999; font-size: 0.9em; margin: 0; text-align: center;">ไม่พบศิลปินที่ค้นหา</p>
                        {/each}
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="font-weight: bold; display: block; margin-bottom: 8px;">🎸 แนวเพลง (Genres):</label>
                    
                    <input 
                        type="text" 
                        bind:value={searchGenreText} 
                        placeholder="🔍 พิมพ์ค้นหาแนวเพลง..." 
                        style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" 
                    />
                    
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 12px; border-radius: 4px; background: #fdfdfd; display: flex; flex-direction: column; gap: 8px;">
                        {#each filteredEditGenres as genre}
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                                <!-- หมายเหตุ: เปลี่ยน editTrack.genreIds เป็นชื่อตัวแปรฟอร์มของคุณ -->
                                <input type="checkbox" bind:group={selectedGenres} value={genre.id}> {genre.name}
                            </label>
                        {:else}
                            <p style="color: #999; font-size: 0.9em; margin: 0; text-align: center;">ไม่พบแนวเพลงที่ค้นหา</p>
                        {/each}
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button onclick={saveEdit} disabled={isSavingEdit} style="padding: 12px 25px; background: #ff9800; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                        {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                    <button onclick={cancelEdit} style="padding: 12px 25px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">
                        ยกเลิก
                    </button>
                </div>
            </div>
        </section>
    {/if}

    <hr style="border: 0; border-top: 2px dashed #eee; margin-bottom: 30px;">

    <!-- ================= รายการเพลงทั้งหมด ================= -->
    <section style="background: #f9f9f9; padding: 25px; border-radius: 8px; border: 1px solid #ddd;">
        <h2 style="margin-top: 0; color: #333;">🗂 รายการเพลงทั้งหมดในระบบ ({totalTracks} เพลง)</h2>
        
        <!-- 👇 แถบ Filter ค้นหาอัจฉริยะ 👇 -->
        <form onsubmit={applyFilter} style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; background: #fff; padding: 15px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            
            <div style="flex: 1; min-width: 250px;">
                <label style="font-size: 0.85em; font-weight: bold; color: #555;">ค้นหาแบบอิสระ หรือ Query (เช่น artist:"Oasis")</label>
                <input type="text" bind:value={searchQuery} placeholder='🔍 ชื่อเพลง, หรือคำสั่ง เช่น album:"Meteora"' style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
            </div>
            
            <div style="flex: 1; min-width: 180px;">
                <label style="font-size: 0.85em; font-weight: bold; color: #555;">🎤 ค้นหาศิลปิน</label>
                <input list="artist-list" bind:value={filterArtist} placeholder="พิมพ์ชื่อศิลปิน..." style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
                <datalist id="artist-list">
                    {#each availableArtists as artist}
                        <option value={artist.name}></option>
                    {/each}
                </datalist>
            </div>

            <div style="flex: 1; min-width: 180px;">
                <label style="font-size: 0.85em; font-weight: bold; color: #555;">💿 ค้นหาอัลบั้ม</label>
                <input list="album-list" bind:value={filterAlbum} placeholder="พิมพ์ชื่ออัลบั้ม..." style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
                <datalist id="album-list">
                    {#each availableAlbums as album}
                        <option value={album.title}></option>
                    {/each}
                </datalist>
            </div>

            <div style="flex: 1; min-width: 180px;">
                <label style="font-size: 0.85em; font-weight: bold; color: #555;">🎸 ค้นหาแนวเพลง</label>
                <input list="genre-list" bind:value={filterGenre} placeholder="พิมพ์ชื่อแนวเพลง..." style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
                <datalist id="genre-list">
                    {#each availableGenres as genre}
                        <option value={genre.name}></option>
                    {/each}
                </datalist>
            </div>

            <div style="display: flex; align-items: flex-end;">
                <button type="submit" style="padding: 10px 20px; background: #333; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; height: 40px;">ค้นหา</button>
            </div>
        </form>

        <!-- ตารางเพลง -->
        {#if allTracks.length > 0}
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <!-- (โค้ดลูป #each allTracks เหมือนเดิมเป๊ะเลยครับ) -->
                {#each allTracks as track}
                    <div style="background: #fff; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; border-left: {editingTrackId === track.id ? '4px solid #ff9800' : '4px solid transparent'};">
                        <div>
                            <p style="margin: 0; font-weight: bold; font-size: 1.1em;">{track.title}</p>
                            <p style="margin: 3px 0; font-size: 0.85em; color: #1db954;">
                                🎤 {track.artists?.length > 0 ? track.artists.map((a: any) => a.name).join(', ') : '-'} | 
                                🎸 {track.genres?.length > 0 ? track.genres.map((g: any) => g.name).join(', ') : '-'} | 
                                💿 {track.album ? track.album.title : 'Single'}
                            </p>
                            <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #666;">ยอดวิว: {track.viewCount || track.view_count} | ความยาว: {track.duration}</p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick={() => startEdit(track)} style="padding: 8px 15px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">แก้ไข</button>
                            <button onclick={() => handleDelete(track.id, track.title)} style="padding: 8px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">ลบ</button>
                        </div>
                    </div>
                {/each}
            </div>

            <!-- 👇 ปุ่มแบ่งหน้า (Pagination) 👇 -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
                <button 
                    disabled={currentPage === 1} 
                    onclick={() => loadTracks(currentPage - 1)}
                    style="padding: 8px 15px; background: {currentPage === 1 ? '#ccc' : '#1db954'}; color: white; border: none; border-radius: 4px; cursor: pointer;"
                >
                    &laquo; หน้าก่อนหน้า
                </button>
                <span style="font-weight: bold;">หน้า {currentPage} จาก {totalPages}</span>
                <button 
                    disabled={currentPage === totalPages} 
                    onclick={() => loadTracks(currentPage + 1)}
                    style="padding: 8px 15px; background: {currentPage === totalPages ? '#ccc' : '#1db954'}; color: white; border: none; border-radius: 4px; cursor: pointer;"
                >
                    หน้าถัดไป &raquo;
                </button>
            </div>
        {:else}
            <p style="color: #666; text-align: center; padding: 20px;">ไม่พบเพลงที่ค้นหา</p>
        {/if}
    </section>
</main>