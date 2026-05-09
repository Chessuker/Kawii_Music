<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

    let merchItems: any[] = $state([]);
    let allArtists: any[] = $state([]);
    let loading = $state(true);

    // State for Modal
    let isModalOpen = $state(false);
    let isEditing = $state(false);
    let isSaving = $state(false);
    let editItemId = $state<string | null>(null);

    let formData = $state({
        name: '',
        price: '',
        imgUrl: '',
        selectedArtistIds: [] as string[]
    });

    onMount(async () => {
        await Promise.all([fetchMerch(), fetchArtists()]);
        loading = false;
    });

    async function fetchMerch() {
        try {
            const res = await fetch('http://127.0.0.1:8787/api/merch');
            const data = await res.json();
            if (data.success) merchItems = data.data;
        } catch (e) { console.error(e); }
    }

    async function fetchArtists() {
        try {
            const res = await fetch('http://127.0.0.1:8787/api/metadata');
            const data = await res.json();
            if (data.success) allArtists = data.artists;
        } catch (e) { console.error(e); }
    }

    function openModal(item: any = null) {
        if (item) {
            isEditing = true;
            editItemId = item.id;
            formData = {
                name: item.name,
                price: item.price.toString(),
                imgUrl: item.imgUrl || item.img_url || '',
                selectedArtistIds: item.artists ? item.artists.map((a: any) => a.id) : []
            };
        } else {
            isEditing = false;
            editItemId = null;
            formData = { name: '', price: '', imgUrl: '', selectedArtistIds: [] };
        }
        isModalOpen = true;
    }

    function toggleArtistSelection(artistId: string) {
        if (formData.selectedArtistIds.includes(artistId)) {
            formData.selectedArtistIds = formData.selectedArtistIds.filter(id => id !== artistId);
        } else {
            formData.selectedArtistIds = [...formData.selectedArtistIds, artistId];
        }
    }

    async function handleSave(e: Event) {
        e.preventDefault();
        isSaving = true;
        const adminId = adminAuthState.currentAdmin?.id;

        const payload = {
            name: formData.name,
            price: parseFloat(formData.price),
            imgUrl: formData.imgUrl,
            artistIds: formData.selectedArtistIds,
            adminId
        };

        const url = isEditing ? `http://127.0.0.1:8787/api/admin/merch/${editItemId}` : 'http://127.0.0.1:8787/api/admin/merch';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                await fetchMerch();
                isModalOpen = false;
            } else {
                alert(data.error);
            }
        } catch (err) { alert("An error occurred"); }
        isSaving = false;
    }

    async function handleDelete(itemId: string) {
        if (!confirm("Are you sure you want to delete this item?")) return;

        const adminId = adminAuthState.currentAdmin?.id;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/admin/merch/${itemId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId })
            });
            const data = await res.json();
            if (data.success) {
                merchItems = merchItems.filter(item => item.id !== itemId);
            } else {
                alert("❌ " + data.error); 
            }
        } catch (err) { alert("Connection error occurred"); }
    }
</script>

<div class="max-w-6xl mx-auto flex flex-col gap-10">
    <nav>
        <a href="/admin" class="text-primary hover:underline font-bold flex items-center gap-2">
            <span>&lsaquo;</span> Back to Dashboard
        </a>
    </nav>
    
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
            <h1 class="text-4xl font-black tracking-tight mb-2">🛍️ Store Management</h1>
            <p class="text-text-muted font-medium">Create, edit, or remove artist merchandise</p>
        </div>
        <button 
            class="bg-primary hover:bg-primary-hover text-black px-8 py-3 rounded-full font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all" 
            onclick={() => openModal()}
        >
            + Add New Item
        </button>
    </header>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading products...</p>
        </div>
    {:else}
        <div class="bg-bg-elevated rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
            <table class="w-full border-collapse text-left">
                <thead>
                    <tr class="bg-bg-highlight/50 text-xs font-bold text-text-muted uppercase tracking-widest border-b border-white/5">
                        <th class="p-6 w-24">Image</th>
                        <th class="p-6">Product Name</th>
                        <th class="p-6">Artists</th>
                        <th class="p-6">Price</th>
                        <th class="p-6 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                    {#each merchItems as item}
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="p-6">
                                <div class="w-16 h-16 bg-bg-highlight rounded-lg overflow-hidden flex items-center justify-center border border-white/5">
                                    {#if item.imgUrl || item.img_url}
                                        <img src={item.imgUrl || item.img_url} alt="Item" class="w-full h-full object-cover" />
                                    {:else}
                                        <span class="text-2xl opacity-30">📷</span>
                                    {/if}
                                </div>
                            </td>
                            <td class="p-6">
                                <span class="font-bold text-white text-lg">{item.name}</span>
                            </td>
                            <td class="p-6">
                                <span class="text-sm text-text-muted">
                                    {item.artists?.map((a:any) => a.name).join(', ') || '-'}
                                </span>
                            </td>
                            <td class="p-6 font-black text-primary text-lg">
                                ฿{Number(item.price).toLocaleString()}
                            </td>
                            <td class="p-6 text-right">
                                <div class="flex justify-end gap-3">
                                    <button 
                                        class="w-10 h-10 rounded-full bg-bg-highlight hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-all border border-white/5" 
                                        onclick={() => openModal(item)}
                                    >
                                        ✏️
                                    </button>
                                    <button 
                                        class="w-10 h-10 rounded-full bg-bg-highlight hover:bg-red-500 hover:text-white flex items-center justify-center transition-all border border-white/5" 
                                        onclick={() => handleDelete(item.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

{#if isModalOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onclick={() => isModalOpen = false}>
        <div class="bg-bg-elevated w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 animate-in zoom-in duration-200" onclick={(e) => e.stopPropagation()}>
            <div class="flex justify-between items-center p-8 border-b border-white/5">
                <h2 class="text-2xl font-black">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
                <button class="text-text-muted hover:text-white text-2xl" onclick={() => isModalOpen = false}>✕</button>
            </div>
            
            <form onsubmit={handleSave} class="p-8 flex flex-col gap-6">
                <div class="flex flex-col gap-2">
                    <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1">Product Name *</label>
                    <input type="text" bind:value={formData.name} required placeholder="e.g. Artist Autographed T-Shirt" class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                
                <div class="flex flex-col gap-2">
                    <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1">Price (THB) *</label>
                    <input type="number" step="0.01" min="0" bind:value={formData.price} required placeholder="0.00" class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1">Image URL</label>
                    <input type="url" bind:value={formData.imgUrl} placeholder="https://..." class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>

                <div class="flex flex-col gap-2">
                    <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1">Link to Artists</label>
                    <div class="max-h-40 overflow-y-auto bg-bg-highlight/50 rounded-xl border border-white/5 p-4 flex flex-col gap-2">
                        {#each allArtists as artist}
                            <label class="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors py-1 group">
                                <input 
                                    type="checkbox" 
                                    checked={formData.selectedArtistIds.includes(artist.id)}
                                    onchange={() => toggleArtistSelection(artist.id)}
                                    class="rounded border-gray-600 bg-bg-elevated text-primary focus:ring-primary"
                                />
                                <span class="text-sm font-medium">{artist.name}</span>
                            </label>
                        {/each}
                    </div>
                </div>

                <div class="flex justify-end gap-4 mt-4">
                    <button type="button" class="px-8 py-3 rounded-full font-black text-sm bg-bg-highlight text-white hover:bg-bg-surface transition-all" onclick={() => isModalOpen = false}>Cancel</button>
                    <button type="submit" class="px-10 py-3 rounded-full font-black text-sm bg-primary text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Product'}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
