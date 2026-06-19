<script lang="ts">
    import { page } from '$app/state';
    import { onMount } from 'svelte';

    let item: any = $state(null);
    let loading = $state(true);
    let error: string | null = $state(null);
    
    // State สำหรับตะกร้า
    let quantity = $state(1);
    let isAdding = $state(false);

    onMount(async () => {
        const id = page.params.id;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/merch/${id}`);
            const data = await res.json();
            if (data.success) {
                item = data.data;
            } else {
                error = data.error;
            }
        } catch (err: any) {
            error = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้";
        } finally {
            loading = false;
        }
    });

    function adjustQuantity(amount: number) {
        if (quantity + amount > 0) {
            quantity += amount;
        }
    }

    function addToCart() {
        isAdding = true;
        
        // ดึงตะกร้าเดิมจาก LocalStorage (ถ้ามี)
        let cart = JSON.parse(localStorage.getItem('kawii_cart') || '[]');
        
        // เช็กว่ามีสินค้านี้ในตะกร้าหรือยัง
        const existingItemIndex = cart.findIndex((c: any) => c.itemId === item.id);
        
        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += quantity;
        } else {
            cart.push({
                itemId: item.id,
                name: item.name,
                price: parseFloat(item.price),
                imgUrl: item.imgUrl,
                quantity: quantity
            });
        }
        
        localStorage.setItem('kawii_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cart-updated'));

        // หน่วงเวลาให้ปุ่มมี Effect นิดหน่อยเพื่อ UX ที่ดี
        setTimeout(() => {
            isAdding = false;
            alert(`✅ เพิ่ม ${item.name} ลงตะกร้าจำนวน ${quantity} ชิ้นเรียบร้อย!`);
        }, 300);
    }
</script>

<div class="item-container">
    <nav class="breadcrumb">
        <a href="/merch">← กลับไปหน้าร้านค้า</a>
    </nav>

    {#if loading}
        <div class="status-msg">กำลังโหลดข้อมูลสินค้า...</div>
    {:else if error}
        <div class="status-msg error">{error}</div>
    {:else if item}
        <div class="product-layout">
            <div class="image-section">
                {#if item.imgUrl || item.img_url}
                    <img src={item.imgUrl || item.img_url} alt={item.name} />
                {:else}
                    <div class="placeholder">ไม่มีรูปภาพ</div>
                {/if}
            </div>

            <div class="details-section">
                {#if item.artists && item.artists.length > 0}
                    <p class="artist-tag">
                        🎨 {item.artists.map((a: any) => a.name).join(', ')}
                    </p>
                {/if}
                
                <h1>{item.name}</h1>
                <p class="price">฿{Number(item.price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                
                <div class="divider"></div>
                
                <div class="cart-controls">
                    <span class="qty-label">จำนวน:</span>
                    <div class="qty-selector">
                        <button onclick={() => adjustQuantity(-1)}>−</button>
                        <span class="qty-display">{quantity}</span>
                        <button onclick={() => adjustQuantity(1)}>+</button>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="add-to-cart" onclick={addToCart} disabled={isAdding}>
                        {isAdding ? '⏳ กำลังเพิ่ม...' : '🛒 เพิ่มลงตะกร้า'}
                    </button>
                    <a href="/merch/checkout" class="buy-now">
                        💳 ตะกร้าสินค้า / ชำระเงิน
                    </a>
                </div>
                
                <div class="guarantee-box">
                    <p>🛡️ <strong>Secure Checkout:</strong> ข้อมูลการสั่งซื้อจะถูกบันทึก Snapshot ไว้ในฐานข้อมูลอย่างปลอดภัย</p>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .item-container {
        padding: 2rem;
        max-width: 1000px;
        margin: 0 auto;
        color: #fff;
        font-family: sans-serif;
    }
    
    .breadcrumb {
        margin-bottom: 2rem;
    }
    .breadcrumb a {
        color: #ff758c;
        text-decoration: none;
        font-weight: bold;
        transition: color 0.2s;
    }
    .breadcrumb a:hover {
        color: #ff7eb3;
    }

    .status-msg {
        text-align: center;
        padding: 5rem;
        color: #888;
        font-size: 1.2rem;
        background: #1a1a1a;
        border-radius: 12px;
    }
    .error { color: #ff4d4f; }

    .product-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4rem;
        background: rgba(255, 255, 255, 0.03);
        padding: 2.5rem;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    @media (max-width: 768px) {
        .product-layout {
            grid-template-columns: 1fr;
            gap: 2rem;
        }
    }

    .image-section {
        aspect-ratio: 1;
        background: #111;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .image-section img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .placeholder {
        color: #555;
        font-size: 1.2rem;
    }

    .details-section {
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .artist-tag {
        color: #aaa;
        font-size: 0.95rem;
        margin: 0 0 0.5rem 0;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    h1 {
        font-size: 2.5rem;
        margin: 0 0 1rem 0;
        line-height: 1.2;
    }

    .price {
        font-size: 2rem;
        font-weight: bold;
        color: #ff7eb3;
        margin: 0;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 2rem 0;
    }

    .cart-controls {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 2rem;
    }
    .qty-label {
        font-weight: bold;
        color: #ccc;
    }
    .qty-selector {
        display: flex;
        align-items: center;
        background: #222;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #333;
    }
    .qty-selector button {
        background: transparent;
        border: none;
        color: white;
        padding: 10px 20px;
        font-size: 1.2rem;
        cursor: pointer;
        transition: background 0.2s;
    }
    .qty-selector button:hover {
        background: #333;
    }
    .qty-display {
        width: 40px;
        text-align: center;
        font-weight: bold;
        font-size: 1.1rem;
    }

    .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .add-to-cart, .buy-now {
        padding: 15px;
        border-radius: 8px;
        font-size: 1.1rem;
        font-weight: bold;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        transition: all 0.2s;
        border: none;
    }

    .add-to-cart {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .add-to-cart:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
    }
    .add-to-cart:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .buy-now {
        background: linear-gradient(90deg, #ff7eb3, #ff758c);
        color: white;
        box-shadow: 0 4px 15px rgba(255, 117, 140, 0.3);
    }
    .buy-now:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(255, 117, 140, 0.5);
    }

    .guarantee-box {
        margin-top: 2rem;
        padding: 15px;
        background: rgba(29, 185, 84, 0.1);
        border: 1px solid rgba(29, 185, 84, 0.3);
        border-radius: 8px;
        color: #ddd;
        font-size: 0.85rem;
    }
    .guarantee-box p { margin: 0; }
</style>