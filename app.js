const API_URL = 'https://script.google.com/macros/s/AKfycbxWgo_JgJrdsWYwkLY3hCSs3j2ncYUL2t6vus7RQ2m6iWrIZ3qfUWQA7ruCYm5ySC_bbg/exec';

let playersData = [];

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

// 1. جلب البيانات ودمج التكرارات بأمان
async function loadPlayers() {
    try {
        document.getElementById('playersList').innerHTML = 'جاري التحميل...';
        let response = await fetch(API_URL);
        let rawData = await response.json();
        
        let mergedPlayers = {};
        rawData.forEach(p => {
            let uniqueKey = p.phone || p.id; 
            
            if (!mergedPlayers[uniqueKey]) {
                mergedPlayers[uniqueKey] = p;
            } else {
                let currentExpiry = new Date(mergedPlayers[uniqueKey].expiryDate);
                let newExpiry = new Date(p.expiryDate);
                if (newExpiry > currentExpiry) mergedPlayers[uniqueKey] = p;
            }
        });
        
        playersData = Object.values(mergedPlayers);
        localStorage.setItem('cachedPlayers', JSON.stringify(playersData));
        renderPlayers(playersData);
    } catch (error) {
        let cached = localStorage.getItem('cachedPlayers');
        if (cached) {
            playersData = JSON.parse(cached);
            renderPlayers(playersData);
        } else {
            document.getElementById('playersList').innerHTML = 'تعذر الاتصال ولا توجد بيانات.';
        }
    }
    checkPendingSync();
}

// 2. تسجيل لاعب جديد (تحديث فوري مع QR مخصص للسكرين شوت)
document.getElementById('addForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    // استخدام trim() لإزالة أي فراغات بالغلط
    let phone = document.getElementById('playerPhone').value.trim();
    
    // فحص إذا الرقم موجود مسبقاً
    if(playersData.find(p => p.phone && String(p.phone).trim() === phone)) {
        alert('هذا الرقم مسجل مسبقاً! يرجى الذهاب لواجهة "تجديد اشتراك".');
        return;
    }

    const btn = document.getElementById('submitBtn');
    let dateValue = document.getElementById('joinDateInput').value;
    let joinDate = new Date(dateValue);
    let expiryDate = new Date(joinDate);
    let plan = document.getElementById('planType').value;

    if (plan === 'شهري') expiryDate.setDate(joinDate.getDate() + 30);
    else if (plan === 'أسبوعي') expiryDate.setDate(joinDate.getDate() + 7);
    expiryDate.setHours(23, 59, 59, 999);

    let newId = 'GYM-' + Date.now();
    let data = {
        id: newId,
        name: document.getElementById('playerName').value,
        phone: phone,
        amount: document.getElementById('paymentAmount').value,
        plan: plan,
        joinDate: joinDate.toISOString(),
        expiryDate: expiryDate.toISOString()
    };

    // توليد الـ QR مع منطقة أمان (حواف بيضاء عريضة جداً) لتسهيل قراءة السكرين شوت
    let qrBox = document.getElementById('qrcodeBox');
    qrBox.innerHTML = '';
    qrBox.style.backgroundColor = '#ffffff'; 
    qrBox.style.padding = '50px'; // مساحة بيضاء ضخمة حول الكود
    qrBox.style.borderRadius = '10px';
    qrBox.style.display = 'inline-block';
    qrBox.style.marginTop = '20px';
    
    new QRCode(qrBox, { text: newId, width: 220, height: 220 });

    // إضافة اللاعب محلياً فوراً ليتمكن من مسح الـ QR بثانية واحدة
    playersData.push(data);
    localStorage.setItem('cachedPlayers', JSON.stringify(playersData));
    renderPlayers(playersData);

    if (navigator.onLine) {
        btn.innerText = 'جاري الحفظ...'; btn.disabled = true;
        try {
            await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
        } catch (err) { saveOfflinePlayer(data); }
        btn.innerText = 'حفظ وتوليد الكود'; btn.disabled = false;
    } else {
        saveOfflinePlayer(data);
        alert('تم الحفظ محلياً.');
    }
    this.reset();
});

// 3. نظام تجديد الاشتراك (تحديث فوري وبحث آمن)
function searchPlayerForRenew() {
    // نستخدم trim() للتأكد من عدم وجود مسافات
    let phone = document.getElementById('searchPhoneRenew').value.trim();
    
    // تحويل رقم الداتابيز لنص ومطابقته بدقة
    let player = playersData.find(p => p.phone && String(p.phone).trim() === phone);
    
    if(player) {
        document.getElementById('renewFormContainer').style.display = 'block';
        document.getElementById('renewPlayerName').innerText = player.name;
        document.getElementById('renewCurrentExpiry').innerText = new Date(player.expiryDate).toLocaleDateString('ar-SY');
        document.getElementById('renewPlayerId').value = player.id;
    } else {
        alert('لم يتم العثور على لاعب بهذا الرقم! تأكد من إدخال الرقم بشكل صحيح.');
        document.getElementById('renewFormContainer').style.display = 'none';
    }
}

