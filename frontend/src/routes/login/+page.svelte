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
                message = isLoginMode ? '✅ Login successful!' : '✅ Registration successful!';
                setTimeout(() => { window.location.href = '/'; }, 1000);
            } else {
                message = '❌ ' + data.error;
            }
        } catch (error) {
            message = '❌ Server connection failed';
        }
        isProcessing = false;
    }
</script>

<div class="min-h-[80vh] flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-bg-elevated p-10 rounded-3xl shadow-2xl border border-white/5 flex flex-col gap-8">
        <div class="flex flex-col items-center gap-2">
            <span class="text-5xl mb-2">💜</span>
            <h1 class="text-3xl font-black tracking-tight">
                {isLoginMode ? 'Welcome back' : 'Join Kawii Music'}
            </h1>
            <p class="text-text-muted text-sm font-medium">
                {isLoginMode ? 'Log in to continue listening' : 'Create an account to get started'}
            </p>
        </div>

        <form onsubmit={handleSubmit} class="flex flex-col gap-5">
            {#if !isLoginMode}
                <div class="flex flex-col gap-1.5">
                    <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1" for="email">Email</label>
                    <input id="email" type="email" bind:value={email} required placeholder="you@example.com" class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all" />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1" for="display">Display Name</label>
                    <input id="display" type="text" bind:value={displayName} required placeholder="How should we call you?" class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all" />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1" for="pfp">Profile Picture URL</label>
                    <input id="pfp" type="url" bind:value={pfpUrl} placeholder="https://..." class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all" />
                </div>
            {/if}

            <div class="flex flex-col gap-1.5">
                <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1" for="username">Username</label>
                <input id="username" type="text" bind:value={username} required placeholder="Username" class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all" />
            </div>

            <div class="flex flex-col gap-1.5">
                <label class="text-xs font-bold uppercase tracking-wider text-text-muted ml-1" for="password">Password</label>
                <input id="password" type="password" bind:value={password} required placeholder="••••••••" class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all" />
            </div>

            <button type="submit" disabled={isProcessing} class="bg-primary hover:bg-primary-hover text-black font-black py-3.5 rounded-full mt-4 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                {isProcessing ? 'Processing...' : (isLoginMode ? 'Log In' : 'Sign Up')}
            </button>
        </form>

        <div class="flex flex-col items-center gap-4 border-t border-white/5 pt-6">
            <p class="text-text-muted text-sm font-medium">
                {isLoginMode ? "Don't have an account?" : "Already have an account?"}
            </p>
            <button 
                onclick={() => { isLoginMode = !isLoginMode; message = ''; }} 
                class="text-white font-bold hover:underline"
            >
                {isLoginMode ? 'Sign up for Kawii Music' : 'Log in here'}
            </button>
        </div>

        {#if message}
            <div class="p-4 rounded-xl text-center text-sm font-bold {message.includes('✅') ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'} animate-in fade-in slide-in-from-bottom-2 duration-300">
                {message}
            </div>
        {/if}
    </div>
</div>
