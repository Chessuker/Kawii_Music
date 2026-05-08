import { authState } from './auth.svelte';

export const playerState = $state({
    currentTrack: null as any | null,
    queue: [] as any[],    
    currentIndex: -1,      
    isPlaying: false
});

// 👇 ฟังก์ชันกลางสำหรับบันทึกประวัติ (เขียนแยกไว้ดีมากครับ)
async function recordPlayHistory(trackId: string) {
    try {
        const currentUserId = authState.currentUser?.id || null; 
        await fetch(`http://127.0.0.1:8787/api/tracks/${trackId}/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
    } catch (error) {
        console.error("❌ ไม่สามารถบันทึกประวัติได้", error);
    }
}

export function playTrack(track: any, queue: any[] = []) {
    playerState.currentTrack = track;
    playerState.isPlaying = true;
    
    // อัปเดตคิวและหา Index ปัจจุบัน
    if (queue.length > 0) {
        playerState.queue = queue;
        playerState.currentIndex = queue.findIndex(t => t.id === track.id);
    } else if (playerState.queue.length > 0) {
        playerState.currentIndex = playerState.queue.findIndex(t => t.id === track.id);
    }

    recordPlayHistory(track.id); // เรียกใช้ฟังก์ชันกลาง
}

export function nextTrack() {
    if (playerState.queue.length === 0) return;
    
    let nextIndex = playerState.currentIndex + 1;
    if (nextIndex >= playerState.queue.length) {
        nextIndex = 0; // ถ้าหมดคิว ให้วนกลับไปเพลงแรก
    }
    
    playerState.currentIndex = nextIndex;
    playerState.currentTrack = playerState.queue[nextIndex];
    playerState.isPlaying = true;
    
    recordPlayHistory(playerState.currentTrack.id);
}

// รับค่า currentTime มาด้วย เพื่อเช็กว่าควรกรอเพลงกลับ หรือย้อนไปเพลงก่อนหน้า
export function prevTrack(currentTime: number = 0) {
    if (playerState.queue.length === 0) return;
    
    // ถ้าฟังไปเกิน 3 วินาทีแล้วกดกลับ ให้กรอเริ่มเพลงเดิมใหม่
    if (currentTime > 3) {
        return "RESTART_SONG"; 
    }
    
    let prevIndex = playerState.currentIndex - 1;
    if (prevIndex < 0) {
        prevIndex = playerState.queue.length - 1; // ถ้ากดก่อนหน้าตอนอยู่เพลงแรก ให้วนไปเพลงสุดท้าย
    }
    
    playerState.currentIndex = prevIndex;
    playerState.currentTrack = playerState.queue[prevIndex];
    playerState.isPlaying = true;
    
    recordPlayHistory(playerState.currentTrack.id);
}