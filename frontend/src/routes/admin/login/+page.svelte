<script lang="ts">
    import { adminAuthState } from '$lib/adminAuth.svelte';

    let username = $state('');
    let password = $state('');
    let error = $state('');
    let isLoading = $state(false);

    async function handleAdminLogin(e: Event) {
        e.preventDefault();
        isLoading = true;
        error = '';

        try {
            const res = await fetch('http://127.0.0.1:8787/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                // บันทึกแยกลง kawii_admin ไม่ทับกับ kawii_user
                localStorage.setItem('kawii_admin', JSON.stringify(data.admin));
                adminAuthState.currentAdmin = data.admin;
                window.location.href = '/admin'; // เด้งไปหน้า Dashboard
            } else {
                error = data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
            }
        } catch (err) {
            error = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        }
        isLoading = false;
    }
</script>

<main class="admin-login-container">
    <div class="login-box">
        <div class="lock-icon">🔒</div>
        <h1>Admin Portal</h1>
        <p>Restricted Area - Authorized Personnel Only</p>

        {#if error}
            <div class="error-msg">{error}</div>
        {/if}

        <form onsubmit={handleAdminLogin}>
            <div class="form-group">
                <label>Admin Username</label>
                <input type="text" bind:value={username} required />
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" bind:value={password} required />
            </div>
            
            <button type="submit" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Access Dashboard'}
            </button>
        </form>
        
        <a href="/" class="back-home">← กลับสู่หน้าหลักผู้ใช้งาน</a>
    </div>
</main>

<style>
    :global(body) { background: #f3f4f6; }
    .admin-login-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; background: #111; }
    .login-box { background: #fff; padding: 3rem; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%; max-width: 400px; text-align: center; }
    .lock-icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { margin: 0 0 5px 0; color: #dc2626; font-size: 1.8rem; text-transform: uppercase; letter-spacing: 2px; }
    p { color: #666; font-size: 0.85rem; margin-bottom: 2rem; }
    
    .error-msg { background: #fee2e2; color: #dc2626; padding: 10px; border-radius: 6px; margin-bottom: 1.5rem; font-weight: bold; font-size: 0.9em; }
    
    .form-group { text-align: left; margin-bottom: 1.5rem; }
    .form-group label { display: block; font-weight: bold; color: #333; margin-bottom: 5px; font-size: 0.9em; }
    .form-group input { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 1em; transition: border 0.2s; }
    .form-group input:focus { border-color: #dc2626; outline: none; }
    
    button { width: 100%; padding: 12px; background: #dc2626; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 1.1em; cursor: pointer; transition: background 0.2s; }
    button:hover:not(:disabled) { background: #b91c1c; }
    button:disabled { opacity: 0.7; cursor: not-allowed; }
    
    .back-home { display: block; margin-top: 1.5rem; color: #888; text-decoration: none; font-size: 0.9em; }
    .back-home:hover { text-decoration: underline; color: #333; }
</style>