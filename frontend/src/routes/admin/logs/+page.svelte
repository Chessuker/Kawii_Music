<script lang="ts">
  import { onMount } from 'svelte';
  import { adminAuthState } from '$lib/adminAuth.svelte';

  let logs = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // --- Search and Filter States ---
  let searchQuery = $state('');
  let filterRole = $state('all');
  let filterAction = $state('all');

  // --- Pagination States ---
  let currentPage = $state(1);
  let itemsPerPage = 15;

  onMount(async () => {
    await fetchLogs();
  });

  async function fetchLogs() {
    try {
      loading = true;
      const res = await fetch('http://127.0.0.1:8787/api/logs');
      const data = await res.json();
      if (data.success) {
        logs = data.data;
      } else {
        error = data.error;
      }
    } catch (err: any) {
      error = "Unable to fetch logs";
    } finally {
      loading = false;
    }
  }

  // --- Real-time Filter ---
  let filteredLogs = $derived(logs.filter(log => {
    const matchSearch = 
      (log.actorName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
      (log.actionDetail?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchRole = filterRole === 'all' ? true : log.actorType === filterRole;
    const matchAction = filterAction === 'all' ? true : log.actionType === filterAction;
    
    return matchSearch && matchRole && matchAction;
  }));

  $effect(() => {
    searchQuery; filterRole; filterAction;
    currentPage = 1; 
  });

  let totalPages = $derived(Math.ceil(filteredLogs.length / itemsPerPage) || 1);
  let paginatedLogs = $derived(filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function getActionColor(actionType: string) {
    switch(actionType) {
      case 'create': return '#10b981'; // green
      case 'update': return '#f59e0b'; // orange
      case 'delete': return '#ef4444'; // red
      case 'login': return '#3b82f6'; // blue
      case 'logout': return '#6b7280'; // gray
      case 'ban': return '#991b1b'; // dark red
      default: return '#a855f7'; // purple
    }
  }
</script>

<div class="max-w-6xl mx-auto flex flex-col gap-10">
  <nav>
    <a href="/admin" class="text-primary hover:underline font-bold flex items-center gap-2">
      <span>&lsaquo;</span> Back to Dashboard
    </a>
  </nav>
  
  <header class="flex flex-col md:flex-row md:items-end justify-between gap-6">
    <div>
      <h1 class="text-4xl font-black tracking-tight mb-2">🛡️ Security & Audit Logs</h1>
      <p class="text-text-muted font-medium">Review system activity, edits, and user behavior</p>
    </div>
    <button onclick={fetchLogs} class="bg-bg-elevated hover:bg-bg-highlight text-white px-6 py-3 rounded-full font-bold transition-all border border-white/5 shadow-xl">
      🔄 Refresh Data
    </button>
  </header>

  <!-- Admin Navigation Modules -->
  <section class="bg-bg-elevated p-6 rounded-2xl border border-white/5 shadow-2xl">
      <p class="text-xs uppercase tracking-widest text-text-muted font-bold mb-4">Quick Navigation</p>
      <div class="flex flex-wrap gap-3">
          <a href="/admin/tracks" class="nav-module-btn border-l-teal-500 hover:border-teal-500">🎵 Tracks</a>
          <a href="/admin/artists" class="nav-module-btn border-l-emerald-500 hover:border-emerald-500">🎤 Artists</a>
          <a href="/admin/albums" class="nav-module-btn border-l-sky-500 hover:border-sky-500">💿 Albums</a>
          <a href="/admin/users" class="nav-module-btn border-l-indigo-500 hover:border-indigo-500">👤 Users</a>
          <a href="/admin/merch" class="nav-module-btn border-l-primary hover:border-primary">🛍️ Store</a>
          <a href="/admin/orders" class="nav-module-btn border-l-amber-500 hover:border-amber-500">📦 Orders</a>
          <a href="/admin/ranking" class="nav-module-btn border-l-pink-500 hover:border-pink-500">🏆 Ranking</a>
          <a href="/admin/logs" class="nav-module-btn border-l-gray-500 bg-white/5 border-gray-500">🛡️ Logs</a>
      </div>
  </section>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-bg-elevated p-6 rounded-2xl border border-white/5 shadow-2xl">
    <div class="md:col-span-1 relative group">
      <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors">🔍</span>
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder="Search users or details..." 
        class="w-full bg-bg-highlight border-none rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
      />
    </div>
    
    <select bind:value={filterRole} class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer">
      <option value="all">👥 All Roles</option>
      <option value="admin">🛡️ Admins Only</option>
      <option value="user">👤 Users Only</option>
    </select>

    <select bind:value={filterAction} class="bg-bg-highlight border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer">
      <option value="all">⚡ All Actions</option>
      <option value="login">Login</option>
      <option value="logout">Logout</option>
      <option value="create">Create</option>
      <option value="update">Update</option>
      <option value="delete">Delete</option>
      <option value="ban">Ban</option>
    </select>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
        <p class="text-text-muted animate-pulse font-bold text-xl">Loading security logs...</p>
    </div>
  {:else if error}
    <div class="bg-red-500/10 text-red-400 p-8 rounded-2xl border border-red-500/20 text-center font-bold">
        {error}
    </div>
  {:else}
    <div class="bg-bg-elevated rounded-2xl border border-white/5 shadow-2xl overflow-hidden overflow-x-auto">
      <table class="w-full border-collapse text-left min-w-[800px]">
        <thead>
          <tr class="bg-bg-highlight/50 text-xs font-bold text-text-muted uppercase tracking-widest border-b border-white/5">
            <th class="p-6">Timestamp</th>
            <th class="p-6">Actor</th>
            <th class="p-6 text-center">Role</th>
            <th class="p-6 text-center">Action</th>
            <th class="p-6">Details</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          {#if paginatedLogs.length === 0}
            <tr>
              <td colspan="5" class="p-20 text-center text-text-muted italic">
                No logs found matching your criteria.
              </td>
            </tr>
          {:else}
            {#each paginatedLogs as log (log.id)}
              <tr class="hover:bg-white/5 transition-colors">
                <td class="p-6 text-xs font-mono text-text-muted">{formatDate(log.createdAt)}</td>
                <td class="p-6 font-bold text-white">{log.actorName || 'System/Unknown'}</td>
                <td class="p-6 text-center">
                  <span class="text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase {log.actorType === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-bg-highlight text-text-muted'}">
                    {log.actorType}
                  </span>
                </td>
                <td class="p-6 text-center">
                  <span class="text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase border" 
                        style="background: {getActionColor(log.actionType)}15; color: {getActionColor(log.actionType)}; border-color: {getActionColor(log.actionType)}40;">
                    {log.actionType}
                  </span>
                </td>
                <td class="p-6 text-sm text-text-muted leading-relaxed">{log.actionDetail || '-'}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <div class="flex flex-col md:flex-row justify-between items-center gap-6 mt-4 pb-10">
      <p class="text-xs font-bold text-text-muted uppercase tracking-widest">
        Showing {filteredLogs.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} 
        - {Math.min(currentPage * itemsPerPage, filteredLogs.length)} 
        of <span class="text-white">{filteredLogs.length}</span> records
      </p>
      
      <div class="flex items-center gap-4">
        <button 
          disabled={currentPage === 1} 
          onclick={() => currentPage -= 1}
          class="px-6 py-2 bg-bg-highlight hover:bg-bg-elevated border border-white/10 rounded-full font-bold transition-all disabled:opacity-30"
        >
          &laquo; Previous
        </button>
        <span class="text-sm font-bold text-text-muted uppercase tracking-widest">Page {currentPage} / {totalPages}</span>
        <button 
          disabled={currentPage === totalPages} 
          onclick={() => currentPage += 1}
          class="px-6 py-2 bg-bg-highlight hover:bg-bg-elevated border border-white/10 rounded-full font-bold transition-all disabled:opacity-30"
        >
          Next &raquo;
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
    @reference "../../layout.css";

    .nav-module-btn {
        @apply px-4 py-3 bg-bg-highlight text-white rounded-xl font-black text-sm border border-white/5 transition-all flex items-center gap-2 border-l-4;
    }
    
    .nav-module-btn:hover {
        @apply bg-white/10 -translate-y-1 shadow-xl;
    }
    
    .nav-module-btn:active {
        @apply translate-y-0;
    }
</style>
