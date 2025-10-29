const scanButton = document.getElementById('scan-button');
const scanTextInput = document.getElementById('scan-text-input');

scanButton.addEventListener('click', () => {
    // 1. Reset UI and show loading state
    document.getElementById('status-area').classList.remove('hidden');
    document.getElementById('results-area').classList.add('hidden');
    document.getElementById('status-message').textContent = 'Processing text...';
    scanButton.disabled = true;
    scanButton.textContent = 'Scanning...';

    // 2. Get text from the input field first (PRIORITY)
    let textToScan = scanTextInput.value.trim();

    if (textToScan.length > 0) {
        // Text is in the input field, proceed directly to API call
        sendScanRequest(textToScan);
    } else {
        // Input field is empty, try to get selected text from the page (FALLBACK)
        document.getElementById('status-message').textContent = 'Input empty. Fetching selected text from page...';
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];

            // Execute a content script to get the selected text
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: getSelectedText,
            }, (injectionResults) => {
                textToScan = injectionResults[0].result.trim();

                if (textToScan.length === 0) {
                    // No text in input and no text selected
                    updateUI('Error: Please paste text above or select text on the page.', false);
                } else {
                    // Found selected text, proceed with API call
                    sendScanRequest(textToScan);
                }
            });
        });
    }
});

// Function to run in the context of the active page to get selection
function getSelectedText() {
    return window.getSelection().toString();
}

// Function to send the text to the background service worker
function sendScanRequest(text) {
    updateUI('Sending text to Copyleaks for AI detection...', true);

    chrome.runtime.sendMessage({ action: "scanText", text: text }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError.message);
            updateUI('Error communicating with service worker.', false);
            return;
        }
        
        // Handle the API response
        if (response.error) {
            updateUI(`Scan Error: ${response.error}`, false);
        } else if (response.summary) {
            displayResults(response.summary.ai, response.summary.human);
        } else {
            updateUI('Scan complete, but no clear summary received.', false);
        }
    });
}

// Function to update the status message and button state
function updateUI(message, isScanning) {
    document.getElementById('status-message').textContent = message;
    
    if (isScanning) {
        scanButton.disabled = true;
        scanButton.textContent = 'Scanning...';
    } else {
        scanButton.disabled = false;
        scanButton.textContent = 'Scan Text';
        // Hide the results bar if an error/final message is shown after a scan
        document.getElementById('results-area').classList.add('hidden');
        document.getElementById('status-area').classList.remove('hidden');
    }
}

// Function to display the colorful results (no changes)
function displayResults(aiScore, humanScore) {
    const aiPercent = (aiScore * 100).toFixed(2);
    const humanPercent = (humanScore * 100).toFixed(2);

    document.getElementById('status-area').classList.add('hidden');
    document.getElementById('results-area').classList.remove('hidden');

    document.getElementById('ai-bar').style.width = `${aiPercent}%`;
    document.getElementById('human-bar').style.width = `${humanPercent}%`;

    document.getElementById('ai-score').textContent = `${aiPercent}%`;
    document.getElementById('human-score').textContent = `${humanPercent}%`;

    // Final status message based on the dominant score
    let finalMessage;
    if (aiScore > humanScore) {
        finalMessage = 'Content is likely AI-generated.';
    } else if (humanScore > aiScore) {
        finalMessage = 'Content is likely human-written.';
    } else {
        finalMessage = 'Inconclusive or balanced result.';
    }
    
    // Display the final message
    document.getElementById('status-area').classList.remove('hidden');
    document.getElementById('status-message').textContent = `Result: ${finalMessage}`;

    scanButton.disabled = false;
    scanButton.textContent = 'Scan Text';
}