const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const fetch = require('node-fetch'); // Use node-fetch for backend API calls

const app = express();
const port = 3000;

// --- IMPORTANT ---
// Replace this with your actual Bot Token.
const token = '7490160863:AAGfFMMV7q7cVCwB-oPajyrvph4VxuP5JRA';
const OWM_API_KEY = '3c07acc541b22886290d2e7ff1d9536d'; // Your OpenWeatherMap API Key
const OC_API_KEY = '9977884d23884e61812bbf7ce103cc5f'; // Your OpenCage API Key


// --- Server Initialization ---
if (!token || token.includes('YOUR_')) {
    console.error('FATAL ERROR: Telegram Bot Token is not configured in backend/server.js. Please add it.');
    process.exit(1); // Exit the process if the token is missing
}

// Switch to polling to actively listen for bot commands
const bot = new TelegramBot(token, { polling: true });

app.use(cors());
app.use(express.json());

// --- API Endpoint for Sending Notifications (from web app) ---
app.post('/send-notification', (req, res) => {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
        return res.status(400).send({ success: false, error: 'chatId and message are required' });
    }

    // Send message with Markdown formatting
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
        .then(() => {
            res.status(200).send({ success: true, message: 'Notification sent successfully' });
        })
        .catch((error) => {
            const errorMessage = error.response ? error.response.body : 'An unknown error occurred.';
            console.error('Telegram Error:', errorMessage);
            res.status(500).send({ success: false, message: 'Failed to send notification', details: errorMessage });
        });
});

// --- Bot Command Handler for /risk ---
bot.onText(/\/risk (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const area = match[1];

    try {
        // 1. Geocode the area name to get coordinates
        const geoUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(area)}&key=${OC_API_KEY}&limit=1`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            bot.sendMessage(chatId, `Sorry, I couldn't find the location "${area}". Please try a different name.`);
            return;
        }

        const { lat, lng } = geoData.results[0].geometry;
        const locationName = geoData.results[0].formatted;

        // 2. Fetch weather data for the coordinates
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${OWM_API_KEY}`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        if (weatherData.cod !== 200) {
            bot.sendMessage(chatId, `Sorry, I couldn't fetch weather data for "${area}".`);
            return;
        }

        const weather = {
            temp: weatherData.main.temp,
            humidity: weatherData.main.humidity,
            precip: weatherData.rain ? weatherData.rain['1h'] : 0
        };

        // 3. Calculate flood risk
        const risk = calculateFloodRisk(weather.temp, weather.humidity, weather.precip);

        // 4. Format and send the reply
        // IMPORTANT: Replace 'http://127.0.0.1:5500' with your actual deployed app URL
        const mapLink = `http://127.0.0.1:5500/index.html?lat=${lat}&lon=${lng}&zoom=13`;
        
        const replyMessage = `
🌊 *Flood Risk Report for ${locationName}* 🌊
---------------------------------
*Weather Summary:*
🌡️ Temperature: ${weather.temp} °C
💧 Humidity: ${weather.humidity}%
🌧️ Precipitation (1hr): ${weather.precip} mm
---------------------------------
*Risk Assessment:*
🚨 *${risk.level}*
---------------------------------
[View on Map](${mapLink})
        `;

        bot.sendMessage(chatId, replyMessage.trim(), { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Error processing /risk command:", error);
        bot.sendMessage(chatId, "Sorry, an error occurred while processing your request.");
    }
});

// --- Risk Calculation Logic (mirrored from frontend) ---
function calculateFloodRisk(temp, humidity, precip) {
    let score = 0;
    if (precip > 10) score += 3;
    else if (precip > 2.5) score += 2;
    else if (precip > 0) score += 1;
    if (humidity > 85) score += 2;
    if (temp > 0) score += 1;

    if (score >= 5) return { level: 'High Risk', color: '#e74c3c' };
    if (score >= 3) return { level: 'Moderate Risk', color: '#f39c12' };
    return { level: 'Low Risk', color: '#2ecc71' };
}


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Telegram bot is now actively listening for commands...');
});