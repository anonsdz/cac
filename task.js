const { exec, execSync } = require('child_process');
const { Telegraf } = require('telegraf');
const os = require('os');
const osu = require('os-utils');

const bot = new Telegraf('8129263243:AAFOt6TkEdnUaqUjddBnidEz1qt8qRveyT4');
let intervalId = null, isMonitoring = false, lastMessageId = null;

// Hàm lấy thông tin hệ thống
function getSystemInfo() {
    const totalMemory = os.totalmem() / (1024 ** 3); // GB
    const freeMemory = os.freemem() / (1024 ** 3); // GB
    const usedMemory = totalMemory - freeMemory; // GB
    const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);
    const totalCores = os.cpus().length;

    return new Promise((resolve) => {
        osu.cpuUsage(cpuUsagePercent => {
            const freeCpuCores = totalCores - Math.ceil(cpuUsagePercent * totalCores / 100); // Tính số lõi CPU còn trống
            const cpuModel = os.cpus()[0].model;
            const uptime = (os.uptime() / 3600).toFixed(2);
            const runningProcesses = execSync('ps aux | wc -l').toString().trim();

            resolve({
                totalMemory: totalMemory.toFixed(2),
                usedMemory: usedMemory.toFixed(2),
                freeMemory: freeMemory.toFixed(2),
                memoryUsagePercent,
                totalCores,
                freeCpuCores,
                cpuModel,
                cpuUsagePercent: (cpuUsagePercent * 100).toFixed(2),
                uptime,
                runningProcesses,
            });
        });
    });
}

// Hàm chạy speedtest-cli
function runSpeedTest() {
    return new Promise((resolve, reject) => {
        exec('speedtest-cli --secure --json', (error, stdout, stderr) => {
            if (error) return reject('Không thể kết nối đến máy chủ Speedtest.');
            try {
                const result = JSON.parse(stdout);
                resolve({
                    ping: result.ping,
                    download: (result.download / 1e6).toFixed(2),
                    upload: (result.upload / 1e6).toFixed(2),
                });
            } catch (err) {
                reject(`Lỗi phân tích kết quả: ${err.message}`);
            }
        });
    });
}

// Hàm cập nhật thông tin hệ thống và kết quả SpeedTest
async function updateSystemInfo(ctx) {
    try {
        const [systemInfo, speedTestResult] = await Promise.all([getSystemInfo(), runSpeedTest()]);

        const infoText = `📊 **Thông Tin Hệ Thống**:\n` +
            // Phần thông tin đứng yên
            `🔢 **Tiến Trình**: ${systemInfo.runningProcesses} tiến trình đang chạy\n` +
            `💾 **Total RAM**: ${systemInfo.totalMemory} GB\n` +
            `🧠 **CPU Model**: ${systemInfo.cpuModel}\n` +
            `💻 **Cores**: ${systemInfo.totalCores} (Free: ${systemInfo.freeCpuCores})\n` +
            `⏳ **Uptime**: ${systemInfo.uptime} giờ\n` +
            `🆓 **Free Memory**: ${systemInfo.freeMemory} GB\n\n` +
            // Phần thông tin cập nhật liên tục
            `📈 **CPU Usage**: ${systemInfo.cpuUsagePercent}% [${'■ '.repeat(Math.floor(systemInfo.cpuUsagePercent / 5)).padEnd(20)}] \n` +
            `🗑️ **Used Memory**: ${systemInfo.usedMemory} GB (${systemInfo.memoryUsagePercent}%) [${'■ '.repeat(Math.floor(systemInfo.memoryUsagePercent / 5)).padEnd(20)}]\n` +
            `🌐 **Kết Quả SpeedTest**: \n` +
            `📶 **Ping**: ${speedTestResult.ping} ms\n` +
            `⬇️ **Download**: ${speedTestResult.download} Mbps\n` +
            `⬆️ **Upload**: ${speedTestResult.upload} Mbps\n` +
            `Source: @NeganSSHConsole`;

        // Nếu có tin nhắn cũ, chỉnh sửa tin nhắn
        if (lastMessageId) {
            await ctx.editMessageText(infoText, { message_id: lastMessageId });
        } else {
            const message = await ctx.reply(infoText);
            lastMessageId = message.message_id;
        }
    } catch (err) {
        console.error(`Lỗi khi lấy thông tin: ${err}`);
        ctx.reply(`Lỗi: ${err}`);
    }
}

// Lệnh "/start"
bot.start((ctx) => {
    if (isMonitoring) return ctx.reply('Bot đang theo dõi thông tin!');
    isMonitoring = true;
    ctx.reply('Bắt đầu theo dõi thông tin hệ thống và tốc độ mạng mỗi 3 giây.');
    intervalId = setInterval(() => updateSystemInfo(ctx), 3000); // Cập nhật mỗi 3 giây
});

// Lệnh "/stop"
bot.command('stop', (ctx) => {
    if (!isMonitoring) return ctx.reply('Bot chưa theo dõi thông tin.');
    clearInterval(intervalId); // Dừng tiến trình theo dõi
    intervalId = null;
    isMonitoring = false;
    ctx.reply('Đã dừng cập nhật thông tin.');

    // Xóa bảng thông tin đã gửi
    if (lastMessageId) {
        ctx.deleteMessage(lastMessageId); // Xóa tin nhắn
        lastMessageId = null;
    }
});

// Khởi chạy bot
bot.launch();
console.log('Bot đã chạy thành công!');
