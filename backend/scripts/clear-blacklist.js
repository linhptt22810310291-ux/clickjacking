/**
 * Script để clear blacklist và reset bot detection
 * Chạy file này khi bị chặn nhầm
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔧 BOT DETECTION - CLEAR BLACKLIST TOOL\n');
console.log('Script này sẽ:');
console.log('  ✅ Xóa tất cả IPs bị chặn');
console.log('  ✅ Reset tracking data');
console.log('  ✅ Cho phép bạn dùng website bình thường\n');

rl.question('Bạn có chắc muốn clear blacklist? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    try {
      // Import botDetection để access blacklist
      const path = require('path');
      const botDetectionPath = path.join(__dirname, '..', 'middleware', 'botDetection.js');
      
      // Clear require cache để đọc module mới
      delete require.cache[require.resolve(botDetectionPath)];
      
      const botDetection = require(botDetectionPath);
      
      console.log('\n🧹 Đang clear blacklist...');
      
      // Gọi API clear blacklist
      const axios = require('axios');
      
      axios.post('http://localhost:5000/api/admin/security/clear-blacklist')
        .then(response => {
          console.log('\n✅ THÀNH CÔNG!');
          console.log(`   Đã xóa ${response.data.clearedCount} IPs khỏi blacklist`);
          console.log('\n🎉 Bạn có thể dùng website bình thường!\n');
          rl.close();
        })
        .catch(error => {
          console.log('\n❌ LỖI: Không thể kết nối API');
          console.log('   Hãy chạy lệnh này thay thế:\n');
          console.log('   node -e "require(\'./backend/middleware/botDetection.js\').clearBlacklist()"');
          console.log('\n   Hoặc restart backend server.\n');
          rl.close();
        });
      
    } catch (error) {
      console.error('\n❌ LỖI:', error.message);
      console.log('\n💡 Cách khác: Restart backend server để tự động clear.\n');
      rl.close();
    }
  } else {
    console.log('\n❌ Đã hủy.\n');
    rl.close();
  }
});
