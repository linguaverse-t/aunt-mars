import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { db, auth } from '../services/firebase.js';
import { collection, getCountFromServer, query, where, getDocs, orderBy, limit, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    renderFooter();
    
    // Check Admin
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = 'index.html'; return; }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.data()?.role !== 'admin') {
            alert('Access Denied');
            window.location.href = 'index.html';
            return;
        }
        
        // Load Data
        loadStats();
        loadRecentTopups();
        initChart();
        document.getElementById('currentDate').innerText = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    });
});

async function loadStats() {
    try {
        // 1. Novels Count
        const novelsColl = collection(db, "novels");
        const novelsSnap = await getCountFromServer(novelsColl);
        document.getElementById('stat-novels').innerText = novelsSnap.data().count;

        // 2. Users Count
        const usersColl = collection(db, "users");
        const usersSnap = await getCountFromServer(usersColl);
        document.getElementById('stat-users').innerText = usersSnap.data().count;

        // 3. Pending Topups (ดึงและนับฝั่ง Client เพื่อเลี่ยงปัญหา Index ซ้อน)
        const notiColl = collection(db, "notifications");
        const topupQuery = query(notiColl, where("type", "==", "topup"));
        const topupSnap = await getDocs(topupQuery);
        // นับเฉพาะรายการที่ยังไม่ได้อ่าน หรือสถานะเป็น pending
        const pendingCount = topupSnap.docs.filter(d => d.data().status === 'pending' || d.data().isRead === false).length;
        document.getElementById('stat-topup').innerText = pendingCount;

        // 4. Comments (แสดงค่า Mockup ไปก่อน เนื่องจาก Firestore ต้องสร้าง Index พิเศษสำหรับ Subcollection)
        document.getElementById('stat-comments').innerText = "120+";

    } catch (e) { console.error("Stats Error:", e); }
}

async function loadRecentTopups() {
    const list = document.getElementById('topupList');
    try {
        const q = query(collection(db, "notifications"), where("type", "==", "topup"), orderBy("createdAt", "desc"), limit(5));
        const snapshot = await getDocs(q);
        
        if(snapshot.empty) {
            list.innerHTML = '<div class="text-center text-gray-400 text-sm py-4">ไม่มีรายการแจ้งเตือน</div>';
            return;
        }

        list.innerHTML = snapshot.docs.map(doc => {
            const d = doc.data();
            const time = d.createdAt ? new Date(d.createdAt.toDate()).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : '';
            return `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 text-xs"><i class="fas fa-file-invoice-dollar"></i></div>
                        <div>
                            <p class="text-sm font-bold text-gray-700 line-clamp-1">${d.from}</p>
                            <p class="text-xs text-gray-400">${d.amount} Points • ${time}</p>
                        </div>
                    </div>
                    ${d.status === 'approved' 
                        ? '<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-bold">อนุมัติแล้ว</span>'
                        : d.status === 'rejected'
                        ? '<span class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-bold">ปฏิเสธแล้ว</span>'
                        : '<span class="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-bold">รอตรวจ</span>'}
                </div>
            `;
	}).join('');

    } catch (e) { 
        console.error("Topup List Error:", e); 
        list.innerHTML = '<div class="text-center text-red-300 text-sm">โหลดข้อมูลไม่ได้ (Index?)</div>';
    }
}

async function initChart() {
    const ctx = document.getElementById('viewsChart').getContext('2d');
    
    try {
        // Query: ดึงข้อมูลนิยาย 7 เรื่องที่มี ViewCount สูงสุด
        const q = query(collection(db, "novels"), where("isPublished", "==", true), orderBy("viewCount", "desc"), limit(7));
        const snapshot = await getDocs(q);
        
        const labels = [];
        const dataPoints = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // ตัดชื่อเรื่องให้สั้นลงถ้ายาวเกินไป เพื่อให้กราฟสวยงาม
            const title = data.titleTH || data.titleEN || 'No Title';
            labels.push(title.length > 15 ? title.substring(0, 15) + '...' : title);
            dataPoints.push(data.viewCount || 0);
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['ไม่มีข้อมูล'],
                datasets: [{
                    label: 'ยอดเข้าชมรวม (ครั้ง)',
                    data: dataPoints.length > 0 ? dataPoints : [0],
                    backgroundColor: 'rgba(216, 180, 254, 0.7)', // pastel-purple
                    borderColor: '#C084FC',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (error) {
        console.error("Error loading chart data:", error);
    }
}