import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast, setupScrollToTop } from '../utils.js';

// Genres List
let allNovelsData = [];
let filteredNovelsData = [];
let currentNovelPage = 1;
const NOVELS_PER_PAGE = 10;
const GENRES = [
    "Action", "Adult", "Adventure", "Comedy", "Drama", "Fantasy", 
    "Josei", "Mature", "Psychological", "Romance", "Slice of Life", 
    "Smut", "Supernatural", "Tragedy", "Yaoi", "Yuri"
];

// Color Palette for Editor
const TEXT_COLORS = [
    { color: '#666666', name: 'เทา' }, { color: '#000000', name: 'ดำ' },
    { color: '#ff0000', name: 'แดง' }, { color: '#0000ff', name: 'น้ำเงิน' },
    { color: '#1e90ff', name: 'ฟ้า' }, { color: '#228b22', name: 'เขียว' },
    { color: '#ff1493', name: 'ชมพู' }, { color: '#a52a2a', name: 'น้ำตาล' },
    { color: '#9900ff', name: 'ม่วง' }, { color: '#ff7f50', name: 'ส้ม' }
];

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();
    setupScrollToTop();
    checkAdminAuth();
    renderGenreCheckboxes();
    renderColorDropdown();
document.execCommand('defaultParagraphSeparator', false, 'p');
    loadNovelsTable();
    setupFormEvents();
});

// 1. Check Admin/Writer Role
function checkAdminAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html'; 
            return;
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = userDoc.data()?.role;
        if (!['admin', 'writer'].includes(role)) {
            alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            window.location.href = 'index.html';
        }
    });
}

// 2. Render UI Elements
function renderGenreCheckboxes() {
    const container = document.getElementById('genreContainer');
    container.innerHTML = GENRES.map(g => `
        <label class="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-100 rounded">
            <input type="checkbox" value="${g}" class="genre-checkbox w-4 h-4 text-pastel-purple rounded focus:ring-pastel-purple">
            <span class="text-sm font-saraban">${g}</span>
        </label>
    `).join('');
}

function renderColorDropdown() {
    const dropdown = document.getElementById('colorDropdown');
    dropdown.innerHTML = TEXT_COLORS.map(c => `
        <button type="button" onclick="formatDoc('foreColor', '${c.color}'); document.getElementById('colorDropdown').classList.add('hidden')" 
            class="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition" style="background-color: ${c.color};" title="${c.name}">
        </button>
    `).join('');
}

