import { auth, db } from '../services/firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/src/sweetalert2.js';
import { showToast } from '../utils.js';

export const showAuthModal = (mode = 'signin') => {
    const isSignIn = mode === 'signin';
    const title = isSignIn ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
    const btnText = isSignIn ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
    const switchText = isSignIn ? 'ยังไม่มีบัญชี? สมัครเลย' : 'มีบัญชีแล้ว? เข้าสู่ระบบ';
    
    // HTML Form
    const html = `
        <div class="flex flex-col gap-4 text-left font-mali">
            ${!isSignIn ? `<input id="swal-username" class="swal2-input m-0 w-full" placeholder="Username">` : ''}
            <input id="swal-email" class="swal2-input m-0 w-full" placeholder="Email" type="email">
            <div class="relative">
                <input id="swal-password" class="swal2-input m-0 w-full" placeholder="Password" type="password">
                <span onclick="togglePasswordVisibility('swal-password')" class="absolute right-3 top-4 cursor-pointer text-gray-400 hover:text-pastel-purple">
                    <i class="fa-solid fa-eye"></i>
                </span>
            </div>
            <p class="text-center text-sm text-gray-500 cursor-pointer hover:text-pastel-purple underline mt-2" id="switch-auth-mode">${switchText}</p>
        </div>
    `;

    Swal.fire({
        title: `<span class="text-pastel-purple">${title}</span>`,
        html: html,
        showCancelButton: false,
        confirmButtonText: btnText,
        confirmButtonColor: '#D8B4FE',
        focusConfirm: false,
        didOpen: () => {
            // Logic สลับโหมด SignIn/SignUp
            document.getElementById('switch-auth-mode').addEventListener('click', () => {
                Swal.close();
                showAuthModal(isSignIn ? 'signup' : 'signin');
            });
            // Logic Toggle Password
            window.togglePasswordVisibility = (id) => {
                const input = document.getElementById(id);
                input.type = input.type === "password" ? "text" : "password";
            };
        },
        preConfirm: async () => {
            const email = document.getElementById('swal-email').value;
            const password = document.getElementById('swal-password').value;
            const username = !isSignIn ? document.getElementById('swal-username').value : null;

            if (!email || !password || (!isSignIn && !username)) {
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                return;
            }

            try {
                if (isSignIn) {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;
                    
                    // Create User Document
                    await setDoc(doc(db, "users", user.uid), {
                        username: username,
                        email: email,
                        role: 'user', // Default role
                        points: 0,
                        readingHistory: [],
                        favorites: [],
                        avatar: '',
                        createdAt: serverTimestamp()
                    });
                }
                return true;
            } catch (error) {
                Swal.showValidationMessage(`Error: ${error.message}`);
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showToast('success', `${title} สำเร็จ!`);
            // location.reload(); // ปกติ Firebase Auth state change จะ trigger UI update ใน navbar เอง
        }
    });
};