<script lang="ts">
    import { onMount } from 'svelte';
    import { authState } from '$lib/auth.svelte';

    let plans = $state<any[]>([]);
    let currentSub = $state<any>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let isSubscribing = $state(false);

    // 1. โหลดข้อมูลแพ็กเกจทันทีที่เข้าหน้าเว็บ
    onMount(async () => {
        await fetchPlans();
    });

    // 2. ใช้ $effect รอให้ระบบ Auth โหลดเสร็จก่อน ค่อยดึงข้อมูลแพ็กเกจปัจจุบันของ User
    $effect(() => {
        if (authState.currentUser?.id) {
            fetchCurrentSub();
        } else if (authState.currentUser === null) {
            currentSub = null; // ถ้ายูเซอร์ Logout ก็ให้เคลียร์ค่า
        }
    });

    async function fetchPlans() {
        try {
            loading = true;
            const res = await fetch('http://127.0.0.1:8787/api/subscriptions');
            const data = await res.json();
            if (data.success) {
                plans = data.data;
            } else {
                error = data.error;
            }
        } catch (err: any) {
            error = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
        } finally {
            loading = false;
        }
    }

    async function fetchCurrentSub() {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${authState.currentUser.id}/subscription`);
            const data = await res.json();
            if (data.success && data.isActive) {
                currentSub = data.data;
            } else {
                currentSub = null;
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleSubscribe(planId: string) {
        if (!authState.currentUser) {
            alert("กรุณาเข้าสู่ระบบก่อนสมัคร Premium 🎵");
            return;
        }

        isSubscribing = true;
        error = null;

        try {
            const res = await fetch('http://127.0.0.1:8787/api/subscriptions/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: authState.currentUser.id, subscriptionId: planId })
            });
            const data = await res.json();
            if (data.success) {
                alert("🎉 สมัคร Kawii Premium สำเร็จ ขอให้สนุกกับการฟังเพลงนะครับ!");
                await fetchCurrentSub(); // รีเฟรชสถานะด้านบน
            } else {
                alert(data.error || "เกิดข้อผิดพลาดในการสมัคร");
            }
        } catch (err: any) {
            alert("ไม่สามารถเชื่อมต่อกับระบบได้");
        } finally {
            isSubscribing = false;
        }
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }
</script>

<div class="sub-container">
    <header>
        <h1>💎 Kawii Premium</h1>
        <p>ปลดล็อกคุณภาพเสียงระดับสูงสุด ฟังเพลงแบบไม่มีโฆษณาคั่น และฟังออฟไลน์ได้ทุกที่</p>
    </header>

    {#if loading}
        <div class="status">กำลังโหลดแพ็กเกจ...</div>
    {:else if error}
        <div class="status error">{error}</div>
    {:else}
        
        {#if currentSub}
            <div class="active-sub-card" class:warning={currentSub.isExpiringSoon}>
                <div class="badge" class:expiring={currentSub.isExpiringSoon}>
                    {currentSub.isExpiringSoon ? '⏳ ใกล้หมดอายุ' : '👑 Premium Active'}
                </div>
                <h2 style="margin-top: 15px;">แพ็กเกจปัจจุบัน: {currentSub.plan.name}</h2>
                <p>
                    {currentSub.isExpiringSoon 
                        ? `รีบเลย! เหลือเวลาอีกเพียง ${currentSub.daysRemaining} วัน` 
                        : `ใช้งานได้ถึงวันที่ ${formatDate(currentSub.userSub.expiryDate)}`}
                </p>
                
                {#if currentSub.isExpiringSoon}
                    <div class="urgent-action">
                        <p>อย่าปล่อยให้เสียงเพลงหยุดลง ต่ออายุแพ็กเกจด้านล่างได้ทันที</p>
                    </div>
                {/if}
            </div>
        {/if}

        {#if plans.length === 0}
            <div class="status" style="background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px dashed #555;">
                <h2>ยังไม่มีแพ็กเกจในระบบ</h2>
                <p>แอดมินกำลังเตรียมแพ็กเกจสุดคุ้มให้คุณอยู่ โปรดรอติดตาม!</p>
            </div>
        {:else}
            <div class="plans-grid">
                {#each plans as plan (plan.id)}
                    <div class="plan-card" class:highlight={plan.durationDays >= 365}>
                        {#if plan.durationDays >= 365}
                            <div class="best-value">คุ้มค่าที่สุด 🔥</div>
                        {/if}
                        
                        <div class="plan-header">
                            <h2>{plan.name}</h2>
                            <div class="price">
                                <span class="currency">฿</span>
                                <span class="amount">{Number(plan.price).toLocaleString()}</span>
                            </div>
                            <p class="duration">สำหรับ {plan.durationDays} วัน</p>
                        </div>
                        
                        <div class="plan-body">
                            <ul>
                                <li><span class="check">✓</span> ฟังเพลงแบบไม่มีโฆษณา</li>
                                <li><span class="check">✓</span> ดาวน์โหลดไว้ฟังออฟไลน์</li>
                                <li><span class="check">✓</span> คุณภาพเสียงระดับ Hi-Res Audio</li>
                                <li><span class="check">✓</span> ปลดล็อกฟังได้ทุกอุปกรณ์</li>
                            </ul>
                            
                            <button 
                                class="btn subscribe-btn" 
                                onclick={() => handleSubscribe(plan.id)}
                                disabled={isSubscribing}
                            >
                                {isSubscribing ? 'กำลังดำเนินการ...' : (currentSub ? 'ขยายเวลาแพ็กเกจ' : 'สมัครเลย')}
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    .sub-container {
        padding: 3rem 2rem;
        max-width: 1000px;
        margin: 0 auto;
        color: #fff;
        font-family: sans-serif;
    }
    header {
        text-align: center;
        margin-bottom: 4rem;
    }
    h1 {
        font-size: 3rem;
        margin-bottom: 0.5rem;
        background: linear-gradient(135deg, #1db954 0%, #a6c1ee 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    header p { color: #ccc; font-size: 1.1rem; }
    .status { text-align: center; padding: 3rem; color: #888; font-size: 1.2rem; }
    .error { color: #ff4d4f; }
    
    .active-sub-card {
        background: linear-gradient(135deg, rgba(29, 185, 84, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
        border: 1px solid rgba(29, 185, 84, 0.3);
        border-radius: 16px;
        padding: 2rem;
        text-align: center;
        margin-bottom: 3rem;
        position: relative;
        overflow: hidden;
    }
    .active-sub-card h2 { margin: 0 0 0.5rem 0; color: #fff; }
    .active-sub-card p { color: #aaa; margin: 0; }
    .active-sub-card.warning {
        border: 2px solid #ffcc00;
        background: rgba(255, 204, 0, 0.1);
    }
    .badge {
        display: inline-block;
        background: #1db954;
        color: #fff;
        padding: 0.4rem 1rem;
        border-radius: 20px;
        font-weight: bold;
        font-size: 0.9rem;
        box-shadow: 0 4px 10px rgba(29, 185, 84, 0.3);
    }
    .badge.expiring {
        background: #ffcc00;
        color: #000;
    }
    .urgent-action {
        margin-top: 15px;
        font-weight: bold;
        color: #ffcc00;
    }

    .plans-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 2rem;
    }

    .plan-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        transition: transform 0.3s, box-shadow 0.3s;
        position: relative;
    }
    .plan-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        background: rgba(255, 255, 255, 0.05);
    }
    .plan-card.highlight {
        border-color: #1db954;
        background: linear-gradient(to bottom, rgba(29, 185, 84, 0.05), transparent);
    }
    
    .best-value {
        position: absolute;
        top: -15px;
        left: 50%;
        transform: translateX(-50%);
        background: #ff9800;
        color: white;
        padding: 5px 15px;
        border-radius: 20px;
        font-weight: bold;
        font-size: 0.85rem;
        box-shadow: 0 4px 10px rgba(255, 152, 0, 0.4);
    }

    .plan-header {
        padding: 2.5rem 2rem 1.5rem 2rem;
        text-align: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .plan-header h2 { font-size: 1.5rem; margin: 0 0 1rem 0; color: #eee; }
    .price { display: flex; justify-content: center; align-items: flex-start; margin-bottom: 0.5rem; }
    .currency { font-size: 1.5rem; margin-top: 0.5rem; color: #ccc; margin-right: 5px; }
    .amount { font-size: 3.5rem; font-weight: bold; line-height: 1; }
    .duration { color: #888; font-size: 1rem; margin: 0; }

    .plan-body {
        padding: 2rem;
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    ul { list-style: none; padding: 0; margin: 0 0 2rem 0; flex: 1; }
    li { margin-bottom: 1rem; color: #ccc; display: flex; align-items: center; gap: 0.8rem; }
    .check { color: #1db954; font-weight: bold; font-size: 1.2rem; }

    .subscribe-btn {
        width: 100%;
        padding: 1rem;
        border-radius: 8px;
        font-size: 1.1rem;
        font-weight: bold;
        border: none;
        cursor: pointer;
        background: #fff;
        color: #000;
        transition: all 0.2s;
    }
    .subscribe-btn:hover:not(:disabled) {
        background: #e0e0e0;
        transform: scale(1.02);
    }
    .plan-card.highlight .subscribe-btn {
        background: linear-gradient(135deg, #1db954 0%, #1976d2 100%);
        color: #fff;
    }
    .plan-card.highlight .subscribe-btn:hover:not(:disabled) { 
        filter: brightness(1.1); 
        box-shadow: 0 4px 15px rgba(29, 185, 84, 0.4);
    }
    .subscribe-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>