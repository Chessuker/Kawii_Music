<script lang="ts">
  import { onMount } from 'svelte';

  let logs = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // --- States สำหรับการค้นหาและกรองข้อมูล ---
  let searchQuery = $state('');
  let filterRole = $state('all');
  let filterAction = $state('all');

  // --- States สำหรับระบบแบ่งหน้า (Pagination) ---
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
      error = "ไม่สามารถดึงข้อมูล Log ได้";
    } finally {
      loading = false;
    }
  }

  // --- ระบบ Filter แบบ Real-time (ทำงานทันทีที่พิมพ์หรือเลือก Dropdown) ---
  let filteredLogs = $derived(logs.filter(log => {
    const matchSearch = 
      (log.actorName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
      (log.actionDetail?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchRole = filterRole === 'all' ? true : log.actorType === filterRole;
    const matchAction = filterAction === 'all' ? true : log.actionType === filterAction;
    
    return matchSearch && matchRole && matchAction;
  }));

  // --- รีเซ็ตหน้ากลับไปหน้าที่ 1 เสมอเวลา Filter ข้อมูล ---
  $effect(() => {
    searchQuery; filterRole; filterAction; // จับตาดูตัวแปรเหล่านี้
    currentPage = 1; 
  });

  // --- คำนวณข้อมูลสำหรับแสดงผลในหน้านั้นๆ ---
  let totalPages = $derived(Math.ceil(filteredLogs.length / itemsPerPage) || 1);
  let paginatedLogs = $derived(filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('th-TH', {
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
      default: return '#8b5cf6'; // purple
    }
  }
</script>

<main class="admin-container">
  <div class="header-nav">
    <a href="/admin" class="back-link">← กลับไปหน้า Admin Dashboard</a>
  </div>
  
  <header style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
    <div>
      <h1>🛡️ Security & Audit Logs</h1>
      <p>ตรวจสอบประวัติการใช้งาน การแก้ไขระบบ และพฤติกรรมของผู้ใช้</p>
    </div>
    <button onclick={fetchLogs} class="refresh-btn">
      🔄 รีเฟรชข้อมูล
    </button>
  </header>

  <div class="controls-panel">
    <input 
      type="text" 
      bind:value={searchQuery} 
      placeholder="🔍 ค้นหาชื่อผู้ใช้ หรือ รายละเอียด..." 
      class="search-input"
    />
    
    <select bind:value={filterRole} class="filter-select">
      <option value="all">👥 ทุก Role</option>
      <option value="admin">🛡️ Admin เท่านั้น</option>
      <option value="user">👤 User ทั่วไป</option>
    </select>

    <select bind:value={filterAction} class="filter-select">
      <option value="all">⚡ ทุก Action</option>
      <option value="login">Login</option>
      <option value="logout">Logout</option>
      <option value="create">Create</option>
      <option value="update">Update</option>
      <option value="delete">Delete</option>
      <option value="ban">Ban</option>
    </select>
  </div>

  {#if loading}
    <div class="status">กำลังโหลด Logs...</div>
  {:else if error}
    <div class="status error">{error}</div>
  {:else}
    <div class="logs-table-wrapper">
      <table class="logs-table">
        <thead>
          <tr>
            <th>เวลา (Timestamp)</th>
            <th>ผู้กระทำ (Actor)</th>
            <th>บทบาท (Role)</th>
            <th>การกระทำ (Action)</th>
            <th>รายละเอียด (Details)</th>
          </tr>
        </thead>
        <tbody>
          {#if paginatedLogs.length === 0}
            <tr>
              <td colspan="5" style="text-align: center; padding: 3rem; color: #888;">
                ไม่พบประวัติที่ตรงกับการค้นหา
              </td>
            </tr>
          {:else}
            {#each paginatedLogs as log (log.id)}
              <tr>
                <td class="time">{formatDate(log.createdAt)}</td>
                <td class="actor">{log.actorName || 'System/Unknown'}</td>
                <td>
                  <span class="role-badge" class:role-admin={log.actorType === 'admin'}>
                    {log.actorType.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span class="action-badge" style="background: {getActionColor(log.actionType)}15; color: {getActionColor(log.actionType)}; border: 1px solid {getActionColor(log.actionType)}40;">
                    {log.actionType.toUpperCase()}
                  </span>
                </td>
                <td class="detail">{log.actionDetail || '-'}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <p style="margin: 0; color: #666; font-size: 0.9rem;">
        แสดง {filteredLogs.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} 
        ถึง {Math.min(currentPage * itemsPerPage, filteredLogs.length)} 
        จากทั้งหมด <strong>{filteredLogs.length}</strong> รายการ
      </p>
      
      <div class="page-controls">
        <button 
          disabled={currentPage === 1} 
          onclick={() => currentPage -= 1}
        >
          &laquo; ก่อนหน้า
        </button>
        <span class="page-info">หน้า {currentPage} / {totalPages}</span>
        <button 
          disabled={currentPage === totalPages} 
          onclick={() => currentPage += 1}
        >
          ถัดไป &raquo;
        </button>
      </div>
    </div>
  {/if}
</main>

<style>
  .admin-container {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    font-family: system-ui, -apple-system, sans-serif;
    color: #333;
  }
  .header-nav { margin-bottom: 2rem; }
  .back-link {
    color: #1db954;
    text-decoration: none;
    font-weight: bold;
    padding: 8px 15px;
    background: #e8f5e9;
    border-radius: 8px;
  }
  .back-link:hover { background: #c8e6c9; }
  
  h1 { font-size: 2rem; margin: 0 0 0.5rem 0; color: #1db954; }
  header p { color: #666; margin: 0; }
  
  .refresh-btn {
    padding: 10px 20px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  .refresh-btn:hover { background: #f9f9f9; border-color: #1db954; color: #1db954; }

  /* Control Panel Styles */
  .controls-panel {
    display: flex;
    gap: 15px;
    margin-bottom: 1.5rem;
    background: #f8f9fa;
    padding: 15px;
    border-radius: 12px;
    border: 1px solid #eee;
    flex-wrap: wrap;
  }
  .search-input {
    flex: 1;
    min-width: 250px;
    padding: 10px 15px;
    border: 1px solid #ccc;
    border-radius: 8px;
    outline: none;
  }
  .search-input:focus { border-color: #1db954; }
  .filter-select {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 8px;
    background: #fff;
    outline: none;
    cursor: pointer;
  }

  .status { text-align: center; padding: 3rem; color: #666; font-size: 1.1rem; }
  .error { color: #dc2626; }
  
  /* Table Styles */
  .logs-table-wrapper {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    overflow-x: auto;
    border: 1px solid #eee;
  }
  .logs-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  .logs-table th {
    background: #f8f9fa;
    padding: 1.2rem 1rem;
    font-weight: bold;
    color: #444;
    border-bottom: 2px solid #eaeaea;
  }
  .logs-table td {
    padding: 1rem;
    border-bottom: 1px solid #f5f5f5;
    vertical-align: middle;
  }
  .logs-table tr:hover { background: #fafafa; }
  
  .time { color: #777; font-size: 0.9rem; white-space: nowrap; }
  .actor { font-weight: bold; color: #222; }
  .detail { color: #555; max-width: 350px; line-height: 1.4; }
  
  .role-badge {
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
    background: #e5e7eb;
    color: #374151;
  }
  .role-admin { background: #fee2e2; color: #991b1b; }
  
  .action-badge {
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
  }

  /* Pagination Styles */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
    padding: 0 10px;
  }
  .page-controls {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  .page-controls button {
    padding: 8px 15px;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    color: #333;
  }
  .page-controls button:hover:not(:disabled) {
    background: #f0f0f0;
    border-color: #999;
  }
  .page-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .page-info {
    font-weight: bold;
    color: #555;
  }
</style>