<script lang="ts">
    import { onMount } from 'svelte';
    import { authState } from '$lib/auth.svelte';

    // States สำหรับเก็บข้อมูลแต่ละหมวด
    let isLoading = $state(true);
    let subData = $state<any>(null);
    let recentTracks = $state<any[]>([]);
    let topArtists = $state<any[]>([]);
    let orderHistory = $state<any[]>([]);
    
    // States สำหรับนับจำนวนใน Library
    let playlistsCount = $state(0);
    let likedSongsCount = $state(0);
    let followingCount = $state(0);

    let fetchErrors = $state<string[]>([]);

    onMount(async () => {
        if (!authState.currentUser?.id) {
            isLoading = false;
            return;
        }

        const userId = authState.currentUser.id;
        
        try {
            // ใช้ Promise.allSettled เพื่อดึงข้อมูลทุกเส้นพร้อมกัน (ถ้าระบบไหนพัง ระบบอื่นยังรอด)
            const results = await Promise.allSettled([
                fetch(`http://127.0.0.1:8787/api/users/${userId}/subscription`).then(r => r.json()),
                fetch(`http://127.0.0.1:8787/api/users/${userId}/history`).then(r => r.json()),
                fetch(`http://127.0.0.1:8787/api/users/${userId}/analytics`).then(r => r.json()),
                fetch(`http://127.0.0.1:8787/api/users/${userId}/purchases`).then(r => r.json()),
                fetch(`http://127.0.0.1:8787/api/users/${userId}/favorites`).then(r => r.json()),
                fetch(`http://127.0.0.1:8787/api/users/${userId}/follows`).then(r => r.json()),
                fetch(`http://127.0.0.1:8787/api/users/${userId}/playlists`).then(r => r.json())
            ]);

            // แกะกล่องข้อมูล
            if (results[0].status === 'fulfilled' && results[0].value.success) subData = results[0].value.data;
            if (results[1].status === 'fulfilled' && results[1].value.success) recentTracks = results[1].value.data;
            if (results[2].status === 'fulfilled' && results[2].value.success) topArtists = results[2].value.data.topArtists || [];
            if (results[3].status === 'fulfilled' && results[3].value.success) orderHistory = results[3].value.data;
            
            // นับจำนวน Library
            if (results[4].status === 'fulfilled' && results[4].value.success) likedSongsCount = results[4].value.data.length;
            if (results[5].status === 'fulfilled' && results[5].value.success) followingCount = results[5].value.data.length;
            if (results[6].status === 'fulfilled' && results[6].value.success) playlistsCount = results[6].value.data.length;

            // ตรวจสอบ Error ย่อย
            results.forEach((res, idx) => {
                if (res.status === 'rejected' || (res.status === 'fulfilled' && !res.value.success)) {
                    fetchErrors.push(`API Mod [${idx}] Failed`);
                }
            });

        } catch (error) {
            console.error("Profile fetch error:", error);
        } finally {
            isLoading = false;
        }
    });

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
</script>

