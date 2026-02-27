import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from '../utils.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();

    // Check Auth & Fill Username
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            // ดึง Username จาก displayName หรือ email ถ้าไม่มี
            const display = user.displayName || user.email.split('@')[0];
            document.getElementById('usernameField').value = display;
        } else {
            Swal.fire({
                title: 'กรุณาเข้าสู่ระบบ',
                text: 'คุณต้องเข้าสู่ระบบก่อนทำการเติม Points',
                icon: 'warning',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#D8B4FE',
                allowOutsideClick: false
            }).then(() => {
                window.location.href = 'index.html'; // ส่งกลับหน้าแรก หรือเปิด Modal Login
            });
        }
    });

    // Form Submit
    document.getElementById('topupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if(!currentUser) return;

        const pkgVal = document.getElementById('selectedPkgValue').value;
        const [pkgName, pkgPrice, pkgPoints] = pkgVal.split('|');
        const bankInfo = document.getElementById('bankInfo').value;
        const transferTime = document.getElementById('transferTime').value;

        if(!bankInfo || !transferTime) return showToast('error', 'กรุณากรอกข้อมูลให้ครบ');

        try {
            Swal.fire({ title: 'กำลังส่งข้อมูล...', didOpen: () => Swal.showLoading() });

            // สร้าง Notification ไปหา Admin
            await addDoc(collection(db, "notifications"), {
                to: 'admin', // ส่งหา Admin
                type: 'topup',
                from: currentUser.displayName || currentUser.email, // ส่งจาก User คนนี้
                title: 'แจ้งโอนเงิน TopUp',
                message: `${pkgName} (${pkgPrice}฿) - ${bankInfo} เวลา ${transferTime}`,
                amount: parseInt(pkgPoints),
                status: 'pending', // รออนุมัติ
                senderId: currentUser.uid, // เก็บ UID เพื่อให้ Admin กดอนุมัติแล้วเติมพอยต์ถูกคน
                createdAt: serverTimestamp(),
                isRead: false
            });

            Swal.fire({
                title: 'แจ้งโอนเรียบร้อย!',
                text: 'แอดมินจะตรวจสอบและอนุมัติยอดเงินให้เร็วที่สุดครับ',
                icon: 'success',
                confirmButtonColor: '#86EFAC'
            }).then(() => {
                window.location.href = 'index.html';
            });

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
    });
});