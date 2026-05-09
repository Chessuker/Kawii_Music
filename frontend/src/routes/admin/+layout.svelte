<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { adminAuthState, initAdminAuth, logoutAdmin } from '$lib/adminAuth.svelte';

    let { children } = $props();
    let isChecking = $state(true);

    onMount(() => {
        initAdminAuth();
        isChecking = false;
    });

    // ตรวจสอบสิทธิ์ตลอดเวลา (Reactive Route Guard)
    $effect(() => {
        if (!isChecking) {
            const isLoginPage = page.url.pathname === '/admin/login';
            
            // ถ้าไม่ได้ล็อกอินแอดมิน และไม่ได้อยู่หน้า Login -> เด้งไปหน้า Login
            if (!adminAuthState.currentAdmin && !isLoginPage) {
                window.location.href = '/admin/login';
            }
            // ถ้าล็อกอินแอดมินแล้ว แต่เผลอกดเข้าหน้า Login -> เด้งกลับไป Dashboard
            else if (adminAuthState.currentAdmin && isLoginPage) {
                window.location.href = '/admin';
            }
        }
    });
</script>

{#if !isChecking}
    {#if adminAuthState.currentAdmin && page.url.pathname !== '/admin/login'}
        <div class="admin-global-topbar">
            <span>🛡️ ระบบจัดการ (Admin Mode) - ลงชื่อเข้าใช้โดย: <strong>{adminAuthState.currentAdmin.username}</strong></span>
            <button onclick={logoutAdmin}>ออกจากระบบแอดมิน</button>
        </div>
    {/if}

    {@render children()}
{/if}

<style>
    .admin-global-topbar {
        background: #111;
        color: #fff;
        padding: 8px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: sans-serif;
        font-size: 0.9em;
        border-bottom: 2px solid #dc2626;
        position: sticky;
        top: 0;
        z-index: 99999;
    }
    .admin-global-topbar button {
        background: transparent;
        border: 1px solid #666;
        color: #ccc;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
    }
    .admin-global-topbar button:hover {
        background: #dc2626;
        color: white;
        border-color: #dc2626;
    }
</style>