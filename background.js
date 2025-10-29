// **Important**: For security, store your credentials more securely than directly in the code.
// This is for demonstration. In a real-world extension, use chrome.storage.local.
const COYLEAKS_EMAIL = 'aahilirfan1218@gmail.com'; // <--- REPLACE THIS
const COYLEAKS_API_KEY = 'b9deb46b-6a6a-41b8-a1b1-a9f2a3f16c91';       // <--- REPLACE THIS

const LOGIN_URL = 'https://id.copyleaks.com/v3/account/login/api';
const AI_DETECTION_BASE_URL = 'https://api.copyleaks.com/v2/writer-detector/';

let authToken = null; 

// --- 1. Login to Copyleaks to get an Access Token ---
async function loginToCopyleaks() {
    try {
        const response = await fetch(LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ email: COYLEAKS_EMAIL, key: COYLEAKS_API_KEY })
        });

        if (!response.ok) {
            throw new Error(`Login failed with status: ${response.status}`);
        }

        const data = await response.json();
        authToken = data.access_token;
        console.log('Copyleaks Login Successful. Token obtained.');
        return authToken;
    } catch (error) {
        console.error('Copyleaks Login Error:', error);
        return null;
    }
}

// --- 2. Submit Text for AI Detection (Core API Call) ---
async function checkAiContent(text) {
    // Ensure we have a token
    if (!authToken) {
        console.warn("No auth token. Attempting to log in...");
        if (!(await loginToCopyleaks())) {
            return { error: "Authentication failed. Cannot perform scan." };
        }
    }

    const scanId = `scan-${Date.now()}`;
    const checkUrl = `${AI_DETECTION_BASE_URL}${scanId}/check`;

    try {
        const response = await fetch(checkUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                text: text,
                sandbox: false // Set to true for testing without using credits
            })
        });

        if (!response.ok) {
             // Handle token expiration/invalid credentials (401)
             if (response.status === 401) { 
                console.warn("Token expired or invalid. Re-attempting login.");
                authToken = null; 
                if (await loginToCopyleaks()) {
                     // Try the scan again with the new token
                    return checkAiContent(text); 
                }
            }

            const errorText = await response.text();
            throw new Error(`API scan failed: ${response.status} - ${errorText.substring(0, 100)}...`);
        }

        return await response.json();

    } catch (error) {
        console.error('Copyleaks AI Check Error:', error);
        return { error: error.message };
    }
}

// --- 3. Extension Logic: Service Worker Handlers ---

// Listen for messages from the popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanText") {
        // Run the async API call and send the result back to the popup.js
        checkAiContent(request.text).then(sendResponse);
        // Important: return true to indicate you wish to send a response asynchronously
        return true; 
    }
});

// Create the context menu item on extension startup (optional now that we have a popup)
chrome.runtime.onInstalled.addListener(() => {
    loginToCopyleaks(); 
});

// Re-attempt login if the service worker is reactivated and the token is gone
chrome.runtime.onStartup.addListener(loginToCopyleaks);