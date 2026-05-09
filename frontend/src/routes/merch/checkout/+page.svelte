<script lang="ts">
    import { onMount } from 'svelte';
    import { authState } from '$lib/auth.svelte';

    let cart: any[] = $state([]);
    let isCheckingOut = $state(false);
    let error: string | null = $state(null);
    let success = $state(false);
    let transactionData: any = $state(null);

    // ดึงตะกร้าจาก LocalStorage ตอนโหลดหน้า
    onMount(() => {
        const savedCart = localStorage.getItem('kawii_cart');
        if (savedCart) {
            cart = JSON.parse(savedCart);
        }
    });

    // ใช้ $derived คำนวณยอดรวมและจำนวนชิ้นแบบ Real-time
    let totalAmount = $derived(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0));
    let totalItems = $derived(cart.reduce((sum, item) => sum + item.quantity, 0));

    function removeItem(index: number) {
        cart.splice(index, 1);
        localStorage.setItem('kawii_cart', JSON.stringify(cart));
    }

    async function handleCheckout() {
        if (!authState.currentUser) {
            alert("กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ 🛒");
            return;
        }

        isCheckingOut = true;
        error = null;

        try {
            const res = await fetch('http://127.0.0.1:8787/api/merch/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: authState.currentUser.id, 
                    // ส่งไปแค่ itemId และ quantity ให้ Backend ไปดึงราคาจริงมาทำ Snapshot ป้องกันการโกง
                    cart: cart.map(c => ({ itemId: c.itemId, quantity: c.quantity })) 
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                success = true;
                transactionData = data.transaction;
                cart = []; // ล้างตะกร้าใน State
                localStorage.removeItem('kawii_cart'); // ล้างตะกร้าในเครื่อง
            } else {
                error = data.error;
            }
        } catch (err: any) {
            error = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้";
        } finally {
            isCheckingOut = false;
        }
    }
</script>

