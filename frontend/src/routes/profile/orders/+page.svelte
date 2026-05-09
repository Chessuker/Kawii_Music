<script lang="ts">
    import { onMount } from 'svelte';
    import { authState } from '$lib/auth.svelte';

    let orders: any[] = $state([]);
    let loading = $state(true);
    let error: string | null = $state(null);

    $effect(() => {
        if (authState.currentUser?.id) {
            fetchOrders(authState.currentUser.id);
        } else if (authState.currentUser === null) {
            loading = false;
            error = "กรุณาเข้าสู่ระบบเพื่อดูประวัติการสั่งซื้อ";
        }
    });

    async function fetchOrders(userId: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/purchases`);
            const data = await res.json();
            if (data.success) {
                orders = data.data;
            } else {
                error = data.error;
            }
        } catch (err) {
            error = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้";
        } finally {
            loading = false;
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
</script>

<main class="orders-container">
    <header>
        <h1>📦 ประวัติการสั่งซื้อ</h1>
        <p>บันทึกการสนับสนุนศิลปินของคุณทั้งหมด</p>
    </header>

    {#if loading}
        <div class="status">กำลังดึงข้อมูลคำสั่งซื้อ...</div>
    {:else if error}
        <div class="status error">{error}</div>
    {:else if orders.length === 0}
        <div class="status empty">
            <span style="font-size: 3em;">🛒</span>
            <p>คุณยังไม่มีรายการสั่งซื้อในขณะนี้</p>
            <a href="/merch" class="shop-btn">ไปช้อปปิ้งกัน!</a>
        </div>
    {:else}
        <div class="orders-list">
            {#each orders as order (order.id)}
                <div class="order-card">
                    <div class="order-header">
                        <div class="order-meta">
                            <span class="order-id">ID: {order.id.slice(0, 8)}...</span>
                            <span class="order-date">📅 {formatDate(order.timePurchase)}</span>
                        </div>
                        <div class="order-total">
                            ฿{Number(order.totalPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div class="order-body">
                        {#each order.items as item}
                            <div class="item-row">
                                <div class="item-img">
                                    {#if item.itemImg}
                                        <img src={item.itemImg} alt={item.itemName} />
                                    {:else}
                                        <div class="placeholder">🖼️</div>
                                    {/if}
                                </div>
                                <div class="item-info">
                                    <p class="name">{item.itemName}</p>
                                    <p class="price-qty">฿{Number(item.unitPrice).toLocaleString()} x {item.quantity}</p>
                                </div>
                                <div class="item-subtotal">
                                    ฿{Number(item.extendedPrice).toLocaleString()}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</main>

<style>
    .orders-container { padding: 3rem 2rem; max-width: 800px; margin: 0 auto; color: #fff; font-family: sans-serif; }
    header { margin-bottom: 3rem; border-bottom: 1px solid #333; padding-bottom: 1rem; }
    h1 { font-size: 2.5rem; margin: 0; color: #ff758c; }
    header p { color: #aaa; margin: 10px 0 0 0; }

    .status { text-align: center; padding: 4rem; color: #888; background: #1a1a1a; border-radius: 12px; }
    .error { color: #ff4d4f; }
    .shop-btn { display: inline-block; margin-top: 1.5rem; padding: 10px 25px; background: #1db954; color: white; text-decoration: none; border-radius: 50px; font-weight: bold; }

    .orders-list { display: flex; flex-direction: column; gap: 2rem; }
    .order-card { background: #222; border-radius: 16px; border: 1px solid #333; overflow: hidden; }
    
    .order-header { padding: 1.5rem; background: #2a2a2a; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
    .order-id { color: #888; font-family: monospace; font-size: 0.9em; display: block; }
    .order-date { color: #ccc; font-size: 0.95em; }
    .order-total { font-size: 1.4rem; font-weight: bold; color: #ff7eb3; }

    .order-body { padding: 1rem 1.5rem; }
    .item-row { display: flex; align-items: center; gap: 15px; padding: 1rem 0; border-bottom: 1px solid #2a2a2a; }
    .item-row:last-child { border-bottom: none; }
    
    .item-img { width: 50px; height: 50px; border-radius: 6px; overflow: hidden; background: #111; flex-shrink: 0; }
    .item-img img { width: 100%; height: 100%; object-fit: cover; }
    .placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }

    .item-info { flex: 1; }
    .item-info .name { margin: 0; font-weight: bold; font-size: 1em; }
    .item-info .price-qty { margin: 4px 0 0 0; color: #888; font-size: 0.85em; }
    .item-subtotal { font-weight: bold; color: #eee; }
</style>