<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

    let orders: any[] = $state([]);
    let loading = $state(true);

    onMount(async () => {
        await fetchAllOrders();
    });

    async function fetchAllOrders() {
        try {
            const res = await fetch('http://127.0.0.1:8787/api/admin/orders');
            const data = await res.json();
            if (data.success) {
                orders = data.data;
            }
        } catch (e) { console.error(e); }
        loading = false;
    }

    async function cancelOrder(orderId: string) {
        if (!confirm("⚠️ คำเตือน: คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำสั่งซื้อนี้?\n\nข้อมูลบิลและรายละเอียดสินค้าทั้งหมดจะถูกลบออกจากฐานข้อมูลและไม่สามารถกู้คืนได้")) return;

        // ในงานจริง ควรดึงมาจากระบบ Auth ของ Admin
        const adminId = adminAuthState.currentAdmin?.id;
        
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/admin/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId })
            });
            const data = await res.json();
            
            if (data.success) {
                // อัปเดต UI ทันทีโดยไม่ต้องโหลดใหม่
                orders = orders.filter(o => o.order.id !== orderId);
                alert("✅ ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว");
            } else {
                alert("❌ " + data.error);
            }
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
</script>

<main class="admin-container">
    <nav style="margin-bottom: 2rem;">
        <a href="/admin" class="back-link">← กลับหน้า Dashboard</a>
    </nav>
    
    <header>
        <h1>📦 จัดการคำสั่งซื้อ (Order Management)</h1>
        <p>ตรวจสอบความถูกต้องของยอดขาย และจัดการยกเลิกบิลที่มีปัญหา</p>
    </header>

    {#if loading}
        <div class="status">กำลังดึงข้อมูลคำสั่งซื้อ...</div>
    {:else if orders.length === 0}
        <div class="status empty">
            <span style="font-size: 3em;">🧾</span>
            <p>ยังไม่มีคำสั่งซื้อในระบบ</p>
        </div>
    {:else}
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>รหัสบิล (Order ID)</th>
                        <th>เวลาสั่งซื้อ</th>
                        <th>ผู้สั่งซื้อ</th>
                        <th style="text-align: center;">จำนวนสินค้า</th>
                        <th>ยอดสุทธิ (บาท)</th>
                        <th style="text-align: center;">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    {#each orders as item}
                        <tr>
                            <td style="font-family: monospace; color: #666; font-size: 0.9em;">
                                {item.order.id.slice(0, 13)}...
                            </td>
                            <td>{formatDate(item.order.timePurchase)}</td>
                            <td>
                                <strong>{item.user.displayName || item.user.username}</strong>
                            </td>
                            <td style="text-align: center;">
                                {item.order.totalItemCount}
                            </td>
                            <td style="color: #1db954; font-weight: bold; font-size: 1.1em;">
                                ฿{Number(item.order.totalPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td style="text-align: center;">
                                <button class="cancel-btn" onclick={() => cancelOrder(item.order.id)}>
                                    🗑️ ยกเลิกบิล
                                </button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</main>

<style>
    .admin-container { padding: 2rem; max-width: 1200px; margin: 0 auto; font-family: sans-serif; color: #333; }
    .back-link { color: #1db954; text-decoration: none; font-weight: bold; background: #e8f5e9; padding: 8px 15px; border-radius: 8px; }
    .back-link:hover { background: #c8e6c9; }
    
    h1 { margin: 0 0 0.5rem 0; color: #1db954; font-size: 2.2rem; }
    header p { color: #666; margin: 0 0 2rem 0; font-size: 1.1em; }
    
    .status { text-align: center; padding: 4rem; color: #888; background: #f8f9fa; border-radius: 12px; border: 1px dashed #ccc; }

    .table-wrapper { background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #f8f9fa; padding: 1.2rem 1rem; color: #555; border-bottom: 2px solid #eee; }
    td { padding: 1.2rem 1rem; border-bottom: 1px solid #f5f5f5; vertical-align: middle; }
    tr:hover { background: #fafafa; }
    
    .cancel-btn { background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: all 0.2s; }
    .cancel-btn:hover { background: #ef4444; color: white; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); }
</style>