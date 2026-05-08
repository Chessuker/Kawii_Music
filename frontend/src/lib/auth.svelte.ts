export const authState = $state({
    currentUser: null as any | null,
    isInitialized: false // เช็กว่าโหลดข้อมูลจาก localStorage เสร็จหรือยัง
});

// ฟังก์ชัน Login จะเก็บข้อมูลลง localStorage ไว้ด้วย จะได้ไม่หลุดตอนรีเฟรช
export function loginUser(userData: any) {
    authState.currentUser = userData;
    if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(userData));
    }
}

export function logoutUser() {
    authState.currentUser = null;
    if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
    }
}

// ฟังก์ชันนี้จะถูกเรียกตอนหน้าเว็บโหลดครั้งแรก
export function initAuth() {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('user');
        if (stored) {
            authState.currentUser = JSON.parse(stored);
        }
    }
    authState.isInitialized = true;
}