// 🔴 ضع الرابط الخاص بك هنا بين علامتي التنصيص
const API_URL = 'https://script.google.com/macros/s/AKfycbxWgo_JgJrdsWYwkLY3hCSs3j2ncYUL2t6vus7RQ2m6iWrIZ3qfUWQA7ruCYm5ySC_bbg/exec';

let playersData = [];

// التنقل بين الأقسام
// التنقل بين الأقسام وتلوين الزر النشط
function showSection(sectionId, btnElement) {
    // إخفاء جميع الأقسام
    document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
    // إظهار القسم المطلوب
    document.getElementById(sectionId).style.display = 'block';
    
    // إذا تم تمرير الزر، قم بتحديث الألوان
    if(btnElement) {
        document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active-tab'));
        btnElement.classList.add('active-tab');
    }
    
    if(sectionId === 'scanSection') startScanner();
    else stopScanner();
}

// 1. جلب البيانات من جوجل شيت
async function loadPlayers() {
    try {
        document.getElementById('playersList').innerHTML = 'جاري التحميل...';
        let response = await fetch(API_URL);
        playersData = await response.json();
        renderPlayers(playersData);
    } catch (error) {
        document.getElementById('playersList').innerHTML = 'حدث خطأ في الاتصال';
    }
}

// 2. تسجيل لاعب جديد
document.getElementById('addForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.innerText = 'جاري الحفظ...';
    btn.disabled = true;

    let joinDate = new Date();
    let expiryDate = new Date();
    let plan = document.getElementById('planType').value;

    if (plan === 'شهري') expiryDate.setDate(joinDate.getDate() + 30);
    else if (plan === 'أسبوعي') expiryDate.setDate(joinDate.getDate() + 7);
    else expiryDate.setHours(23, 59, 59, 999); // لنهاية اليوم

    let newId = 'GYM-' + Date.now(); // توليد ID فريد للاعب

    let data = {
        id: newId,
        name: document.getElementById('playerName').value,
        amount: document.getElementById('paymentAmount').value,
        plan: plan,
        joinDate: joinDate.toISOString(),
        expiryDate: expiryDate.toISOString()
    };

    // إرسال البيانات لجوجل
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(data)
    });

    // توليد الـ QR Code
    document.getElementById('qrcodeBox').innerHTML = '';
    new QRCode(document.getElementById('qrcodeBox'), { text: newId, width: 200, height: 200 });

    btn.innerText = 'حفظ وتوليد الكود';
    btn.disabled = false;
    this.reset();
    loadPlayers(); // تحديث القائمة
});

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
    // إيقاف المسح مؤقتاً لتجنب التكرار
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
            resultBox.innerText = `✅ اشتراك فعال\nاللاعب: ${player.name}\nنوع الاشتراك: ${player.plan}`;
            container.className = 'container screen-green';
        }
    }

    // إعادة الشاشة لوضعها الطبيعي وتشغيل الكاميرا بعد 3 ثواني
    setTimeout(() => {
        container.className = 'container';
        resultBox.innerText = 'امسح كود اللاعب';
        startScanner();
    }, 3000);
}

// تشغيل جلب البيانات عند فتح التطبيق
window.onload = loadPlayers;