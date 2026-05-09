<script lang="ts">
    import { loginUser } from '$lib/auth.svelte';

    let isLoginMode = $state(true);
    let username = $state('');
    let password = $state('');
    let email = $state('');
    let displayName = $state('');
    let pfpUrl = $state('');
    let message = $state('');
    let isProcessing = $state(false);

    async function handleSubmit(e: Event) {
        e.preventDefault();
        isProcessing = true;
        message = '';

        const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
        const payload = isLoginMode 
            ? { username, password } 
            : { email, username, password, displayName, pfpUrl };

        try {
            const res = await fetch(`http://127.0.0.1:8787${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                loginUser(data.user);
                message = isLoginMode ? 'เข้าสู่ระบบสำเร็จ! กำลังกลับไปหน้าแรก...' : 'สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...';
                setTimeout(() => { window.location.href = '/'; }, 1500); // กลับหน้าแรก
            } else {
                message = '❌ ' + data.error;
            }
        } catch (error) {
            message = '❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
        }
        isProcessing = false;
    }
</script>

<main style="max-width: 400px; margin: 80px auto; padding: 30px; background: #fff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); font-family: sans-serif;">
    <h2 style="text-align: center; color: #1db954;">
        {isLoginMode ? '🔑 เข้าสู่ระบบ' : '📝 สมัครสมาชิก'}
    </h2>

    <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
        {#if !isLoginMode}
            <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Email:</label>
                <input type="email" bind:value={email} required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
            </div>
            <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Display Name (ชื่อที่แสดง):</label>
                <input type="text" bind:value={displayName} required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
            </div>
            <div>
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">Profile Picture URL (Optional):</label>
                <input type="url" bind:value={pfpUrl} placeholder="https://example.com/image.jpg" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
            </div>
        {/if}

        <div>
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Username:</label>
            <input type="text" bind:value={username} required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
        </div>

        <div>
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Password:</label>
            <input type="password" bind:value={password} required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" />
        </div>

        <button type="submit" disabled={isProcessing} style="padding: 12px; background: #1db954; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 10px;">
            {isProcessing ? 'กำลังประมวลผล...' : (isLoginMode ? 'Login' : 'Register')}
        </button>
    </form>

    <div style="text-align: center; margin-top: 15px;">
        <button onclick={() => { isLoginMode = !isLoginMode; message = ''; }} style="background: none; border: none; color: #666; text-decoration: underline; cursor: pointer;">
            {isLoginMode ? 'ยังไม่มีบัญชี? สมัครสมาชิกที่นี่' : 'มีบัญชีแล้ว? เข้าสู่ระบบเลย'}
        </button>
    </div>

    {#if message}
        <div style="margin-top: 15px; padding: 10px; text-align: center; border-radius: 4px; background: #f4f4f9;">
            {message}
        </div>
    {/if}
</main>