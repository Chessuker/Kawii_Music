<script lang="ts">
    import { playerState, playTrack, nextTrack, prevTrack } from '$lib/player.svelte';
    import { authState, initAuth, logoutUser } from '$lib/auth.svelte';
    import { onMount } from 'svelte';
    import './layout.css';
    
    let { children } = $props();

    onMount(() => {
        initAuth();
    });

    let audioRef = $state<HTMLAudioElement>();
    let currentTime = $state(0);
    let duration = $state(0);
    let volume = $state(0.6);

    let subInfo = $state<any>(null);
    let cartCount = $state(0);
    let currentTrackIdTracker = $state<string | number | null>(null);

    $effect(() => {
        if (authState.currentUser?.id) {
            fetchSubStatus(authState.currentUser.id);
        } else {
            subInfo = null;
        }

        // Update cart count from localStorage
        const updateCartCount = () => {
            const savedCart = localStorage.getItem('kawii_cart');
            if (savedCart) {
                const cart = JSON.parse(savedCart);
                cartCount = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
            } else {
                cartCount = 0;
            }
        };

        updateCartCount();
        
        // Listen for storage changes (works across tabs)
        window.addEventListener('storage', updateCartCount);
        // Also listen for custom event if we add items in the same tab
        window.addEventListener('cart-updated', updateCartCount);

        return () => {
            window.removeEventListener('storage', updateCartCount);
            window.removeEventListener('cart-updated', updateCartCount);
        };
    });

    async function fetchSubStatus(userId: string) {
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/users/${userId}/subscription`);
            const result = await res.json();
            if (result.success && result.isActive) {
                const expiryDate = new Date(result.data.userSub.expiryDate);
                const today = new Date();
                const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                subInfo = { 
                    ...result.data, 
                    daysRemaining,
                    isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0
                };
            }
        } catch (e) { console.error(e); }
    }

    function togglePlay() {
        if (!audioRef) return;
        if (playerState.isPlaying) {
            audioRef.pause();
        } else {
            audioRef.play().catch(() => {});
        }
    }

    function handleNext() {
        nextTrack();
    }

    function handlePrev() {
        const action = prevTrack(currentTime);
        if (action === "RESTART_SONG" && audioRef) {
            audioRef.currentTime = 0;
            audioRef.play().catch(() => {});
        }
    }

    function handleSeek(e: Event) {
        const target = e.target as HTMLInputElement;
        if (audioRef) audioRef.currentTime = parseFloat(target.value);
    }

    function formatTime(sec: number) {
        if (!sec || isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    $effect(() => {
        const currentId = playerState.currentTrack?.id;
        
        // ถ้ามีการเล่นเพลงอยู่ และ ID เพลงไม่ตรงกับที่จำไว้ (แปลว่าเพิ่งโดนเปลี่ยนเพลง)
        if (currentId && currentId !== currentTrackIdTracker) {
            currentTime = 0; // บังคับรีเซ็ตกรอเวลากลับไปที่ 00:00 ทันที
            currentTrackIdTracker = currentId; // อัปเดตความจำใหม่
        }
    });
</script>

<div class="flex h-screen overflow-hidden bg-bg-base text-text-base">
    <!-- Sidebar -->
    <aside class="w-64 flex flex-col bg-black p-6 gap-6 shrink-0">
        <a href="/" class="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight mb-2">
            <span class="text-3xl">💜</span>
            Kawii Music
        </a>

        <nav class="flex flex-col gap-4 text-text-muted font-bold">
            <a href="/" class="flex items-center gap-4 hover:text-text-base transition-colors duration-200">
                <span class="text-xl">🏠</span> Home
            </a>
            <a href="/artists" class="flex items-center gap-4 hover:text-text-base transition-colors duration-200">
                <span class="text-xl">🎤</span> Artists
            </a>
            <a href="/albums" class="flex items-center gap-4 hover:text-text-base transition-colors duration-200">
                <span class="text-xl">💿</span> Albums
            </a>
            <a href="/favorites" class="flex items-center gap-4 hover:text-text-base transition-colors duration-200">
                <span class="text-xl">💜</span> Favorites
            </a>
        </nav>

        <div class="h-[1px] bg-bg-highlight w-full my-2"></div>

        <nav class="flex flex-col gap-4 text-text-muted font-bold overflow-y-auto">
            <p class="text-xs uppercase tracking-widest text-text-muted/60 mb-2">Your Library</p>
            <a href="/following" class="flex items-center gap-4 hover:text-text-base transition-colors duration-200">
                <span>👥</span> Following
            </a>
            <a href="/subscriptions" class="flex items-center gap-4 hover:text-text-base transition-colors duration-200">
                <span>💎</span> Premium
            </a>
            <a href="/merch" class="flex items-center gap-4 hover:text-text-base transition-colors duration-200">
                <span>🛍️</span> Store
            </a>
            <a href="/admin" class="flex items-center gap-4 hover:text-text-base transition-colors duration-200">
                <span>⚙️</span> Admin
            </a>
        </nav>
    </aside>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col relative overflow-hidden">
        <!-- Top Nav -->
        <header class="h-16 flex items-center justify-between px-8 bg-bg-surface/80 backdrop-blur-md sticky top-0 z-50">
            <div class="flex items-center gap-4">
                <button class="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white" onclick={() => window.history.back()}>
                    &lsaquo;
                </button>
                <button class="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white" onclick={() => window.history.forward()}>
                    &rsaquo;
                </button>
            </div>

            <div class="flex items-center gap-4">
                <a href="/merch/checkout" class="w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-xl transition-colors relative" title="Shopping Cart">
                    🛒
                    {#if cartCount > 0}
                        <span class="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-bg-surface">
                            {cartCount > 99 ? '99+' : cartCount}
                        </span>
                    {/if}
                </a>

                {#if authState.currentUser}
                    <div class="flex items-center gap-4">
                        <a href="/profile" class="flex items-center gap-2 bg-black/50 py-1 pl-1 pr-3 rounded-full text-sm font-bold hover:bg-white/10 transition-colors">
                            {#if authState.currentUser.pfpUrl || authState.currentUser.pfp_url}
                                <img src={authState.currentUser.pfpUrl || authState.currentUser.pfp_url} alt="Profile" class="w-7 h-7 rounded-full object-cover" />
                            {:else}
                                <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs">👤</div>
                            {/if}
                            {authState.currentUser.displayName || authState.currentUser.username}
                        </a>
                        <button onclick={logoutUser} class="text-sm font-bold text-text-muted hover:text-text-base">Logout</button>
                    </div>
                {:else}
                    <a href="/login" class="bg-white text-black px-8 py-2.5 rounded-full font-bold hover:scale-105 active:scale-100 transition-transform">Log in</a>
                {/if}
            </div>
        </header>

        <!-- Page Content -->
        <main class="flex-1 overflow-y-auto bg-gradient-to-b from-bg-surface to-bg-base p-8 pb-32">
            {#if subInfo?.isExpiringSoon}
                <div class="bg-yellow-400 text-black text-center p-3 rounded-lg mb-8 font-bold text-sm shadow-lg">
                    ⚠️ Premium ของคุณกำลังจะหมดอายุใน {subInfo.daysRemaining} วัน 
                    <a href="/subscriptions" class="underline ml-2">ต่ออายุตอนนี้เพื่อฟังเพลงได้อย่างต่อเนื่อง!</a>
                </div>
            {/if}
            
            {@render children()}
        </main>
    </div>
</div>

<!-- Player Bar -->
{#if playerState.currentTrack}
    <div class="fixed bottom-0 left-0 right-0 h-24 bg-black border-t border-bg-highlight flex items-center justify-between px-4 z-[10000]">
        {#key playerState.currentTrack.id}
            <audio 
                bind:this={audioRef} 
                src={playerState.currentTrack.audio_url || playerState.currentTrack.audioUrl} 
                bind:currentTime={currentTime}
                bind:duration={duration}
                bind:volume={volume}
                onplay={() => playerState.isPlaying = true}
                onpause={() => playerState.isPlaying = false}
                onended={handleNext}
                autoplay
            ></audio>
        {/key}

        <!-- Track Info -->
        <div class="flex items-center gap-4 w-[30%] min-w-0">
            <div class="w-14 h-14 bg-bg-highlight rounded shadow-lg overflow-hidden shrink-0">
                {#if playerState.currentTrack.album?.imgUrl || playerState.currentTrack.album?.img_url}
                    <img src={playerState.currentTrack.album.imgUrl || playerState.currentTrack.album.img_url} alt="Cover" class="w-full h-full object-cover" />
                {:else}
                    <div class="w-full h-full flex items-center justify-center text-2xl">🎵</div>
                {/if}
            </div>
            <div class="min-w-0">
                <div class="font-bold text-sm text-white truncate hover:underline cursor-pointer">{playerState.currentTrack.title}</div>
                <div class="text-xs text-text-muted truncate hover:underline hover:text-white cursor-pointer">
                    {playerState.currentTrack.artists?.map((a:any) => a.name).join(', ') || 'Unknown Artist'}
                </div>
            </div>
            <button class="text-text-muted hover:text-primary transition-colors ml-2 text-xl">💜</button>
        </div>

        <!-- Controls -->
        <div class="flex flex-col items-center gap-2 max-w-[40%] w-full">
            <div class="flex items-center gap-6">
                <button onclick={handlePrev} class="text-text-muted hover:text-white text-xl transition-colors">⏮</button>
                <button onclick={togglePlay} class="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-100 transition-transform">
                    <span class="text-lg">{playerState.isPlaying ? '⏸' : '▶'}</span>
                </button>
                <button onclick={handleNext} class="text-text-muted hover:text-white text-xl transition-colors">⏭</button>
            </div>
            <div class="flex items-center gap-2 w-full max-w-md">
                <span class="text-[10px] text-text-muted min-w-[32px] text-right">{formatTime(currentTime)}</span>
                <div class="flex-1 h-1 relative group cursor-pointer">
                    <input 
                        type="range" 
                        min="0" 
                        max={duration || 100} 
                        value={currentTime} 
                        oninput={handleSeek} 
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div class="absolute inset-0 bg-bg-highlight rounded-full"></div>
                    <div class="absolute inset-y-0 left-0 bg-primary rounded-full group-hover:bg-primary-hover" style="width: {(currentTime / (duration || 1)) * 100}%"></div>
                    <div class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md hidden group-hover:block" style="left: {(currentTime / (duration || 1)) * 100}%"></div>
                </div>
                <span class="text-[10px] text-text-muted min-w-[32px]">{formatTime(duration)}</span>
            </div>
        </div>

        <!-- Volume & Extras -->
        <div class="flex justify-end items-center gap-3 w-[30%]">
            <span class="text-text-muted hover:text-white transition-colors cursor-pointer">🔊</span>
            <div class="w-24 h-1 relative group cursor-pointer">
                <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    bind:value={volume} 
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div class="absolute inset-0 bg-bg-highlight rounded-full"></div>
                <div class="absolute inset-y-0 left-0 bg-primary group-hover:bg-primary-hover rounded-full" style="width: {volume * 100}%"></div>
                <div class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md hidden group-hover:block" style="left: {volume * 100}%"></div>
            </div>
        </div>
    </div>
{/if}

<style>
    :global(html, body) {
        overflow: hidden;
        height: 100%;
    }

    input[type="range"]::-webkit-slider-thumb {
        appearance: none;
    }
</style>