<div class="max-w-6xl mx-auto p-4 md:p-8 text-white font-sans">
    {#if isLoading}
        <div class="flex flex-col items-center justify-center h-[60vh] gap-4 text-primary">
            <div class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p class="font-bold tracking-widest uppercase text-sm">Loading Profile...</p>
        </div>
    {:else if !authState.currentUser}
        <div class="text-center py-20 bg-neutral-900 rounded-2xl border border-white/5 shadow-2xl">
            <span class="text-6xl mb-4 block">🔒</span>
            <h1 class="text-3xl font-black mb-2">Access Denied</h1>
            <p class="text-neutral-400 mb-6">Please log in to view your personal dashboard.</p>
            <a href="/login" class="bg-primary hover:bg-primary/80 text-black px-8 py-3 rounded-full font-bold transition-colors">Log In Now</a>
        </div>
    {:else}
        
        {#if fetchErrors.length > 0}
            <div class="bg-red-900/20 border border-red-500/30 text-red-400 p-3 rounded-lg mb-6 text-sm font-mono">
                ⚠️ Partial Data Load: {fetchErrors.join(', ')}
            </div>
        {/if}

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div class="lg:col-span-4 flex flex-col gap-6">
                <div class="bg-neutral-900 rounded-3xl p-8 border border-white/5 shadow-xl text-center relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent"></div>
                    
                    <div class="relative w-32 h-32 mx-auto rounded-full bg-neutral-800 border-4 border-neutral-900 shadow-2xl mb-4 flex items-center justify-center overflow-hidden">
                        {#if authState.currentUser.pfpUrl || authState.currentUser.pfp_url}
                            <img src={authState.currentUser.pfpUrl || authState.currentUser.pfp_url} alt="Avatar" class="w-full h-full object-cover" />
                        {:else}
                            <span class="text-5xl font-black text-primary">{authState.currentUser.username.charAt(0).toUpperCase()}</span>
                        {/if}
                    </div>
                    
                    <h1 class="text-3xl font-black mb-1 relative">{authState.currentUser.displayName || authState.currentUser.username}</h1>
                    <p class="text-neutral-400 text-sm relative mb-6">@{authState.currentUser.username}</p>
                    
                    {#if subData && subData.isExpiringSoon !== undefined}
                        <div class="inline-block px-4 py-2 rounded-full {subData.isExpiringSoon ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-primary/20 text-primary border border-primary/30'} text-sm font-bold tracking-wide">
                            👑 {subData.plan.name} 
                            <span class="block text-xs mt-1 font-normal">
                                {subData.isExpiringSoon ? `Expires in ${subData.daysRemaining} days` : `Active until ${formatDate(subData.userSub.expiryDate)}`}
                            </span>
                        </div>
                    {:else}
                        <div class="inline-block px-4 py-2 rounded-full bg-neutral-800 text-neutral-400 text-sm font-bold tracking-wide border border-white/5">
                            Standard Free Tier
                        </div>
                    {/if}
                </div>

                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-neutral-900 p-4 rounded-2xl border border-white/5 text-center hover:bg-neutral-800 transition-colors cursor-pointer" onclick={() => window.location.href='/favorites'}>
                        <span class="text-primary text-xl block mb-1">❤️</span>
                        <h3 class="text-2xl font-black">{likedSongsCount}</h3>
                        <p class="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mt-1">Likes</p>
                    </div>
                    <div class="bg-neutral-900 p-4 rounded-2xl border border-white/5 text-center hover:bg-neutral-800 transition-colors cursor-pointer" onclick={() => window.location.href='/following'}>
                        <span class="text-primary text-xl block mb-1">🎤</span>
                        <h3 class="text-2xl font-black">{followingCount}</h3>
                        <p class="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mt-1">Follows</p>
                    </div>
                    <div class="bg-neutral-900 p-4 rounded-2xl border border-white/5 text-center hover:bg-neutral-800 transition-colors">
                        <span class="text-primary text-xl block mb-1">💽</span>
                        <h3 class="text-2xl font-black">{playlistsCount}</h3>
                        <p class="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mt-1">Playlists</p>
                    </div>
                </div>

                <div class="bg-neutral-900 rounded-3xl p-4 border border-white/5 flex flex-col gap-2">
                    <a href="/profile/analytics" class="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors text-sm font-bold text-neutral-300">
                        <span>📊 Detailed Analytics</span>
                        <span class="text-neutral-500">&rsaquo;</span>
                    </a>
                    <a href="/subscriptions" class="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors text-sm font-bold text-neutral-300">
                        <span>💳 Manage Subscription</span>
                        <span class="text-neutral-500">&rsaquo;</span>
                    </a>
                </div>
            </div>

            <div class="lg:col-span-8 flex flex-col gap-8">
                
                <div class="bg-neutral-900 p-8 rounded-3xl border border-white/5 shadow-xl">
                    <div class="flex items-end justify-between mb-6">
                        <div>
                            <h2 class="text-2xl font-black">Recently Played</h2>
                            <p class="text-sm text-neutral-400">Your latest audio journey</p>
                        </div>
                    </div>

                    {#if recentTracks.length === 0}
                        <div class="text-center py-8 text-neutral-500 italic text-sm bg-neutral-800/50 rounded-xl">No listening history yet.</div>
                    {:else}
                        <div class="flex flex-col gap-2">
                            {#each recentTracks.slice(0, 5) as track, i}
                                <div class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors group">
                                    <span class="text-neutral-600 font-bold w-6 text-right group-hover:text-primary">{i + 1}</span>
                                    <div class="w-10 h-10 bg-neutral-800 rounded flex-shrink-0 flex items-center justify-center text-xs shadow-md border border-white/5">🎵</div>
                                    <div class="flex-1 min-w-0">
                                        <p class="font-bold text-sm truncate text-white group-hover:text-primary transition-colors">{track.title}</p>
                                        <p class="text-xs text-neutral-500 truncate">{track.duration}</p>
                                    </div>
                                    <button class="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-primary hover:text-primary text-neutral-400">
                                        ▶
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="bg-neutral-900 p-8 rounded-3xl border border-white/5 shadow-xl">
                    <div class="flex items-end justify-between mb-6">
                        <div>
                            <h2 class="text-2xl font-black">Merchandise Orders</h2>
                            <p class="text-sm text-neutral-400">Your Kawii Store purchases</p>
                        </div>
                        <a href="/profile/orders" class="text-xs font-bold text-primary hover:underline tracking-widest uppercase">View All</a>
                    </div>

                    {#if orderHistory.length === 0}
                        <div class="text-center py-10 bg-neutral-800/50 rounded-xl border border-dashed border-neutral-700">
                            <span class="text-3xl block mb-2 opacity-50">🛍️</span>
                            <p class="text-sm text-neutral-400 mb-4">You haven't bought any merch yet.</p>
                            <a href="/merch" class="inline-block px-6 py-2 bg-white text-black text-sm font-bold rounded-full hover:scale-105 transition-transform">Go to Store</a>
                        </div>
                    {:else}
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="border-b border-white/10 text-xs uppercase tracking-widest text-neutral-500">
                                        <th class="pb-3 font-bold">Order ID</th>
                                        <th class="pb-3 font-bold">Date</th>
                                        <th class="pb-3 font-bold text-center">Items</th>
                                        <th class="pb-3 font-bold text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each orderHistory.slice(0, 4) as order}
                                        <tr class="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                            <td class="py-4 font-mono text-xs text-neutral-400 group-hover:text-primary">{order.id.slice(0,8)}</td>
                                            <td class="py-4 text-sm text-neutral-300">{formatDate(order.timePurchase)}</td>
                                            <td class="py-4 text-sm text-center text-neutral-300">{order.totalItemCount}</td>
                                            <td class="py-4 text-sm font-bold text-primary text-right">฿{Number(order.totalPrice).toLocaleString()}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </div>

            </div>
        </div>
    {/if}
</div>
