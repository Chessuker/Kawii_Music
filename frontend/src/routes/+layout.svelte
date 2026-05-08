<script lang="ts">
    import { playerState, playTrack, nextTrack, prevTrack } from '$lib/player.svelte';
    import { authState, initAuth, logoutUser } from '$lib/auth.svelte';
    import { onMount } from 'svelte';
    
    let { children } = $props();

    // 1. ดึงค่า User จาก LocalStorage ทันทีที่เว็บโหลดเสร็จ
    onMount(() => {
        initAuth();
    });

    // 2. State สำหรับ Custom Audio Player
    let audioRef: HTMLAudioElement;
    let currentTime = $state(0);
    let duration = $state(0);
    let volume = $state(0.6);

    // 👇 เปลี่ยนมาคุมแท็ก Audio แบบตรงไปตรงมา
    function togglePlay() {
        if (!audioRef) return;
        if (playerState.isPlaying) {
            audioRef.pause(); // สั่งหยุด
        } else {
            audioRef.play().catch(() => {}); // สั่งเล่น
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
</script>

<nav style="background: #121212; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; color: white;">
    
    <div style="display: flex; align-items: center; gap: 30px;">
        <a href="/" style="color: #1db954; font-weight: bold; font-size: 1.3em; text-decoration: none; letter-spacing: 1px;">Kawii Music</a>
        
        <div style="display: flex; gap: 20px; font-weight: bold; font-size: 0.95em;">
            <a href="/" style="color: #fff; text-decoration: none;">Home</a>
            <a href="/albums" style="color: #b3b3b3; text-decoration: none; transition: color 0.2s;" onmouseover={(e) => e.currentTarget.style.color = '#fff'} onmouseout={(e) => e.currentTarget.style.color = '#b3b3b3'} title="ดูอัลบั้มทั้งหมด">Albums</a>
        </div>
    </div>
    
    <div>
        {#if authState.currentUser}
            <span style="margin-right: 15px; color: #ccc;">👤 {authState.currentUser.displayName || authState.currentUser.username}</span>
            <button onclick={logoutUser} style="padding: 6px 15px; background: transparent; border: 1px solid #777; color: white; border-radius: 20px; cursor: pointer; font-weight: bold; transition: border 0.2s;" onmouseover={(e) => e.currentTarget.style.borderColor = '#fff'} onmouseout={(e) => e.currentTarget.style.borderColor = '#777'}>Logout</button>
        {:else}
            <a href="/login" style="padding: 8px 20px; background: white; color: black; font-weight: bold; border-radius: 20px; text-decoration: none; transition: transform 0.1s;" onmousedown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onmouseup={(e) => e.currentTarget.style.transform = 'scale(1)'}>Log in</a>
        {/if}
    </div>
</nav>

<div style="padding-bottom: {playerState.currentTrack ? '100px' : '0'}; transition: padding 0.3s;"> 
    {@render children()}
</div>

{#if playerState.currentTrack}
    <div style="position: fixed; bottom: 0; left: 0; right: 0; height: 90px; background: #121212; color: white; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; box-shadow: 0 -4px 20px rgba(0,0,0,0.5); z-index: 9999; border-top: 1px solid #282828;">
        
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

        <div style="display: flex; align-items: center; gap: 15px; width: 30%;">
            <div style="width: 56px; height: 56px; background: #282828; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                {#if playerState.currentTrack.album?.imgUrl || playerState.currentTrack.album?.img_url}
                    <img src={playerState.currentTrack.album.imgUrl || playerState.currentTrack.album.img_url} alt="Cover" style="width: 100%; height: 100%; object-fit: cover;" />
                {:else}
                    <span style="font-size: 1.5em;">🎵</span>
                {/if}
            </div>
            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <p style="margin: 0; font-weight: bold; font-size: 0.95em; color: #fff;">{playerState.currentTrack.title}</p>
                <p style="margin: 3px 0 0 0; font-size: 0.8em; color: #b3b3b3;">
                    {playerState.currentTrack.artists?.map((a:any) => a.name).join(', ') || 'Unknown Artist'}
                </p>
            </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; width: 40%; max-width: 500px;">
            <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 8px;">
                <button onclick={handlePrev} style="background: none; border: none; color: #b3b3b3; cursor: pointer; font-size: 1.2em;" onmouseover={(e) => e.currentTarget.style.color = '#fff'} onmouseout={(e) => e.currentTarget.style.color = '#b3b3b3'}>
                    ⏮
                </button>
                <button onclick={togglePlay} style="width: 35px; height: 35px; border-radius: 50%; background: #fff; color: #000; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1em; transition: transform 0.1s;" onmousedown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onmouseup={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                    {playerState.isPlaying ? '⏸' : '▶'}
                </button>
                <button onclick={handleNext} style="background: none; border: none; color: #b3b3b3; cursor: pointer; font-size: 1.2em;" onmouseover={(e) => e.currentTarget.style.color = '#fff'} onmouseout={(e) => e.currentTarget.style.color = '#b3b3b3'}>
                    ⏭
                </button>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; width: 100%; font-size: 0.75em; color: #b3b3b3;">
                <span style="min-width: 30px; text-align: right;">{formatTime(currentTime)}</span>
                <input type="range" min="0" max={duration || 100} value={currentTime} oninput={handleSeek} style="flex: 1; height: 4px; border-radius: 2px; appearance: none; background: #4d4d4d; cursor: pointer; outline: none;" />
                <span style="min-width: 30px;">{formatTime(duration)}</span>
            </div>
        </div>

        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; width: 30%;">
            <span style="font-size: 1.2em; color: #b3b3b3;">🔊</span>
            <input type="range" min="0" max="1" step="0.01" bind:value={volume} style="width: 100px; height: 4px; border-radius: 2px; appearance: none; background: #4d4d4d; cursor: pointer; outline: none;" />
        </div>
    </div>
{/if}