// 3. Load Data to Table (With Pagination & Search)
async function loadNovelsTable() {
    const tbody = document.getElementById('novelTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4">กำลังโหลด...</td></tr>';
    
    try {
        const q = query(collection(db, "novels"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        allNovelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        window.handleSearchNovel(); // ประมวลผลและ render ครั้งแรก
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-400">โหลดข้อมูลผิดพลาด</td></tr>';
    }
}

window.handleSearchNovel = (searchTerm = document.getElementById('searchNovelInput')?.value || '') => {
    const term = searchTerm.toLowerCase().trim();
    if (term) {
        filteredNovelsData = allNovelsData.filter(novel => {
            return (novel.titleEN || '').toLowerCase().includes(term) || 
                   (novel.titleTH || '').toLowerCase().includes(term);
        });
    } else {
        filteredNovelsData = [...allNovelsData];
    }
    
    currentNovelPage = 1;
    renderNovelCurrentPage();
};

function renderNovelCurrentPage() {
    const tbody = document.getElementById('novelTableBody');
    tbody.innerHTML = '';
    
    if (filteredNovelsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-400">ไม่พบข้อมูลนิยาย</td></tr>';
        renderNovelPaginationUI(0, 0, 0);
        return;
    }

    const startIndex = (currentNovelPage - 1) * NOVELS_PER_PAGE;
    const endIndex = startIndex + NOVELS_PER_PAGE;
    const pageData = filteredNovelsData.slice(startIndex, endIndex);

    pageData.forEach(data => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-100 hover:bg-gray-50 transition";
        tr.innerHTML = `
            <td class="p-3">
                <img src="${data.coverUrl || 'https://via.placeholder.com/50'}" class="w-12 h-16 object-cover rounded border">
            </td>
            <td class="p-3">
                <div class="font-bold text-brand-dark">${data.titleEN}</div>
                <div class="text-xs text-gray-500">${data.titleTH}</div>
            </td>
            <td class="p-3">
                <span class="text-xs px-2 py-1 rounded bg-gray-100">${data.status}</span>
                ${data.isPublished ? '<span class="text-green-500 ml-1"><i class="fas fa-check-circle"></i></span>' : '<span class="text-gray-300 ml-1"><i class="fas fa-eye-slash"></i></span>'}
            </td>
            <td class="p-3 text-center space-x-2">
                <button class="edit-btn text-yellow-500 hover:text-yellow-600" data-id="${data.id}"><i class="fas fa-edit"></i></button>
                <button class="delete-btn text-red-400 hover:text-red-600" data-id="${data.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
    
    renderNovelPaginationUI(filteredNovelsData.length, startIndex, endIndex);
}

function renderNovelPaginationUI(total, start, end) {
    const container = document.getElementById('novelPaginationContainer');
    if (!container) return;
    
    if (total <= NOVELS_PER_PAGE) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    const totalPages = Math.ceil(total / NOVELS_PER_PAGE);
    const displayEnd = Math.min(end, total);
    
    let html = `
        <div class="text-sm text-gray-500 font-saraban order-2 sm:order-1 text-center sm:text-left">
            ${start + 1}–${displayEnd} จาก ${total} เรื่อง
        </div>
        <div class="flex items-center gap-2 order-1 sm:order-2 flex-wrap justify-center">
            <button onclick="window.changeNovelPage(${currentNovelPage - 1})" ${currentNovelPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-full text-sm font-saraban ${currentNovelPage === 1 ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-pastel-purple hover:bg-pastel-purple/10 border border-pastel-purple/30'} transition">&lt; ก่อนหน้า</button>
    `;
    
    let pages = [];
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        if (currentNovelPage <= 3) {
            pages = [1, 2, 3, 4, '...', totalPages];
        } else if (currentNovelPage >= totalPages - 2) {
            pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [1, '...', currentNovelPage - 1, currentNovelPage, currentNovelPage + 1, '...', totalPages];
        }
    }
    
    pages.forEach(p => {
        if (p === '...') {
            html += `<span class="text-gray-400 px-1">...</span>`;
        } else if (p === currentNovelPage) {
            html += `<button class="w-8 h-8 rounded-full bg-gradient-to-r from-pastel-pink to-pastel-purple text-white font-bold text-sm shadow-sm">${p}</button>`;
        } else {
            html += `<button onclick="window.changeNovelPage(${p})" class="w-8 h-8 rounded-full text-gray-600 hover:bg-pastel-purple/10 border border-gray-200 text-sm transition">${p}</button>`;
        }
    });
    
    html += `
            <button onclick="window.changeNovelPage(${currentNovelPage + 1})" ${currentNovelPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-full text-sm font-saraban ${currentNovelPage === totalPages ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-pastel-purple hover:bg-pastel-purple/10 border border-pastel-purple/30'} transition">ถัดไป &gt;</button>
        </div>
    `;
    
    container.innerHTML = html;
}

window.changeNovelPage = (page) => {
    const totalPages = Math.ceil(filteredNovelsData.length / NOVELS_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
        currentNovelPage = page;
        renderNovelCurrentPage();
    }
};

// 4. Form Handling (Add/Update)
function setupFormEvents() {
    // Cover Preview
    document.getElementById('coverUrl').addEventListener('input', (e) => {
        document.getElementById('coverPreview').src = e.target.value || 'https://via.placeholder.com/300x450?text=Cover';
    });

    const editor = document.getElementById('editor');
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        // ดึงข้อความเพียวๆ มา
        const text = (e.clipboardData || window.clipboardData).getData('text');
        // แยกบรรทัดและครอบด้วยแท็ก <p>
        const paragraphs = text.split(/\r?\n/).filter(line => line.trim() !== '');
        let html = '';
        paragraphs.forEach(line => {
            html += `<p>${line}</p>`;
        });
        // แทรกกลับเข้าไปใน Editor
        document.execCommand('insertHTML', false, html);
    });

    document.getElementById('novelForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Collect Data
        const id = document.getElementById('novelId').value;
        const genres = Array.from(document.querySelectorAll('.genre-checkbox:checked')).map(cb => cb.value);
        const description = document.getElementById('editor').innerHTML;
        const isPublished = document.getElementById('isPublished').checked; // ดึงค่าจาก Checkbox แทน

        const formData = {
            coverUrl: document.getElementById('coverUrl').value,
            titleEN: document.getElementById('titleEN').value,
	    rating: parseFloat(document.getElementById('rating')?.value) || 0,
            titleTH: document.getElementById('titleTH').value,
            originalTitle: document.getElementById('originalTitle').value,
            author: document.getElementById('author').value,
            language: document.getElementById('language').value,
            status: document.getElementById('status').value,
            hasLicense: document.getElementById('hasLicense').checked,
            isAdult: document.getElementById('isAdult').checked,
            genres: genres,
            description: description,
            isPublished: isPublished, // บันทึกสถานะเผยแพร่
            updateAt: serverTimestamp()
        };

        try {
            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            if (id) {
                // Update
                await updateDoc(doc(db, "novels", id), formData);
                showToast('success', 'แก้ไขข้อมูลเรียบร้อย');
            } else {
                // Add New (เพิ่มฟิลด์สำหรับสร้างครั้งแรก)
                formData.createdAt = serverTimestamp();
                formData.viewCount = 0;
                formData.authorId = auth.currentUser?.uid || null;
                await addDoc(collection(db, "novels"), formData);
                showToast('success', 'เพิ่มนิยายเรียบร้อย');
            }

            Swal.close();
            resetForm();
            loadNovelsTable(); // Refresh table

        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    });
}

// 5. Delete Logic
async function handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: "ข้อมูลจะหายไปถาวร!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#FCA5A5',
        confirmButtonText: 'ลบเลย'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "novels", id));
            showToast('success', 'ลบเรียบร้อย');
            loadNovelsTable();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// 6. Edit Logic (Populate Form)
async function handleEdit(e) {
    const id = e.currentTarget.dataset.id;
    try {
        const docSnap = await getDoc(doc(db, "novels", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Fill Inputs
            document.getElementById('novelId').value = id;
            document.getElementById('coverUrl').value = data.coverUrl;
            document.getElementById('coverPreview').src = data.coverUrl;
            document.getElementById('titleEN').value = data.titleEN;
            document.getElementById('titleTH').value = data.titleTH;
            document.getElementById('originalTitle').value = data.originalTitle || '';
            document.getElementById('author').value = data.author || '';
	    if(document.getElementById('rating')) document.getElementById('rating').value = data.rating || 0;
            document.getElementById('language').value = data.language || 'KR';
            document.getElementById('status').value = data.status || 'Ongoing';
            document.getElementById('hasLicense').checked = data.hasLicense || false;
            document.getElementById('isAdult').checked = data.isAdult || false;
            document.getElementById('editor').innerHTML = data.description || '';
	    document.getElementById('isPublished').checked = data.isPublished !== false;

            // Check Genres
            document.querySelectorAll('.genre-checkbox').forEach(cb => {
                cb.checked = data.genres ? data.genres.includes(cb.value) : false;
            });

            // Change Button Text (Optional UX)
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast('info', 'กำลังแก้ไข: ' + data.titleEN);
        }
    } catch (error) {
        console.error(error);
    }
}

// Global Reset
window.resetForm = () => {
    document.getElementById('novelForm').reset();
    document.getElementById('novelId').value = '';
    document.getElementById('coverPreview').src = 'https://via.placeholder.com/300x450?text=Cover';
    document.getElementById('editor').innerHTML = '';
    document.getElementById('isPublished').checked = true; // รีเซ็ตให้กลับมาติ๊กถูกเป็นค่าตั้งต้น
    document.querySelectorAll('.genre-checkbox').forEach(cb => cb.checked = false);
}
