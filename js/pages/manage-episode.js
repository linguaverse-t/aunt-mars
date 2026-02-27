import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy, where, serverTimestamp, Timestamp, getDoc, writeBatch, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast, setupScrollToTop } from '../utils.js';

let selectedNovelId = null;
let allEpisodesData = [];
let filteredEpisodesData = [];
let currentEpPage = 1;
const EPS_PER_PAGE = 20;

const TEXT_COLORS = [
    { color: '#666666', name: 'เทา' }, { color: '#000000', name: 'ดำ' },
    { color: '#ff0000', name: 'แดง' }, { color: '#0000ff', name: 'น้ำเงิน' },
    { color: '#1e90ff', name: 'ฟ้า' }, { color: '#228b22', name: 'เขียว' },
    { color: '#ff1493', name: 'ชมพู' }, { color: '#a52a2a', name: 'น้ำตาล' },
    { color: '#9900ff', name: 'ม่วง' }, { color: '#ff7f50', name: 'ส้ม' }
];

let tomSelectInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();
    setupScrollToTop();
    checkAdminAuth();
    document.execCommand('defaultParagraphSeparator', false, 'p');
    renderColorDropdown();
    loadNovelsDropdown();
    setupFormEvents();
});

// 1. Auth Check
function checkAdminAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = 'index.html'; return; }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!['admin', 'writer'].includes(userDoc.data()?.role)) {
            alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            window.location.href = 'index.html';
        }
    });
}

// 1.1 Render Color Dropdown for Editor
function renderColorDropdown() {
    const dropdown = document.getElementById('colorDropdown');
    if(!dropdown) return; // Guard clause if element missing
    
    dropdown.innerHTML = TEXT_COLORS.map(c => `
        <button type="button" onclick="formatDoc('foreColor', '${c.color}'); document.getElementById('colorDropdown').classList.add('hidden')" 
            class="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition" style="background-color: ${c.color};" title="${c.name}">
        </button>
    `).join('');
}

// 2. Load Novels to Dropdown
async function loadNovelsDropdown() {
    const select = document.getElementById('novelSelector');
    try {
        const q = query(collection(db, "novels"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

	select.innerHTML = '<option value="">-- พิมพ์เพื่อค้นหานิยาย --</option>'; // Clear old options
        
        snapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.text = `${doc.data().titleEN} (${doc.data().titleTH})`;
            select.appendChild(option);
        });

        if (tomSelectInstance) tomSelectInstance.destroy();
        tomSelectInstance = new TomSelect("#novelSelector", {
            create: false,
            sortField: { field: "text", direction: "asc" },
            placeholder: "พิมพ์ชื่อนิยายเพื่อค้นหา...",
            onChange: async (value) => {
                selectedNovelId = value;
                const area = document.getElementById('managementArea');
                if (selectedNovelId) {
                    area.classList.remove('hidden');
                    setTimeout(() => area.classList.remove('opacity-0'), 50);
                    await loadEpisodesTable(selectedNovelId);
                    autoFillNextEpisodeNumber(selectedNovelId);
                } else {
                    area.classList.add('opacity-0');
                    setTimeout(() => area.classList.add('hidden'), 500);
                }
            }
        });

    } catch (error) { 
        console.error("Load novels failed:", error); 
        Swal.fire('Error', 'ไม่สามารถโหลดรายชื่อนิยายได้: ' + error.message, 'error');
    }
}