document.getElementById('renewForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    let phone = document.getElementById('searchPhoneRenew').value.trim();
    let player = playersData.find(p => p.phone && String(p.phone).trim() === phone);
    if(!player) return;

    let plan = document.getElementById('renewPlanType').value;
    let amount = document.getElementById('renewPaymentAmount').value;
    let btn = document.getElementById('renewBtn');

    let now = new Date();
    let currentExpiry = new Date(player.expiryDate);
    let startDate = currentExpiry > now ? currentExpiry : now;
    let newExpiry = new Date(startDate);

    if (plan === 'شهري') newExpiry.setDate(startDate.getDate() + 30);
    else if (plan === 'أسبوعي') newExpiry.setDate(startDate.getDate() + 7);
    newExpiry.setHours(23, 59, 59, 999);

    let data = {
        id: player.id,
        name: player.name,
        phone: player.phone,
        amount: amount,
        plan: plan,
        joinDate: now.toISOString(),
        expiryDate: newExpiry.toISOString()
    };

    // تحديث اللاعب محلياً فوراً
    let index = playersData.findIndex(x => x.id === player.id);
    if(index !== -1) {
        playersData[index] = data;
        localStorage.setItem('cachedPlayers', JSON.stringify(playersData));
        renderPlayers(playersData);
    }

    if (navigator.onLine) {
        btn.innerText = 'جاري التجديد...'; btn.disabled = true;
        try {
            await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
            alert('تم التجديد بنجاح! الكود القديم يعمل الآن بالصلاحية الجديدة.');
        } catch (err) { saveOfflinePlayer(data); }
        btn.innerText = 'تأكيد التجديد'; btn.disabled = false;
        document.getElementById('renewFormContainer').style.display = 'none';
    } else {
        saveOfflinePlayer(data);
        alert('تم التجديد محلياً.');
    }
    this.reset();
});

// وظائف الأوفلاين والمزامنة
function saveOfflinePlayer(data) {
    let offlineQueue = JSON.parse(localStorage.getItem('offlinePlayers')) || [];
    offlineQueue.push(data);
    localStorage.setItem('offlinePlayers', JSON.stringify(offlineQueue));
    checkPendingSync();
}

function checkPendingSync() {
    let offlineQueue = JSON.parse(localStorage.getItem('offlinePlayers')) || [];
    let syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        if (offlineQueue.length > 0) {
            syncBtn.style.display = 'block';
            syncBtn.innerText = `🔄 مزامنة البيانات (${offlineQueue.length})`;
        } else { syncBtn.style.display = 'none'; }
    }
}

async function syncOfflineData() {
    let offlineQueue = JSON.parse(localStorage.getItem('offlinePlayers')) || [];
    if (offlineQueue.length === 0) return;
    const syncBtn = document.getElementById('syncBtn');
    syncBtn.innerText = 'جاري المزامنة...'; syncBtn.disabled = true;
    try {
        for (let player of offlineQueue) {
            await fetch(API_URL, { method: 'POST', body: JSON.stringify(player) });
        }
        localStorage.removeItem('offlinePlayers');
        alert('✨ تمت المزامنة بنجاح!');
        loadPlayers();
    } catch (error) {
        alert('❌ فشلت المزامنة.');
        syncBtn.disabled = false;
    }
}

// 4. عرض اللاعبين
function renderPlayers(data) {
    let html = '';
    let now = new Date();
    data.slice().reverse().forEach(p => {
        let expiry = new Date(p.expiryDate);
        expiry.setHours(23, 59, 59, 999);
        let isExpired = expiry < now;
        html += `
            <div class="player-card">
                <div>
                    <strong>${p.name}</strong> (${p.phone || 'بدون رقم'})<br>
                    <small>ينتهي: ${expiry.toLocaleDateString('ar-SY')}</small>
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
    let filtered = playersData.filter(p => p.name.includes(term) || (p.phone && String(p.phone).includes(term)));
    renderPlayers(filtered);
}

// 5. قارئ الباركود
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
        let expiry = new Date(player.expiryDate);
        expiry.setHours(23, 59, 59, 999);
        
        if (expiry < new Date()) {
            resultBox.innerText = `❌ اشتراك منتهي!\nاللاعب: ${player.name}\nانتهى في: ${expiry.toLocaleDateString('ar-SY')}`;
            container.className = 'container screen-red';
        } else {
            resultBox.innerText = `✅ اشتراك فعال\nاللاعب: ${player.name}\nينتهي في: ${expiry.toLocaleDateString('ar-SY')}`;
            container.className = 'container screen-green';
        }
    }

    setTimeout(() => {
        container.className = 'container';
        resultBox.innerText = 'امسح كود اللاعب';
        startScanner();
    }, 3500);
}

window.onload = () => {
    loadPlayers();
    document.getElementById('joinDateInput').value = new Date().toISOString().split('T')[0];
};
