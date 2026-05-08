import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
    // ยิง API แบบขนานกัน (Parallel Fetch) เพื่อความเร็ว
    const [usersRes, tracksRes] = await Promise.all([
        fetch('http://127.0.0.1:8787/api/users'),
        fetch('http://127.0.0.1:8787/api/tracks')
    ]);

    const usersResult = await usersRes.json();
    const tracksResult = await tracksRes.json();
    
    return {
        users: usersResult.data || [],
        tracks: tracksResult.data || []
    };
};