// 3. Load Episodes Table (With Pagination & Search)
async function loadEpisodesTable(novelId) {
    const tbody = document.getElementById('episodeTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4">กำลังโหลด...</td></tr>';

    try {
        const epRef = collection(db, "novels", novelId, "episodes");
        const q = query(epRef, orderBy("episodeNumber", "asc")); 
        const snapshot = await getDocs(q);
        
        allEpisodesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Reset ช่องค้นหาและโหลดหน้าแรก
        const searchInput = document.getElementById('searchEpInput');
        if (searchInput) searchInput.value = '';
        window.handleSearchEpisode();
        
    } catch (error) { 
        console.error("Firestore Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-400 p-4">เกิดข้อผิดพลาด: ${error.message}<br><span class="text-xs">กรุณาเช็ค Console (F12) หากมีลิงก์ให้สร้าง Index</span></td></tr>`;
    }
}

window.handleSearchEpisode = (searchTerm = document.getElementById('searchEpInput')?.value || '') => {
    const term = searchTerm.toLowerCase().trim();
    if (term) {
        filteredEpisodesData = allEpisodesData.filter(ep => {
            return String(ep.episodeNumber).includes(term) || 
                   (ep.title || '').toLowerCase().includes(term);
        });
    } else {
        filteredEpisodesData = [...allEpisodesData];
    }
    
    currentEpPage = 1;
    renderEpisodeCurrentPage();
};

function renderEpisodeCurrentPage() {
    const tbody = document.getElementById('episodeTableBody');
    tbody.innerHTML = '';
    
    if (filteredEpisodesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-400">ไม่พบตอนที่ค้นหา</td></tr>';
        renderEpisodePaginationUI(0, 0, 0);
        return;
    }

    const startIndex = (currentEpPage - 1) * EPS_PER_PAGE;
    const endIndex = startIndex + EPS_PER_PAGE;
    const pageData = filteredEpisodesData.slice(startIndex, endIndex);

    pageData.forEach(data => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-100 hover:bg-gray-50 transition";
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-pastel-purple">#${data.episodeNumber}</td>
            <td class="p-3 font-saraban">${data.title}</td>
            <td class="p-3 text-center">${getPriceBadge(data.requiredPoints)}</td>
            <td class="p-3 text-center">
                ${data.isPublished ? '<span class="text-green-500"><i class="fas fa-check-circle"></i></span>' : '<span class="text-gray-300"><i class="fas fa-clock"></i></span>'}
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
    
    renderEpisodePaginationUI(filteredEpisodesData.length, startIndex, endIndex);
}

function renderEpisodePaginationUI(total, start, end) {
    const container = document.getElementById('episodePaginationContainer');
    if (!container) return;
    
    if (total <= EPS_PER_PAGE) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    const totalPages = Math.ceil(total / EPS_PER_PAGE);
    const displayEnd = Math.min(end, total);
    
    let html = `
        <div class="text-sm text-gray-500 font-saraban order-2 sm:order-1 text-center sm:text-left">
            ${start + 1}–${displayEnd} จาก ${total} ตอน
        </div>
        <div class="flex items-center gap-2 order-1 sm:order-2 flex-wrap justify-center">
            <button onclick="window.changeEpPage(${currentEpPage - 1})" ${currentEpPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-full text-sm font-saraban ${currentEpPage === 1 ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-pastel-purple hover:bg-pastel-purple/10 border border-pastel-purple/30'} transition">&lt; ก่อนหน้า</button>
    `;
    
    let pages = [];
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        if (currentEpPage <= 3) {
            pages = [1, 2, 3, 4, '...', totalPages];
        } else if (currentEpPage >= totalPages - 2) {
            pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [1, '...', currentEpPage - 1, currentEpPage, currentEpPage + 1, '...', totalPages];
        }
    }
    
    pages.forEach(p => {
        if (p === '...') {
            html += `<span class="text-gray-400 px-1">...</span>`;
        } else if (p === currentEpPage) {
            html += `<button class="w-8 h-8 rounded-full bg-gradient-to-r from-pastel-pink to-pastel-purple text-white font-bold text-sm shadow-sm">${p}</button>`;
        } else {
            html += `<button onclick="window.changeEpPage(${p})" class="w-8 h-8 rounded-full text-gray-600 hover:bg-pastel-purple/10 border border-gray-200 text-sm transition">${p}</button>`;
        }
    });
    
    html += `
            <button onclick="window.changeEpPage(${currentEpPage + 1})" ${currentEpPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-full text-sm font-saraban ${currentEpPage === totalPages ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-pastel-purple hover:bg-pastel-purple/10 border border-pastel-purple/30'} transition">ถัดไป &gt;</button>
        </div>
    `;
    
    container.innerHTML = html;
}

window.changeEpPage = (page) => {
    const totalPages = Math.ceil(filteredEpisodesData.length / EPS_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
        currentEpPage = page;
        renderEpisodeCurrentPage();
    }
};

// 4. Form & Save Logic
function setupFormEvents() {
    // Update Badge Preview on Select Change
    const priceSelect = document.getElementById('priceType');
    const badgePreview = document.getElementById('priceBadgePreview');
    priceSelect.addEventListener('change', (e) => {
        badgePreview.innerHTML = `ตัวอย่าง: ${getPriceBadge(parseInt(e.target.value))}`;
    });

/* The Change: [INSERT] */
    // Handle Paste as Plain Text -> Convert to Paragraphs <p>
    const editor = document.getElementById('editor');
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        // Get plain text
        const text = (e.clipboardData || window.clipboardData).getData('text');
        // Split by newlines and wrap in <p>
        const paragraphs = text.split(/\r?\n/).filter(line => line.trim() !== '');
        let html = '';
        paragraphs.forEach(line => {
            html += `<p>${line}</p>`;
        });
        // Insert HTML at cursor
        document.execCommand('insertHTML', false, html);
    });

    // Save
    document.getElementById('episodeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!selectedNovelId) return Swal.fire('Error', 'กรุณาเลือกนิยายก่อน', 'error');

        const epId = document.getElementById('episodeId').value;
        const epNum = parseInt(document.getElementById('episodeNumber').value);
        const points = parseInt(document.getElementById('priceType').value);

        const content = document.getElementById('editor').innerHTML;
        const isPublished = document.getElementById('isPublished').checked; // ดึงค่าจากการติ๊ก Checkbox

        const formData = {
            episodeNumber: epNum,
            title: document.getElementById('episodeTitle').value,
            content: content,
            requiredPoints: points,
            accessType: points > 0 ? 'points' : 'free',
            isPublished: isPublished, // บันทึกสถานะเผยแพร่
            wordCount: content.replace(/<[^>]*>/g, '').length,
            createdAt: serverTimestamp() // จะไม่แก้ถ้าเป็น update
        };
        
        // Remove createdAt if update
        if(epId) delete formData.createdAt;

        try {
            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            const epRef = collection(db, "novels", selectedNovelId, "episodes");
            
            if (epId) {
                // Update
                await updateDoc(doc(epRef, epId), formData);
                // [ADD] Update latestUpdatedAt only if it is published
                if (isPublished) {
                    await updateDoc(doc(db, "novels", selectedNovelId), {
                        latestUpdatedAt: serverTimestamp()
                    });
                }
                showToast('success', 'แก้ไขตอนเรียบร้อย');
            } else {
                // Add New
                await addDoc(epRef, formData);
                
                // Update Parent Novel Stats (Latest Episode & Updated At)
                const novelRef = doc(db, "novels", selectedNovelId);
                const novelUpdates = {
                    totalEpisodes: await getCollectionCount(epRef),
                    latestEpisodeNumber: epNum
                };
                
                // [ADD] Update latestUpdatedAt only if it is published
                if (isPublished) {
                    novelUpdates.latestUpdatedAt = serverTimestamp();
                }

                await updateDoc(novelRef, novelUpdates);
                showToast('success', 'เพิ่มตอนใหม่เรียบร้อย');
            }

            Swal.close();
            resetForm();
            loadEpisodesTable(selectedNovelId);
            autoFillNextEpisodeNumber(selectedNovelId); // Prepare next number

        } catch (error) { Swal.fire('Error', error.message, 'error'); }
    });
}

// 5. Delete Logic
async function handleDelete(e) {
    const epId = e.currentTarget.dataset.id;
    const result = await Swal.fire({
        title: 'ลบตอน?',
        text: "ไม่สามารถกู้คืนได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#FCA5A5',
        confirmButtonText: 'ลบ'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "novels", selectedNovelId, "episodes", epId));
            showToast('success', 'ลบเรียบร้อย');
            loadEpisodesTable(selectedNovelId);
        } catch (error) { Swal.fire('Error', error.message, 'error'); }
    }
}

// 6. Edit Logic
async function handleEdit(e) {
    const epId = e.currentTarget.dataset.id;
    try {
        const docSnap = await getDoc(doc(db, "novels", selectedNovelId, "episodes", epId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('episodeId').value = epId;
            document.getElementById('episodeNumber').value = data.episodeNumber;
            document.getElementById('episodeTitle').value = data.title;
            document.getElementById('priceType').value = data.requiredPoints || 0;
            document.getElementById('editor').innerHTML = data.content;
	    document.getElementById('isPublished').checked = data.isPublished !== false;
            
            // Scroll form into view
            document.getElementById('episodeForm').scrollIntoView({ behavior: 'smooth' });
            showToast('info', 'กำลังแก้ไขตอนที่ ' + data.episodeNumber);
        }
    } catch(e) { console.error(e); }
}

// Helpers
function getPriceBadge(points) {
    if (points === 0) return `<span class="bg-gray-200 text-gray-600 px-2 py-1 rounded-md text-xs font-bold shadow-sm">Free</span>`;
    if (points <= 10) return `<span class="bg-blue-100 text-blue-600 px-2 py-1 rounded-md text-xs font-bold shadow-sm">Standard (${points})</span>`;
    if (points <= 15) return `<span class="bg-green-100 text-green-600 px-2 py-1 rounded-md text-xs font-bold shadow-sm">Special (${points})</span>`;
    return `<span class="bg-orange-100 text-orange-600 px-2 py-1 rounded-md text-xs font-bold shadow-sm">Extra (${points})</span>`;
}

async function getCollectionCount(ref) {
    const snapshot = await getDocs(ref);
    return snapshot.size;
}

async function autoFillNextEpisodeNumber(novelId) {
    try {
        const epRef = collection(db, "novels", novelId, "episodes");
        const q = query(epRef, where("episodeNumber", ">", 0), orderBy("episodeNumber", "desc"), limit(1));
        const snapshot = await getDocs(q);
        
        let nextNum = 1;
        if (!snapshot.empty) {
            nextNum = snapshot.docs[0].data().episodeNumber + 1;
        }
        document.getElementById('episodeNumber').value = nextNum;
    } catch(e) {}
}

window.resetForm = () => {
    document.getElementById('episodeForm').reset();
    document.getElementById('episodeId').value = '';
    document.getElementById('editor').innerHTML = '';
    document.getElementById('isPublished').checked = true; // เพิ่มบรรทัดนี้เพื่อรีเซ็ตค่ากลับมาเปิดเผยแพร่เป็นค่าตั้งต้น
    autoFillNextEpisodeNumber(selectedNovelId);
}
