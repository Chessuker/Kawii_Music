import { browser } from '$app/environment';

// State สำหรับเก็บข้อมูล Admin ที่ล็อกอิน
export const adminAuthState = $state({
    currentAdmin: null as any | null
});

// ฟังก์ชันโหลดข้อมูล Admin จาก LocalStorage ตอนเปิดเว็บ
export function initAdminAuth() {
    if (browser) {
        const storedAdmin = localStorage.getItem('kawii_admin');
        if (storedAdmin) {
            adminAuthState.currentAdmin = JSON.parse(storedAdmin);
        }
    }
}

// ฟังก์ชันออกจากระบบของ Admin
export function logoutAdmin() {
    if (browser) {
        localStorage.removeItem('kawii_admin');
        adminAuthState.currentAdmin = null;
        window.location.href = '/admin/login';
    }
}