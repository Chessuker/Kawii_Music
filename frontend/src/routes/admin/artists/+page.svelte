<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

    let artists: any[] = $state([]);
    let loading = $state(true);
    let searchTerm = $state('');

    // Pagination State
    let currentPage = $state(1);
    let itemsPerPage = 12;

    // Modal State
    let isModalOpen = $state(false);
    let isEditing = $state(false);
    let isSaving = $state(false);
    let editId = $state<string | null>(null);
    let formData = $state({ name: '' });

    onMount(async () => {
        await fetchArtists();
    });

    async function fetchArtists() {
        try {
            const res = await fetch('http://127.0.0.1:8787/api/metadata');
            const data = await res.json();
            if (data.success) {
                artists = data.artists;
            }
        } catch (e) { console.error(e); }
        loading = false;
    }

    // Filter Logic
    let allFilteredArtists = $derived(
        artists
            .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const s = searchTerm.toLowerCase().trim();
                if (!s) return 0;
                
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                
                // อันดับ 1: Exact Match
                const aExact = aName === s;
                const bExact = bName === s;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // อันดับ 2: Starts With
                const aStarts = aName.startsWith(s);
                const bStarts = bName.startsWith(s);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                return 0;
            })
    );

    // Pagination Logic
    let totalPages = $derived(Math.ceil(allFilteredArtists.length / itemsPerPage) || 1);
    let paginatedArtists = $derived(
        allFilteredArtists.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    );

    // Reset page when searching
    $effect(() => {
        searchTerm;
        currentPage = 1;
    });

    function openModal(artist: any = null) {
        if (artist) {
            isEditing = true;
            editId = artist.id;
            formData.name = artist.name;
        } else {
            isEditing = false;
            editId = null;
            formData.name = '';
        }
        isModalOpen = true;
    }

    async function handleSave(e: Event) {
        e.preventDefault();
        isSaving = true;
        const adminId = adminAuthState.currentAdmin?.id;

        const url = isEditing 
            ? `http://127.0.0.1:8787/api/admin/artists/${editId}` 
            : 'http://127.0.0.1:8787/api/artists';
        
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, adminId })
            });
            const data = await res.json();
            if (data.success) {
                await fetchArtists();
                isModalOpen = false;
            } else {
                alert(data.error);
            }
        } catch (err) { alert("An error occurred"); }
        isSaving = false;
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Are you sure you want to delete artist "${name}"?`)) return;
        const adminId = adminAuthState.currentAdmin?.id;

        try {
            const res = await fetch(`http://127.0.0.1:8787/api/admin/artists/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId })
            });
            const data = await res.json();
            if (data.success) {
                artists = artists.filter(a => a.id !== id);
            } else {
                alert(data.error);
            }
        } catch (err) { alert("An error occurred"); }
    }
</script>

