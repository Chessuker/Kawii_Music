<script lang="ts">
    import { onMount } from 'svelte';
    import import { adminAuthState } from '$lib/adminAuth.svelte';;

    let allUsers: any[] = $state([]);
    let loading = $state(true);
    let processingId = $state<string | null>(null);

    onMount(async () => {
        await fetchUsers();
    });

    async function fetchUsers() {
        try {
            const res = await fetch('http://127.0.0.1:8787/api/users');
            const data = await res.json();
            if (data.success) allUsers = data.data;
        } catch (e) { console.error(e); }
        loading = false;
    }

    async function updateStatus(userId: string, newStatus: string) {
        // ต้องมี Admin Login (สมมติว่าคุณเก็บ adminId ไว้ในระบบ)
        const adminId = adminAuthState.currentAdmin?.id;
        
        processingId = userId;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, adminId: adminId })
            });
            const data = await res.json();
            if (data.success) {
                // อัปเดต UI ทันที
                allUsers = allUsers.map(u => u.id === userId ? { ...u, accountStatus: newStatus } : u);
            }
        } catch (e) { alert("เกิดข้อผิดพลาด"); }
        processingId = null;
    }
</script>

<main class="admin-user-container">
    <nav style="margin-bottom: 2rem;"><a href="/admin" style="color: #1db954; font-weight: bold;">← กลับหน้า Dashboard</a></nav>
    
    <header>
        <h1>👤 จัดการผู้ใช้งาน</h1>
        <p>ตรวจสอบและควบคุมสถานะบัญชีสมาชิกในระบบ</p>
    </header>

    {#if loading}
        <p>กำลังดึงข้อมูลผู้ใช้...</p>
    {:else}
        <div class="user-table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>ผู้ใช้งาน</th>
                        <th>อีเมล</th>
                        <th>วันที่เข้าร่วม</th>
                        <th>สถานะ</th>
                        <th>จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    {#each allUsers as user}
                        <tr>
                            <td>
                                <strong>{user.displayName || user.username}</strong>
                                <br><small style="color: #888;">@{user.username}</small>
                            </td>
                            <td>{user.email}</td>
                            <td>{new Date(user.createdAt).toLocaleDateString('th-TH')}</td>
                            <td>
                                <span class="status-badge {user.accountStatus}">
                                    {user.accountStatus.toUpperCase()}
                                </span>
                            </td>
                            <td>
                                <div class="action-btns">
                                    {#if user.accountStatus === 'active'}
                                        <button class="ban-btn" onclick={() => updateStatus(user.id, 'suspended')} disabled={processingId === user.id}>
                                            🚫 ระงับการใช้งาน
                                        </button>
                                    {:else}
                                        <button class="active-btn" onclick={() => updateStatus(user.id, 'active')} disabled={processingId === user.id}>
                                            ✅ ปลดแบน
                                        </button>
                                    {/if}
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</main>

<style>
    .admin-user-container { padding: 2rem; max-width: 1100px; margin: 0 auto; font-family: sans-serif; }
    h1 { color: #333; margin: 0; }
    header p { color: #666; margin: 10px 0 30px 0; }

    .user-table-wrapper { background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #f8f9fa; padding: 1.2rem 1rem; color: #555; border-bottom: 2px solid #eee; }
    td { padding: 1rem; border-bottom: 1px solid #eee; }

    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; }
    .status-badge.active { background: #e8f5e9; color: #2e7d32; }
    .status-badge.suspended { background: #ffebee; color: #c62828; }

    .action-btns button { padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; border: 1px solid transparent; transition: all 0.2s; }
    .ban-btn { border-color: #ef4444; color: #ef4444; background: transparent; }
    .ban-btn:hover { background: #ef4444; color: white; }
    .active-btn { border-color: #1db954; color: #1db954; background: transparent; }
    .active-btn:hover { background: #1db954; color: white; }
    button:disabled { opacity: 0.5; }
</style>