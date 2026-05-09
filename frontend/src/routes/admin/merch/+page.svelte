<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

    let merchItems: any[] = $state([]);
    let allArtists: any[] = $state([]);
    let loading = $state(true);

    // State สำหรับฟอร์ม (Modal)
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
            // ดึงรายชื่อศิลปินทั้งหมดมาใช้เป็น Checkbox ในการผูกสินค้า
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
        const adminId = adminAuthState.currentAdmin?.id; // ในระบบจริงดึงจาก authState

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
                await fetchMerch(); // โหลดข้อมูลใหม่
                isModalOpen = false;
            } else {
                alert(data.error);
            }
        } catch (err) { alert("เกิดข้อผิดพลาด"); }
        isSaving = false;
    }

    async function handleDelete(itemId: string) {
        if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้?")) return;

        const adminId = "YOUR_ADMIN_UUID";
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
                // แจ้งเตือนถัดจับ RESTRICT Constraint จาก Database
                alert("❌ " + data.error); 
            }
        } catch (err) { alert("เกิดข้อผิดพลาดในการเชื่อมต่อ"); }
    }
</script>

<main class="admin-container">
    <nav style="margin-bottom: 2rem;"><a href="/admin" class="back-link">← กลับหน้า Dashboard</a></nav>
    
    <header style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
        <div>
            <h1>🛍️ จัดการสินค้า (Merch CMS)</h1>
            <p>เพิ่ม แก้ไข หรือลบ สินค้าที่ระลึกของศิลปิน</p>
        </div>
        <button class="add-btn" onclick={() => openModal()}>+ เพิ่มสินค้าใหม่</button>
    </header>

    {#if loading}
        <p style="text-align: center; color: #888; padding: 3rem;">กำลังโหลดข้อมูล...</p>
    {:else}
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th width="80">รูปภาพ</th>
                        <th>ชื่อสินค้า</th>
                        <th>ศิลปิน</th>
                        <th>ราคา (บาท)</th>
                        <th width="150">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    {#each merchItems as item}
                        <tr>
                            <td>
                                <div class="img-preview">
                                    {#if item.imgUrl || item.img_url}
                                        <img src={item.imgUrl || item.img_url} alt="Item" />
                                    {:else}
                                        <span>📷</span>
                                    {/if}
                                </div>
                            </td>
                            <td><strong>{item.name}</strong></td>
                            <td style="color: #666; font-size: 0.9em;">
                                {item.artists?.map((a:any) => a.name).join(', ') || '-'}
                            </td>
                            <td style="color: #1db954; font-weight: bold;">
                                ฿{Number(item.price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td>
                                <div class="action-btns">
                                    <button class="edit-btn" onclick={() => openModal(item)}>✏️</button>
                                    <button class="delete-btn" onclick={() => handleDelete(item.id)}>🗑️</button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</main>

{#if isModalOpen}
    <div class="modal-backdrop" onclick={() => isModalOpen = false}>
        <div class="modal-content" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2>{isEditing ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
                <button class="close-btn" onclick={() => isModalOpen = false}>✕</button>
            </div>
            
            <form onsubmit={handleSave} class="modal-body">
                <div class="form-group">
                    <label>ชื่อสินค้า *</label>
                    <input type="text" bind:value={formData.name} required placeholder="เช่น เสื้อยืดลายเซ็นศิลปิน" />
                </div>
                
                <div class="form-group">
                    <label>ราคา (บาท) *</label>
                    <input type="number" step="0.01" min="0" bind:value={formData.price} required placeholder="0.00" />
                </div>

                <div class="form-group">
                    <label>URL รูปภาพสินค้า</label>
                    <input type="url" bind:value={formData.imgUrl} placeholder="https://..." />
                </div>

                <div class="form-group">
                    <label>ผูกกับศิลปิน (เลือกได้มากกว่า 1)</label>
                    <div class="artist-checkbox-group">
                        {#each allArtists as artist}
                            <label class="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    checked={formData.selectedArtistIds.includes(artist.id)}
                                    onchange={() => toggleArtistSelection(artist.id)}
                                />
                                {artist.name}
                            </label>
                        {/each}
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="cancel-btn" onclick={() => isModalOpen = false}>ยกเลิก</button>
                    <button type="submit" class="save-btn" disabled={isSaving}>
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<style>
    .admin-container { padding: 2rem; max-width: 1200px; margin: 0 auto; font-family: sans-serif; color: #333; }
    .back-link { color: #1db954; text-decoration: none; font-weight: bold; }
    h1 { margin: 0 0 0.5rem 0; color: #1db954; font-size: 2.2rem; }
    header p { color: #666; margin: 0; }
    
    .add-btn { background: #1db954; color: white; border: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(29, 185, 84, 0.3); transition: transform 0.1s; }
    .add-btn:active { transform: scale(0.95); }

    .table-wrapper { background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #f8f9fa; padding: 1.2rem 1rem; color: #555; border-bottom: 2px solid #eee; }
    td { padding: 1rem; border-bottom: 1px solid #eee; vertical-align: middle; }
    
    .img-preview { width: 50px; height: 50px; background: #eee; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .img-preview img { width: 100%; height: 100%; object-fit: cover; }
    
    .action-btns { display: flex; gap: 10px; }
    .action-btns button { border: none; background: #f0f0f0; border-radius: 6px; padding: 8px 12px; cursor: pointer; transition: background 0.2s; }
    .edit-btn:hover { background: #fbbf24; }
    .delete-btn:hover { background: #ef4444; color: white; }

    /* Modal Styles */
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; width: 100%; max-width: 500px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #eee; }
    .modal-header h2 { margin: 0; font-size: 1.5rem; color: #333; }
    .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #888; }
    
    .modal-body { padding: 1.5rem; }
    .form-group { margin-bottom: 1.5rem; }
    .form-group label { display: block; font-weight: bold; margin-bottom: 0.5rem; color: #555; font-size: 0.9em; }
    .form-group input[type="text"], .form-group input[type="number"], .form-group input[type="url"] { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 1em; }
    
    .artist-checkbox-group { max-height: 150px; overflow-y: auto; border: 1px solid #eee; padding: 10px; border-radius: 6px; background: #fafafa; display: flex; flex-direction: column; gap: 8px; }
    .checkbox-label { display: flex; align-items: center; gap: 10px; font-size: 0.9em; cursor: pointer; color: #444; }
    
    .modal-footer { display: flex; justify-content: flex-end; gap: 15px; margin-top: 2rem; }
    .modal-footer button { padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; border: none; }
    .cancel-btn { background: #eee; color: #555; }
    .save-btn { background: #1db954; color: white; }
    .save-btn:disabled { opacity: 0.5; }
</style>