import "dotenv/config";

import { createApp } from "./app.js";

/** نقطه ورود اصلی برنامه — اپلیکیشن را می‌سازد و بات را راه‌اندازی می‌کند. */
async function main() {
    const { bot } = createApp();

    console.log("Telegram bot starting...");

    await bot.start();
}

main().catch((error) => {
    console.error("Application failed to start");

    if (error instanceof Error) {
        console.error(error.message);
    }

    process.exit(1);
});