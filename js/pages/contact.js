import { db, auth } from '../services/firebase.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const contactForm = document.getElementById('contact-form');
const nameInput = document.getElementById('contact-name');
const emailInput = document.getElementById('contact-email');
const messageInput = document.getElementById('contact-message');

let currentUser = null;

// ตรวจสอบ Login เพื่อ Auto-fill
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if (nameInput && !nameInput.value) nameInput.value = user.displayName || user.email.split('@')[0];
        if (emailInput && !emailInput.value) emailInput.value = user.email || '';
    }
});

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const message = messageInput.value.trim();

        if (!name || !email || !message) {
            Swal.fire('Error', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
            return;
        }

        Swal.fire({
            title: 'กำลังส่ง...',
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false
        });

        try {
            // 🔥 ส่ง Notification ไปหา Admin (Type: contact)
            // ข้อมูลชุดนี้ Navbar จะดึงไปแสดง และใช้ senderEmail/senderId ในการ Reply
            await addDoc(collection(db, "notifications"), {
                to: 'admin',                // ระบุว่าส่งหา Admin
                type: 'contact',            // ระบุประเภทให้ Navbar แยกสีได้
                from: name,                 // ชื่อผู้ส่ง
                email: email,               // อีเมลผู้ส่ง (สำหรับตอบกลับ)
                senderId: currentUser ? currentUser.uid : 'guest', // ID ผู้ส่ง
                title: 'ข้อความใหม่จาก Contact Us',
                message: message,
                fullMessage: message,       // เก็บข้อความเต็ม
                isRead: false,
                createdAt: serverTimestamp()
            });

            Swal.fire({
                icon: 'success',
                title: 'ส่งข้อความเรียบร้อย!',
                text: 'ขอบคุณที่ติดต่อเรา แอดมินจะรีบตอบกลับโดยเร็วที่สุดครับ',
                confirmButtonColor: '#D8B4FE',
                timer: 3000
            }).then(() => {
                contactForm.reset();
                if(currentUser) { // คืนค่าชื่อเดิมหลัง Reset
                    nameInput.value = currentUser.displayName || '';
                    emailInput.value = currentUser.email || '';
                }
            });

        } catch (error) {
            console.error("Error sending message: ", error);
            Swal.fire('Error', 'เกิดข้อผิดพลาดในการส่งข้อความ: ' + error.message, 'error');
        }
    });
}