<div class="checkout-container">
    <nav class="breadcrumb">
        <a href="/merch">← กลับไปเลือกซื้อสินค้าต่อ</a>
    </nav>

    {#if success}
        <div class="success-box">
            <div class="icon">🎉</div>
            <h1>สั่งซื้อสำเร็จ!</h1>
            <p>ขอบคุณที่สนับสนุนศิลปินคนโปรดของคุณ</p>
            <div class="receipt">
                <p><strong>รหัสอ้างอิง (Transaction ID):</strong> {transactionData.id}</p>
                <p><strong>จำนวนสินค้า:</strong> {transactionData.totalItemCount} ชิ้น</p>
                <p><strong>ยอดชำระเงิน:</strong> ฿{Number(transactionData.totalPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
            </div>
            <a href="/merch" class="back-btn">กลับไปหน้าร้านค้า</a>
        </div>
    {:else}
        <header>
            <h1>🛒 ตะกร้าสินค้าของคุณ</h1>
            <p>ตรวจสอบรายการสินค้าก่อนชำระเงิน</p>
        </header>

        {#if error}
            <div class="error-msg">{error}</div>
        {/if}

        {#if cart.length === 0}
            <div class="empty-cart">
                <span style="font-size: 4em;">🛍️</span>
                <h2>ตะกร้าว่างเปล่า</h2>
                <p>ยังไม่มีสินค้าในตะกร้าเลย ไปเลือกสินค้าสุดชิคกันเถอะ!</p>
                <a href="/merch" class="browse-btn">เลือกซื้อสินค้า</a>
            </div>
        {:else}
            <div class="checkout-layout">
                <div class="cart-items">
                    {#each cart as item, index}
                        <div class="cart-item">
                            <div class="item-img">
                                {#if item.imgUrl}
                                    <img src={item.imgUrl} alt={item.name} />
                                {:else}
                                    <div class="placeholder">รูปภาพ</div>
                                {/if}
                            </div>
                            <div class="item-details">
                                <h3>{item.name}</h3>
                                <p class="price">฿{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div class="item-actions">
                                <span class="qty">x {item.quantity}</span>
                                <button class="remove-btn" onclick={() => removeItem(index)}>🗑️ ลบ</button>
                            </div>
                        </div>
                    {/each}
                </div>

                <div class="summary-box">
                    <h2>สรุปคำสั่งซื้อ</h2>
                    <div class="summary-row">
                        <span>จำนวนสินค้า</span>
                        <span>{totalItems} ชิ้น</span>
                    </div>
                    <div class="summary-row total">
                        <span>ยอดชำระสุทธิ</span>
                        <span>฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    {#if !authState.currentUser}
                        <div class="login-warning">กรุณาเข้าสู่ระบบเพื่อชำระเงิน</div>
                    {/if}

                    <button 
                        class="checkout-btn" 
                        onclick={handleCheckout} 
                        disabled={isCheckingOut || !authState.currentUser}
                    >
                        {isCheckingOut ? 'กำลังดำเนินการ...' : '💳 ยืนยันการชำระเงิน'}
                    </button>
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .checkout-container {
        padding: 2rem;
        max-width: 1000px;
        margin: 0 auto;
        color: #fff;
        font-family: sans-serif;
    }
    
    .breadcrumb { margin-bottom: 2rem; }
    .breadcrumb a { color: #ff758c; text-decoration: none; font-weight: bold; }
    .breadcrumb a:hover { color: #ff7eb3; text-decoration: underline; }

    header { margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; }
    h1 { font-size: 2.2rem; margin: 0 0 0.5rem 0; color: #fff; }
    header p { color: #aaa; margin: 0; }

    .error-msg { background: #fee2e2; color: #dc2626; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-weight: bold; }

    .empty-cart { text-align: center; padding: 4rem 0; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px dashed #555; }
    .browse-btn { display: inline-block; margin-top: 1rem; padding: 10px 25px; background: #1db954; color: #fff; text-decoration: none; border-radius: 50px; font-weight: bold; }

    .checkout-layout { display: grid; grid-template-columns: 1fr 350px; gap: 2rem; }
    @media (max-width: 768px) { .checkout-layout { grid-template-columns: 1fr; } }

    .cart-items { display: flex; flex-direction: column; gap: 1rem; }
    .cart-item { display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 12px; }
    .item-img { width: 80px; height: 80px; border-radius: 8px; overflow: hidden; background: #222; }
    .item-img img { width: 100%; height: 100%; object-fit: cover; }
    .placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #555; font-size: 0.8rem; }
    
    .item-details { flex: 1; }
    .item-details h3 { margin: 0 0 5px 0; font-size: 1.1rem; }
    .price { color: #ff7eb3; font-weight: bold; margin: 0; }
    
    .item-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .qty { font-weight: bold; color: #ccc; }
    .remove-btn { background: transparent; border: 1px solid #dc2626; color: #dc2626; padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
    .remove-btn:hover { background: #dc2626; color: white; }

    .summary-box { background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); align-self: start; }
    .summary-box h2 { margin: 0 0 1.5rem 0; font-size: 1.3rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
    .summary-row { display: flex; justify-content: space-between; margin-bottom: 1rem; color: #ccc; }
    .summary-row.total { font-size: 1.4rem; font-weight: bold; color: #fff; margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; }
    
    .checkout-btn { width: 100%; padding: 1rem; background: linear-gradient(90deg, #ff7eb3, #ff758c); border: none; border-radius: 8px; color: white; font-weight: bold; font-size: 1.1rem; cursor: pointer; margin-top: 1rem; }
    .checkout-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .login-warning { color: #fbbf24; font-size: 0.9rem; text-align: center; margin-top: 1rem; }

    .success-box { text-align: center; padding: 4rem 2rem; background: rgba(29, 185, 84, 0.1); border: 1px solid #1db954; border-radius: 16px; }
    .success-box .icon { font-size: 5rem; margin-bottom: 1rem; }
    .success-box h1 { color: #1db954; }
    .receipt { background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 8px; margin: 2rem auto; max-width: 400px; text-align: left; }
    .receipt p { margin: 0.5rem 0; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
    .back-btn { display: inline-block; padding: 10px 30px; background: #fff; color: #000; font-weight: bold; border-radius: 50px; text-decoration: none; margin-top: 1rem; }
</style>