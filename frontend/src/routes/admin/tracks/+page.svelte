<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

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
                    albumId: selectedAlbum,
                    artistIds: selectedArtists,
                    genreIds: selectedGenres
                })
            });
            const result = await res.json();
            if (result.success) {
                alert(`✅ ${result.message}`);
                loadTracks();
                iaIdentifier = '';
            } else {
                alert('❌ เกิดข้อผิดพลาด: ' + result.error);
            }
        } catch (error) {
            alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
        }
        isSyncingIA = false;
    }

    let searchAlbumText = $state('');
    let searchArtistText = $state('');
    let searchGenreText = $state('');

    // 1. กรองอัลบั้ม (เลือกได้แค่ 1 อัน)
    let filteredEditAlbums = $derived.by(() => {
        const query = searchAlbumText.toLowerCase().trim(); // 👈 ดึงออกมาแปลงค่าแค่ครั้งเดียว (O(1))
        return availableAlbums
            .filter(a => a.title.toLowerCase().includes(query))
            .sort((a, b) => {
                // ดันอัลบั้มที่เลือกไว้ขึ้นบนสุด
                const aSelected = selectedAlbum === a.id;
                const bSelected = selectedAlbum === b.id;
                if (aSelected !== bSelected) return aSelected ? -1 : 1;

                if (!query) return 0;

                const aTitle = a.title.toLowerCase();
                const bTitle = b.title.toLowerCase();

                // อันดับ 1: Exact Match
                const aExact = aTitle === query;
                const bExact = bTitle === query;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                // อันดับ 2: Starts With
                const aStarts = aTitle.startsWith(query);
                const bStarts = bTitle.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                return 0;
            })
            .slice(0, 20); // 👈 ลดเหลือ 20 จะเรนเดอร์ DOM ได้เร็วกว่า 50 มาก
    });

    // 2. กรองศิลปิน (เลือกได้หลายคน)
    let filteredEditArtists = $derived.by(() => {
        const query = searchArtistText.toLowerCase().trim();
        return availableArtists
            .filter(a => a.name.toLowerCase().includes(query))
            .sort((a, b) => {
                // ดันคนที่ติ๊กเลือกไว้ขึ้นบนสุด
                const aSelected = selectedArtists.includes(a.id);
                const bSelected = selectedArtists.includes(b.id);
                if (aSelected !== bSelected) return aSelected ? -1 : 1;

                if (!query) return 0;

                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();

                // อันดับ 1: Exact Match
                const aExact = aName === query;
                const bExact = bName === query;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                // อันดับ 2: Starts With
                const aStarts = aName.startsWith(query);
                const bStarts = bName.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                return 0;
            })
            .slice(0, 20);
    });

    // 3. กรองแนวเพลง (เลือกได้หลายอัน)
    let filteredEditGenres = $derived.by(() => {
        const query = searchGenreText.toLowerCase().trim();
        return availableGenres
            .filter(g => g.name.toLowerCase().includes(query))
            .sort((a, b) => {
                // ดันแนวเพลงที่ติ๊กเลือกไว้ขึ้นบนสุด
                const aSelected = selectedGenres.includes(a.id);
                const bSelected = selectedGenres.includes(b.id);
                if (aSelected !== bSelected) return aSelected ? -1 : 1;

                if (!query) return 0;

                const aName = g.name.toLowerCase();
                const bName = b.name.toLowerCase();

                // อันดับ 1: Exact Match
                const aExact = aName === query;
                const bExact = bName === query;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                // อันดับ 2: Starts With
                const aStarts = aName.startsWith(query);
                const bStarts = bName.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                return 0;
            })
            .slice(0, 20);
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

    function applyFilter(e: Event) {
        e.preventDefault();
        loadTracks(1);
    }

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
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ title: newAlbumTitle, adminId: adminAuthState.currentAdmin?.id }) 
        });
        const result = await res.json();
        if (result.success) { newAlbumTitle = ''; loadMetadata(); selectedAlbum = result.data.id; }
    }

    async function createArtist() {
        if (!newArtistName) return;
        const res = await fetch('http://127.0.0.1:8787/api/artists', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: newArtistName, adminId: adminAuthState.currentAdmin?.id }) 
        });
        const result = await res.json();
        if (result.success) { newArtistName = ''; loadMetadata(); selectedArtists = [...selectedArtists, result.data.id]; }
    }

    async function createGenre() {
        if (!newGenreName) return;
        const res = await fetch('http://127.0.0.1:8787/api/genres', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name: newGenreName, adminId: adminAuthState.currentAdmin?.id }) 
        });
        const result = await res.json();
        if (result.success) { newGenreName = ''; loadMetadata(); selectedGenres = [...selectedGenres, result.data.id]; }
    }

    function startEdit(track: any) {
        isEditMode = true;
        editingTrackId = track.id;
        editTitle = track.title;
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

<div class="max-w-6xl mx-auto flex flex-col gap-10">
    <nav>
        <a href="/admin" class="text-primary hover:underline font-bold flex items-center gap-2">
            <span>&lsaquo;</span> Back to Dashboard
        </a>
    </nav>

    <div class="flex flex-col gap-2">
        <h1 class="text-4xl font-black text-primary tracking-tight">🎵 Track Management</h1>
        <p class="text-text-muted font-medium">Upload, edit, and organize your music library</p>
    </div>

    <!-- Admin Navigation Modules -->
    <section class="bg-bg-elevated p-6 rounded-2xl border border-white/5 shadow-2xl">
        <p class="text-xs uppercase tracking-widest text-text-muted font-bold mb-4">Quick Navigation</p>
        <div class="flex flex-wrap gap-3">
            <a href="/admin/tracks" class="nav-module-btn border-l-teal-500 bg-white/5 border-teal-500">🎵 Tracks</a>
            <a href="/admin/artists" class="nav-module-btn border-l-emerald-500 hover:border-emerald-500">🎤 Artists</a>
            <a href="/admin/albums" class="nav-module-btn border-l-sky-500 hover:border-sky-500">💿 Albums</a>
            <a href="/admin/users" class="nav-module-btn border-l-indigo-500 hover:border-indigo-500">👤 Users</a>
            <a href="/admin/merch" class="nav-module-btn border-l-primary hover:border-primary">🛍️ Store</a>
            <a href="/admin/orders" class="nav-module-btn border-l-amber-500 hover:border-amber-500">📦 Orders</a>
            <a href="/admin/ranking" class="nav-module-btn border-l-pink-500 hover:border-pink-500">🏆 Ranking</a>
            <a href="/admin/logs" class="nav-module-btn border-l-gray-500 hover:border-gray-500">🛡️ Logs</a>
        </div>
    </section>

    {#if !isEditMode}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- 1. Metadata Config -->
            <section class="bg-bg-elevated p-8 rounded-2xl border border-white/5 shadow-2xl flex flex-col gap-8">
                <h2 class="text-2xl font-black mb-2">1. Metadata for Batch</h2>
                
                <div class="space-y-6">
                    <!-- Album -->
                    <div class="flex flex-col gap-2 p-5 bg-bg-highlight rounded-xl border border-white/5">
                        <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Select Album</label>
                        
                        <input type="text" bind:value={searchAlbumText} placeholder="🔍 Filter albums..." class="bg-bg-highlight border-none rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary outline-none mb-2" />
                        
                        <div class="h-48 overflow-y-auto bg-bg-highlight/50 rounded-xl border border-white/5 p-4 flex flex-col gap-2">
                            <label class="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors py-1 group">
                                <input type="radio" bind:group={selectedAlbum} value="" class="rounded-full border-gray-600 bg-bg-elevated text-primary focus:ring-primary">
                                <span class="text-sm font-medium">-- No Album (Single) --</span>
                            </label>
                            
                            {#each filteredEditAlbums as album}
                                <label class="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors py-1 group">
                                    <input type="radio" bind:group={selectedAlbum} value={album.id} class="rounded-full border-gray-600 bg-bg-elevated text-primary focus:ring-primary">
                                    <span class="text-sm font-medium">{album.title}</span>
                                </label>
                            {:else}
                                <p class="text-text-muted text-xs text-center mt-4 italic">No albums found</p>
                            {/each}
                        </div>

                        <div class="flex gap-2 mt-2">
                            <input type="text" bind:value={newAlbumTitle} placeholder="Or create new..." class="flex-1 bg-bg-elevated border-none rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
                            <button onclick={createAlbum} class="bg-white text-black px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 active:scale-95 transition-transform">Create</button>
                        </div>
                    </div>
                    
                    <!-- Artists -->
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Artists</label>
                        <input type="text" bind:value={searchArtistText} placeholder="🔍 Filter artists..." class="bg-bg-highlight border-none rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary outline-none mb-2" />
                        <div class="h-48 overflow-y-auto bg-bg-highlight/50 rounded-xl border border-white/5 p-4 flex flex-col gap-2">
                            {#each filteredEditArtists as artist}
                                <label class="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors py-1 group">
                                    <input type="checkbox" bind:group={selectedArtists} value={artist.id} class="rounded border-gray-600 bg-bg-elevated text-primary focus:ring-primary">
                                    <span class="text-sm font-medium">{artist.name}</span>
                                </label>
                            {:else}
                                <p class="text-text-muted text-xs text-center mt-4 italic">No artists found</p>
                            {/each}
                        </div>
                        <div class="flex gap-2 mt-2">
                            <input type="text" bind:value={newArtistName} placeholder="+ Add artist..." class="flex-1 bg-bg-highlight border-none rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
                            <button onclick={createArtist} class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-500 transition-colors">Add</button>
                        </div>
                    </div>

                    <!-- Genres -->
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Genres</label>
                        <input type="text" bind:value={searchGenreText} placeholder="🔍 Filter genres..." class="bg-bg-highlight border-none rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary outline-none mb-2" />
                        <div class="h-48 overflow-y-auto bg-bg-highlight/50 rounded-xl border border-white/5 p-4 flex flex-col gap-2">
                            {#each filteredEditGenres as genre}
                                <label class="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors py-1 group">
                                    <input type="checkbox" bind:group={selectedGenres} value={genre.id} class="rounded border-gray-600 bg-bg-elevated text-primary focus:ring-primary">
                                    <span class="text-sm font-medium">{genre.name}</span>
                                </label>
                            {:else}
                                <p class="text-text-muted text-xs text-center mt-4 italic">No genres found</p>
                            {/each}
                        </div>
                        <div class="flex gap-2 mt-2">
                            <input type="text" bind:value={newGenreName} placeholder="+ Add genre..." class="flex-1 bg-bg-highlight border-none rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
                            <button onclick={createGenre} class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-500 transition-colors">Add</button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- 2. File Selection -->
            <section class="bg-bg-elevated p-8 rounded-2xl border border-white/5 shadow-2xl flex flex-col gap-6">
                <h2 class="text-2xl font-black mb-2">2. Upload Files</h2>
                <div class="relative group">
                    <input 
                        type="file" accept=".mp3, .wav, .flac" multiple 
                        bind:files={files} onchange={handleFileSelection}
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div class="border-2 border-dashed border-primary/30 group-hover:border-primary/60 rounded-2xl p-10 text-center transition-all bg-primary/5">
                        <span class="text-4xl mb-4 block">🎵</span>
                        <p class="font-bold text-primary">Click or drag files to upload</p>
                        <p class="text-xs text-text-muted mt-2">MP3, WAV, or FLAC supported</p>
                    </div>
                </div>

                {#if uploadQueue.length > 0}
                    <div class="flex-1 overflow-y-auto max-h-[500px] flex flex-col gap-2 pr-2">
                        {#each uploadQueue as track}
                            <div class="bg-bg-highlight p-4 rounded-xl flex justify-between items-center border border-white/5">
                                <div class="min-w-0">
                                    <input type="text" bind:value={track.title} class="bg-transparent border-none p-0 font-bold text-sm w-full outline-none focus:text-primary" />
                                    <span class="text-[10px] text-text-muted font-bold tracking-widest uppercase">{track.duration}</span>
                                </div>
                                <div class="text-xs font-black">
                                    {#if track.status === 'pending'} <span class="text-text-muted">WAITING</span>
                                    {:else if track.status === 'uploading'} <span class="text-indigo-400 animate-pulse">UPLOADING...</span>
                                    {:else if track.status === 'success'} <span class="text-primary">COMPLETED</span>
                                    {:else} <span class="text-red-500">ERROR</span>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>

                    <button 
                        onclick={startBatchUpload} disabled={isUploadingBatch}
                        class="w-full bg-primary hover:bg-primary-hover text-black py-4 rounded-full font-black text-lg transition-all shadow-xl disabled:opacity-50"
                    >
                        {isUploadingBatch ? 'Processing Batch...' : `Upload ${uploadQueue.length} Tracks`}
                    </button>
                {/if}
            </section>
        </div>

        <!-- IA Sync -->
        <section class="bg-indigo-900/20 p-8 rounded-2xl border border-indigo-500/30 shadow-2xl flex flex-col gap-4">
            <h2 class="text-2xl font-black text-indigo-300">🌐 Internet Archive Sync</h2>
            <p class="text-sm text-indigo-200/60 max-w-2xl">
                Automatically import all audio files from an IA collection. Metadata will be applied based on your selections in Box 1.
            </p>
            <div class="flex flex-col md:flex-row gap-4 items-end">
                <div class="flex-1 w-full">
                    <label class="text-xs font-bold uppercase tracking-wider text-indigo-300 ml-1">IA Identifier</label>
                    <input type="text" bind:value={iaIdentifier} placeholder="e.g. redtopia-flac-01" class="w-full bg-bg-highlight border-indigo-500/30 border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none mt-1.5" />
                </div>
                <button 
                    onclick={syncFromIA} 
                    disabled={isSyncingIA}
                    class="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-black transition-all disabled:opacity-50 h-[50px] shadow-lg"
                >
                    {isSyncingIA ? 'Syncing...' : 'Start IA Import ⚡'}
                </button>
            </div>
        </section>

    {:else}
        <!-- ================= EDIT MODE ================= -->
        <section class="bg-bg-elevated p-10 rounded-3xl border-2 border-primary/50 shadow-2xl flex flex-col gap-8 animate-in zoom-in duration-300">
            <h2 class="text-3xl font-black text-primary">✏️ Edit Track</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Track Title</label>
                        <input type="text" bind:value={editTitle} class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-base focus:ring-2 focus:ring-primary outline-none" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Album</label>
                        <input type="text" bind:value={searchAlbumText} placeholder="🔍 Filter albums..." class="bg-bg-highlight border-none rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                        <div class="h-40 overflow-y-auto bg-bg-highlight/50 rounded-xl p-4 flex flex-col gap-2 border border-white/5">
                            <label class="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors py-1 group">
                                <input type="radio" bind:group={selectedAlbum} value="" class="rounded-full border-gray-600 bg-bg-elevated text-primary focus:ring-primary">
                                <span class="text-sm font-medium">-- No Album (Single) --</span>
                            </label>
                            {#each filteredEditAlbums as album}
                                <label class="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors py-1 group">
                                    <input type="radio" bind:group={selectedAlbum} value={album.id} class="rounded-full border-gray-600 bg-bg-elevated text-primary focus:ring-primary">
                                    <span class="text-sm font-medium">{album.title}</span>
                                </label>
                            {/each}
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Artists</label>
                        <input type="text" bind:value={searchArtistText} placeholder="Filter..." class="bg-bg-highlight border-none rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                        <div class="h-40 overflow-y-auto bg-bg-highlight/50 rounded-xl p-4 flex flex-col gap-2 border border-white/5">
                            {#each filteredEditArtists as artist}
                                <label class="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" bind:group={selectedArtists} value={artist.id} class="rounded text-primary focus:ring-primary bg-bg-elevated border-gray-600">
                                    <span class="text-sm">{artist.name}</span>
                                </label>
                            {/each}
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Genres</label>
                        <input type="text" bind:value={searchGenreText} placeholder="Filter..." class="bg-bg-highlight border-none rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                        <div class="h-40 overflow-y-auto bg-bg-highlight/50 rounded-xl p-4 flex flex-col gap-2 border border-white/5">
                            {#each filteredEditGenres as genre}
                                <label class="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" bind:group={selectedGenres} value={genre.id} class="rounded text-primary focus:ring-primary bg-bg-elevated border-gray-600">
                                    <span class="text-sm">{genre.name}</span>
                                </label>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex gap-4 mt-6">
                <button onclick={saveEdit} disabled={isSavingEdit} class="bg-primary hover:bg-primary-hover text-black px-10 py-4 rounded-full font-black text-lg transition-all shadow-xl">
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
                <button onclick={cancelEdit} class="bg-bg-highlight text-white px-10 py-4 rounded-full font-black text-lg hover:bg-bg-surface transition-all">
                    Cancel
                </button>
            </div>
        </section>
    {/if}

    <!-- Tracks List -->
    <section class="bg-bg-elevated p-8 rounded-3xl border border-white/5 shadow-2xl">
        <div class="flex items-center justify-between mb-8">
            <h2 class="text-2xl font-black">Track Library ({totalTracks})</h2>
        </div>
        
        <!-- Filters -->
        <form onsubmit={applyFilter} class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-10 bg-bg-highlight/50 p-6 rounded-2xl border border-white/5">
            <div class="lg:col-span-2">
                <label class="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2 block">Search Query</label>
                <input type="text" bind:value={searchQuery} placeholder="Title or album:..." class="w-full bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
            
            <div>
                <label class="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2 block">Artist</label>
                <input list="artist-list" bind:value={filterArtist} placeholder="Artist..." class="w-full bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                <datalist id="artist-list">
                    {#each availableArtists as artist}<option value={artist.name}></option>{/each}
                </datalist>
            </div>

            <div>
                <label class="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted mb-2 block">Album</label>
                <input list="album-list" bind:value={filterAlbum} placeholder="Album..." class="w-full bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                <datalist id="album-list">
                    {#each availableAlbums as album}<option value={album.title}></option>{/each}
                </datalist>
            </div>

            <div class="flex items-end">
                <button type="submit" class="w-full bg-white text-black py-3 rounded-xl font-black hover:scale-105 transition-transform shadow-lg">Filter</button>
            </div>
        </form>

        <!-- Tracks Table -->
        <div class="flex flex-col gap-2">
            {#each allTracks as track}
                <div class="group flex items-center justify-between p-4 bg-bg-highlight/30 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-all {editingTrackId === track.id ? 'border-primary' : ''}">
                    <div class="flex flex-col gap-1 min-w-0">
                        <p class="font-bold text-base truncate">{track.title}</p>
                        <div class="flex items-center gap-2 text-xs">
                            <span class="text-primary font-bold">🎤 {track.artists?.length > 0 ? track.artists.map((a: any) => a.name).join(', ') : '-'}</span>
                            <span class="text-text-muted">•</span>
                            <span class="text-text-muted font-bold">💿 {track.album ? track.album.title : 'Single'}</span>
                        </div>
                        <p class="text-[10px] text-text-muted/60 font-black tracking-widest uppercase mt-1">
                            Views: {track.viewCount || track.view_count} • Duration: {track.duration}
                        </p>
                    </div>
                    <div class="flex gap-2 shrink-0 ml-4">
                        <button onclick={() => startEdit(track)} class="bg-indigo-600/20 text-indigo-300 px-4 py-2 rounded-lg text-xs font-black hover:bg-indigo-600 hover:text-white transition-all">EDIT</button>
                        <button onclick={() => handleDelete(track.id, track.title)} class="bg-red-900/20 text-red-400 px-4 py-2 rounded-lg text-xs font-black hover:bg-red-600 hover:text-white transition-all">DELETE</button>
                    </div>
                </div>
            {:else}
                <div class="py-20 text-center text-text-muted italic">No tracks found matching your filters.</div>
            {/each}
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
            <div class="flex justify-between items-center mt-10 pt-8 border-t border-white/5">
                <button 
                    disabled={currentPage === 1} 
                    onclick={() => loadTracks(currentPage - 1)}
                    class="px-6 py-2 bg-bg-highlight hover:bg-bg-elevated border border-white/10 rounded-full font-bold transition-all disabled:opacity-30"
                >Previous</button>
                <span class="text-sm font-bold text-text-muted tracking-widest uppercase">Page {currentPage} of {totalPages}</span>
                <button 
                    disabled={currentPage === totalPages} 
                    onclick={() => loadTracks(currentPage + 1)}
                    class="px-6 py-2 bg-bg-highlight hover:bg-bg-elevated border border-white/10 rounded-full font-bold transition-all disabled:opacity-30"
                >Next</button>
            </div>
        {/if}
    </section>
</div>

<style>
    @reference "../../layout.css";

    .nav-module-btn {
        @apply px-4 py-3 bg-bg-highlight text-white rounded-xl font-black text-sm border border-white/5 transition-all flex items-center gap-2 border-l-4;
    }
    
    .nav-module-btn:hover {
        @apply bg-white/10 -translate-y-1 shadow-xl;
    }
    
    .nav-module-btn:active {
        @apply translate-y-0;
    }
</style>
