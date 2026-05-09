<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

    let allUsers: any[] = $state([]);
    let loading = $state(true);
    let processingId = $state<string | null>(null);

    onMount(async () => {
        await fetchUsers();
    });

    async function fetchUsers() {
        try {
            const res = await fetch('http://127.0.0.1:8787/api/users');
            const data = await res.json();
            if (data.success) allUsers = data.data;
        } catch (e) { console.error(e); }
        loading = false;
    }

    async function updateStatus(userId: string, newStatus: string) {
        const adminId = adminAuthState.currentAdmin?.id;
        
        processingId = userId;
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, adminId: adminId })
            });
            const data = await res.json();
            if (data.success) {
                allUsers = allUsers.map(u => u.id === userId ? { ...u, accountStatus: newStatus } : u);
            }
        } catch (e) { alert("An error occurred"); }
        processingId = null;
    }
</script>

<div class="max-w-6xl mx-auto flex flex-col gap-10">
    <nav>
        <a href="/admin" class="text-primary hover:underline font-bold flex items-center gap-2">
            <span>&lsaquo;</span> Back to Dashboard
        </a>
    </nav>
    
    <header>
        <h1 class="text-4xl font-black tracking-tight mb-2">👤 User Management</h1>
        <p class="text-text-muted font-medium">Monitor and control system account statuses</p>
    </header>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading users...</p>
        </div>
    {:else}
        <div class="bg-bg-elevated rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
            <table class="w-full border-collapse text-left">
                <thead>
                    <tr class="bg-bg-highlight/50 text-xs font-bold text-text-muted uppercase tracking-widest border-b border-white/5">
                        <th class="p-6">User</th>
                        <th class="p-6">Email</th>
                        <th class="p-6">Joined Date</th>
                        <th class="p-6">Status</th>
                        <th class="p-6 text-right">Action</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                    {#each allUsers as user}
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="p-6">
                                <div class="flex flex-col">
                                    <span class="font-bold text-white">{user.displayName || user.username}</span>
                                    <span class="text-xs text-text-muted">@{user.username}</span>
                                </div>
                            </td>
                            <td class="p-6 text-sm text-text-muted">{user.email}</td>
                            <td class="p-6 text-sm text-text-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
                            <td class="p-6">
                                <span class="text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase {user.accountStatus === 'active' ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-400'}">
                                    {user.accountStatus}
                                </span>
                            </td>
                            <td class="p-6 text-right">
                                {#if user.accountStatus === 'active'}
                                    <button 
                                        class="text-xs font-black px-4 py-2 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50" 
                                        onclick={() => updateStatus(user.id, 'suspended')} 
                                        disabled={processingId === user.id}
                                    >
                                        SUSPEND
                                    </button>
                                {:else}
                                    <button 
                                        class="text-xs font-black px-4 py-2 rounded-lg border border-primary/50 text-primary hover:bg-primary hover:text-black transition-all disabled:opacity-50" 
                                        onclick={() => updateStatus(user.id, 'active')} 
                                        disabled={processingId === user.id}
                                    >
                                        ACTIVATE
                                    </button>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>
