<script lang="ts">
  import { onMount } from 'svelte';
  
  let merchItems = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch('http://localhost:8787/api/merch');
      const data = await res.json();
      if (data.success) {
        merchItems = data.data;
      } else {
        error = data.error;
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
</script>

<div class="merch-container">
  <header>
    <h1>Kawii Store</h1>
    <p>Exclusive Artist Merchandise</p>
  </header>

  {#if loading}
    <div class="loading">Loading items...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if merchItems.length === 0}
    <div class="empty">No merchandise available right now.</div>
  {:else}
    <div class="grid">
      {#each merchItems as item (item.id)}
        <a href="/merch/{item.id}" class="card">
          <div class="img-wrapper">
            {#if item.imgUrl}
              <img src={item.imgUrl} alt={item.name} loading="lazy" />
            {:else}
              <div class="placeholder">No Image</div>
            {/if}
          </div>
          <div class="details">
            <h2>{item.name}</h2>
            <p class="price">${Number(item.price).toFixed(2)}</p>
            {#if item.artists && item.artists.length > 0}
              <p class="artists">By {item.artists.map(a => a.name).join(', ')}</p>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .merch-container {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    color: #fff;
  }
  header {
    text-align: center;
    margin-bottom: 3rem;
  }
  h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    background: linear-gradient(90deg, #ff7eb3, #ff758c);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p {
    color: #aaa;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 2rem;
  }
  .card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: transform 0.2s, background 0.2s;
    display: flex;
    flex-direction: column;
  }
  .card:hover {
    transform: translateY(-5px);
    background: rgba(255, 255, 255, 0.1);
  }
  .img-wrapper {
    aspect-ratio: 1;
    background: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .img-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .placeholder {
    color: #555;
    font-size: 0.9rem;
  }
  .details {
    padding: 1.5rem;
  }
  .details h2 {
    font-size: 1.2rem;
    margin: 0 0 0.5rem 0;
  }
  .price {
    font-size: 1.5rem;
    font-weight: bold;
    color: #ff758c;
    margin: 0 0 0.5rem 0;
  }
  .artists {
    font-size: 0.85rem;
    color: #888;
    margin: 0;
  }
  .loading, .error, .empty {
    text-align: center;
    padding: 3rem;
    color: #888;
  }
  .error { color: #ff4d4f; }
</style>