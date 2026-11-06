// 🔴 ضع الرابط الخاص بك هنا بين علامتي التنصيص
const API_URL = 'https://script.google.com/macros/s/AKfycbxWgo_JgJrdsWYwkLY3hCSs3j2ncYUL2t6vus7RQ2m6iWrIZ3qfUWQA7ruCYm5ySC_bbg/exec';

let playersData = [];

// التنقل بين الأقسام وتلوين الزر النشط
function showSection(sectionId, btnElement) {
    document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    
    if(btnElement) {
        document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active-tab'));
        btnElement.classList.add('active-tab');
    }
    
    if(sectionId === 'scanSection') startScanner();
    else stopScanner();
}

// 1. جلب البيانات من جوجل شيت (مع دعم القراءة المحلية عند انقطاع النت)
async function loadPlayers() {
    try {
        document.getElementById('playersList').innerHTML = 'جاري التحميل...';
        let response = await fetch(API_URL);
        playersData = await response.json();
        localStorage.setItem('cachedPlayers', JSON.stringify(playersData));
        renderPlayers(playersData);
    } catch (error) {
        let cached = localStorage.getItem('cachedPlayers');
        if (cached) {
            playersData = JSON.parse(cached);
            renderPlayers(playersData);
            console.warn('تم تحميل البيانات من النسخة المحلية بسبب انقطاع الإنترنت.');
        } else {
            document.getElementById('playersList').innerHTML = 'تعذر الاتصال ولا توجد بيانات مخزنة مسبقاً.';
        }
    }
    checkPendingSync();
}

// 2. تسجيل لاعب جديد (مع دعم وضع الـ Offline)
document.getElementById('addForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    
    let joinDate = new Date();
    let expiryDate = new Date();
    let plan = document.getElementById('planType').value;

    if (plan === 'شهري') expiryDate.setDate(joinDate.getDate() + 30);
    else if (plan === 'أسبوعي') expiryDate.setDate(joinDate.getDate() + 7);
    else expiryDate.setHours(23, 59, 59, 999);

    let newId = 'GYM-' + Date.now();

    let data = {
        id: newId,
        name: document.getElementById('playerName').value,
        amount: document.getElementById('paymentAmount').value,
        plan: plan,
        joinDate: joinDate.toISOString(),
        expiryDate: expiryDate.toISOString()
    };

    // توليد الـ QR Code فوراً 
    document.getElementById('qrcodeBox').innerHTML = '';
    new QRCode(document.getElementById('qrcodeBox'), { text: newId, width: 200, height: 200 });

    if (navigator.onLine) {
        btn.innerText = 'جاري الحفظ...';
        btn.disabled = true;
        try {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            loadPlayers();
        } catch (err) {
            console.error('فشل الإرسال، سيتم الحفظ محلياً:', err);
            saveOfflinePlayer(data);
        }
        btn.innerText = 'حفظ وتوليد الكود';
        btn.disabled = false;
    } else {
        saveOfflinePlayer(data);
        alert('⚠️ الإنترنت مقطوع! تم توليد الكود وحفظ البيانات محلياً. يرجى الضغط على زر المزامنة عند عودة الاتصال.');
    }

    this.reset();
});

// حفظ اللاعب محلياً وإظهار زر المزامنة
function saveOfflinePlayer(data) {
    let offlineQueue = JSON.parse(localStorage.getItem('offlinePlayers')) || [];
    offlineQueue.push(data);
    localStorage.setItem('offlinePlayers', JSON.stringify(offlineQueue));
    
    playersData.push(data);
    renderPlayers(playersData);
    checkPendingSync();
}

// التحقق من وجود بيانات معلقة
function checkPendingSync() {
    let offlineQueue = JSON.parse(localStorage.getItem('offlinePlayers')) || [];
    let syncBtn = document.getElementById('syncBtn');
    
    if (syncBtn) {
        if (offlineQueue.length > 0) {
            syncBtn.style.display = 'block';
            syncBtn.innerText = `🔄 مزامنة البيانات المعلقة (${offlineQueue.length})`;
        } else {
            syncBtn.style.display = 'none';
        }
    }
}

// دالة زر المزامنة 
async function syncOfflineData() {
    let offlineQueue = JSON.parse(localStorage.getItem('offlinePlayers')) || [];
    if (offlineQueue.length === 0) return;

    const syncBtn = document.getElementById('syncBtn');
    syncBtn.innerText = 'جاري المزامنة...';
    syncBtn.disabled = true;

    try {
        for (let player of offlineQueue) {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(player)
            });
        }
        localStorage.removeItem('offlinePlayers');
        alert('✨ تمت المزامنة بنجاح! جميع البيانات أصبحت في Google Sheets.');
        loadPlayers();
    } catch (error) {
        alert('❌ فشلت المزامنة، تأكد من اتصال الإنترنت وحاول مرة أخرى.');
        syncBtn.disabled = false;
        checkPendingSync();
    }
}

// 3. عرض اللاعبين والبحث
function renderPlayers(data) {
    let html = '';
    let now = new Date();
    data.forEach(p => {
        let isExpired = new Date(p.expiryDate) < now;
        html += `
            <div class="player-card">
                <div>
                    <strong>${p.name}</strong> (${p.plan})<br>
                    <small>ينتهي: ${new Date(p.expiryDate).toLocaleDateString('ar-SY')}</small>
                </div>
                <div class="${isExpired ? 'status-expired' : 'status-active'}">
                    ${isExpired ? 'منتهي' : 'فعال'}
                </div>
            </div>`;
    });
    document.getElementById('playersList').innerHTML = html;
}

function filterPlayers() {
    let term = document.getElementById('searchInput').value;
    let filtered = playersData.filter(p => p.name.includes(term));
    renderPlayers(filtered);
}

// 4. نظام الكاميرا وقارئ الباركود
let html5QrcodeScanner = null;

function startScanner() {
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
        html5QrcodeScanner.render(onScanSuccess);
    }
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
    }
}

function onScanSuccess(decodedText) {
    stopScanner(); 
    let player = playersData.find(p => p.id === decodedText);
    let container = document.getElementById('mainContainer');
    let resultBox = document.getElementById('scanResult');

    if (!player) {
        resultBox.innerText = 'كود غير معروف!';
        container.className = 'container screen-red';
    } else {
        let isExpired = new Date(player.expiryDate) < new Date();
        if (isExpired) {
            resultBox.innerText = `❌ اشتراك منتهي!\nاللاعب: ${player.name}`;
            container.className = 'container screen-red';
        } else {
            resultBox.innerText = `✅ اشتراك فعال\nاللاعب: ${player.name}\nالنوع: ${player.plan}`;
            container.className = 'container screen-green';
        }
    }

    setTimeout(() => {
        container.className = 'container';
        resultBox.innerText = 'امسح كود اللاعب';
        startScanner();
    }, 3000);
}

window.onload = loadPlayers;
