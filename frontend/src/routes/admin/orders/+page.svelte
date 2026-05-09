<script lang="ts">
    import { onMount } from 'svelte';
    import { adminAuthState } from '$lib/adminAuth.svelte';

    let orders: any[] = $state([]);
    let loading = $state(true);

    onMount(async () => {
        await fetchAllOrders();
    });

    async function fetchAllOrders() {
        try {
            const res = await fetch('http://127.0.0.1:8787/api/admin/orders');
            const data = await res.json();
            if (data.success) {
                orders = data.data;
            }
        } catch (e) { console.error(e); }
        loading = false;
    }

    async function cancelOrder(orderId: string) {
        if (!confirm("⚠️ Warning: Are you sure you want to cancel this order?\n\nAll billing information and product details will be permanently removed from the database and cannot be recovered.")) return;

        const adminId = adminAuthState.currentAdmin?.id;
        
        try {
            const res = await fetch(`http://127.0.0.1:8787/api/admin/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId })
            });
            const data = await res.json();
            
            if (data.success) {
                orders = orders.filter(o => o.order.id !== orderId);
                alert("✅ Order cancelled successfully");
            } else {
                alert("❌ " + data.error);
            }
        } catch (err) {
            alert("Connection error occurred");
        }
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
</script>

<div class="max-w-6xl mx-auto flex flex-col gap-10">
    <nav>
        <a href="/admin" class="text-primary hover:underline font-bold flex items-center gap-2">
            <span>&lsaquo;</span> Back to Dashboard
        </a>
    </nav>
    
    <header>
        <h1 class="text-4xl font-black tracking-tight mb-2">📦 Order Management</h1>
        <p class="text-text-muted font-medium">Verify sales and manage problematic billing</p>
    </header>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <p class="text-text-muted animate-pulse font-bold text-xl">Loading orders...</p>
        </div>
    {:else if orders.length === 0}
        <div class="flex flex-col items-center justify-center py-20 text-center gap-6 bg-bg-elevated/30 rounded-3xl border-2 border-dashed border-white/10">
            <span class="text-7xl opacity-50">🧾</span>
            <div>
                <h3 class="text-2xl font-bold mb-2">No orders in the system</h3>
                <p class="text-text-muted">Once users start buying merch, they will appear here.</p>
            </div>
        </div>
    {:else}
        <div class="bg-bg-elevated rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
            <table class="w-full border-collapse text-left">
                <thead>
                    <tr class="bg-bg-highlight/50 text-xs font-bold text-text-muted uppercase tracking-widest border-b border-white/5">
                        <th class="p-6">Order ID</th>
                        <th class="p-6">Time Purchase</th>
                        <th class="p-6">Customer</th>
                        <th class="p-6 text-center">Items</th>
                        <th class="p-6">Total (THB)</th>
                        <th class="p-6 text-right">Action</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                    {#each orders as item}
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="p-6">
                                <span class="font-mono text-xs text-text-muted">
                                    {item.order.id.slice(0, 13)}...
                                </span>
                            </td>
                            <td class="p-6 text-sm text-text-muted">
                                {formatDate(item.order.timePurchase)}
                            </td>
                            <td class="p-6">
                                <span class="font-bold text-white">{item.user.displayName || item.user.username}</span>
                            </td>
                            <td class="p-6 text-center font-bold">
                                {item.order.totalItemCount}
                            </td>
                            <td class="p-6">
                                <span class="font-black text-primary text-lg">
                                    ฿{Number(item.order.totalPrice).toLocaleString()}
                                </span>
                            </td>
                            <td class="p-6 text-right">
                                <button 
                                    class="text-xs font-black px-4 py-2 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-lg" 
                                    onclick={() => cancelOrder(item.order.id)}
                                >
                                    CANCEL BILL
                                </button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>