<div class="max-w-6xl mx-auto flex flex-col gap-10 pb-20">
    <nav>
        <a href="/admin" class="text-primary hover:underline font-bold flex items-center gap-2">
            <span>&lsaquo;</span> Back to Dashboard
        </a>
    </nav>

    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
            <h1 class="text-4xl font-black tracking-tight mb-2">🎤 Artist Management</h1>
            <p class="text-text-muted font-medium">Manage performers and creators in the system</p>
        </div>
        <button 
            class="bg-primary hover:bg-primary-hover text-black px-8 py-3 rounded-full font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all" 
            onclick={() => openModal()}
        >
            + Add New Artist
        </button>
    </header>

    <!-- Quick Navigation -->
    <section class="bg-bg-elevated p-6 rounded-2xl border border-white/5 shadow-2xl">
        <p class="text-xs uppercase tracking-widest text-text-muted font-bold mb-4">Quick Navigation</p>
        <div class="flex flex-wrap gap-3">
            <a href="/admin/tracks" class="nav-module-btn border-l-teal-500 hover:border-teal-500">🎵 Tracks</a>
            <a href="/admin/artists" class="nav-module-btn border-l-emerald-500 bg-white/5 border-emerald-500">🎤 Artists</a>
            <a href="/admin/albums" class="nav-module-btn border-l-sky-500 hover:border-sky-500">💿 Albums</a>
            <a href="/admin/users" class="nav-module-btn border-l-indigo-500 hover:border-indigo-500">👤 Users</a>
            <a href="/admin/merch" class="nav-module-btn border-l-primary hover:border-primary">🛍️ Store</a>
            <a href="/admin/orders" class="nav-module-btn border-l-amber-500 hover:border-amber-500">📦 Orders</a>
            <a href="/admin/ranking" class="nav-module-btn border-l-pink-500 hover:border-pink-500">🏆 Ranking</a>
            <a href="/admin/logs" class="nav-module-btn border-l-gray-500 hover:border-gray-500">🛡️ Logs</a>
        </div>
    </section>

    <div class="relative group">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors">🔍</span>
        <input 
            type="text" 
            bind:value={searchTerm} 
            placeholder="Search artists by name..." 
            class="w-full bg-bg-elevated border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-xl"
        />
    </div>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading artists...</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {#each paginatedArtists as artist}
                <div class="bg-bg-elevated p-6 rounded-2xl border border-white/5 shadow-2xl hover:bg-bg-highlight transition-all group relative">
                    <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-2xl mb-4 group-hover:scale-110 transition-transform">
                        {artist.name.charAt(0).toUpperCase()}
                    </div>
                    <h3 class="text-xl font-bold text-white truncate mb-1">{artist.name}</h3>
                    <p class="text-xs text-text-muted font-bold uppercase tracking-widest">Artist ID: {artist.id.slice(0, 8)}...</p>
                    
                    <div class="flex gap-2 mt-6">
                        <button 
                            class="flex-1 bg-bg-highlight hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-black transition-all border border-white/5"
                            onclick={() => openModal(artist)}
                        >
                            EDIT
                        </button>
                        <button 
                            class="flex-1 bg-bg-highlight hover:bg-red-500 text-white py-2 rounded-lg text-xs font-black transition-all border border-white/5"
                            onclick={() => handleDelete(artist.id, artist.name)}
                        >
                            DELETE
                        </button>
                    </div>
                </div>
            {:else}
                <div class="col-span-full py-20 text-center text-text-muted italic">No artists found.</div>
            {/each}
        </div>

        <!-- Pagination Controls -->
        {#if totalPages > 1}
            <div class="flex justify-between items-center mt-12 pt-8 border-t border-white/5">
                <button 
                    disabled={currentPage === 1} 
                    onclick={() => { currentPage -= 1; window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    class="px-8 py-3 bg-bg-elevated hover:bg-bg-highlight border border-white/10 rounded-full font-black text-sm transition-all disabled:opacity-30 flex items-center gap-2"
                >
                    &lsaquo; Previous
                </button>
                <div class="flex flex-col items-center gap-1">
                    <span class="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Navigation</span>
                    <span class="text-sm font-black text-white">Page {currentPage} of {totalPages}</span>
                </div>
                <button 
                    disabled={currentPage === totalPages} 
                    onclick={() => { currentPage += 1; window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    class="px-8 py-3 bg-bg-elevated hover:bg-bg-highlight border border-white/10 rounded-full font-black text-sm transition-all disabled:opacity-30 flex items-center gap-2"
                >
                    Next &rsaquo;
                </button>
            </div>
        {/if}
    {/if}
</div>

{#if isModalOpen}
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onclick={() => isModalOpen = false}>
        <div class="bg-bg-elevated w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-white/10 animate-in zoom-in duration-200" onclick={(e) => e.stopPropagation()}>
            <div class="flex justify-between items-center p-8 border-b border-white/5">
                <h2 class="text-2xl font-black">{isEditing ? 'Edit Artist' : 'Add New Artist'}</h2>
                <button class="text-text-muted hover:text-white text-2xl" onclick={() => isModalOpen = false}>✕</button>
            </div>
            
            <form onsubmit={handleSave} class="p-8 flex flex-col gap-6">
                <div class="flex flex-col gap-2">
                    <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1">Artist Name *</label>
                    <input type="text" bind:value={formData.name} required placeholder="e.g. Hatsune Miku" class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>

                <div class="flex justify-end gap-4 mt-4">
                    <button type="button" class="px-8 py-3 rounded-full font-black text-sm bg-bg-highlight text-white hover:bg-bg-surface transition-all" onclick={() => isModalOpen = false}>Cancel</button>
                    <button type="submit" class="px-10 py-3 rounded-full font-black text-sm bg-primary text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Artist'}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<style>
    @reference "../../layout.css";

    .nav-module-btn {
        @apply px-4 py-3 bg-bg-highlight text-white rounded-xl font-black text-sm border border-white/5 transition-all flex items-center gap-2 border-l-4;
    }
    
    .nav-module-btn:hover {
        @apply bg-white/10 -translate-y-1 shadow-xl;
    }
</style>
