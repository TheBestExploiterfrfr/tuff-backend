// api/index.js - PlayFab Proxy Server with SessionTicket for Client APIs

const express = require('express');
const axios = require('axios');

const app = express();  // ← Fixed: Full Express app (not Router)

// Vercel handles the port, no need for local PORT or app.listen()
// const PORT = 3000;

// Load PlayFab config
const PLAYFAB_TITLE_ID = "34dc6";

if (!PLAYFAB_TITLE_ID) {
    console.error("ERROR: PLAYFAB_TITLE_ID is required.");
    process.exit(1);
}

// Middleware
app.use(express.json());  // Replaces body-parser (built-in in Express)

// Logging middleware
app.use((req, res, next) => {
    console.log(`Received ${req.method} request for ${req.url} from ${req.ip}`);
    next();
});

// -------------------------
// Helpers
// -------------------------

async function proxyPlayFabClient(endpoint, body, sessionTicket) {
    try {
        const url = `https://${PLAYFAB_TITLE_ID}.playfabapi.com/${endpoint}`;

        const headers = {
            'Content-Type': 'application/json'
        };

        // Only attach session ticket if provided
        if (sessionTicket) {
            headers['X-Authorization'] = sessionTicket;
        }

        const response = await axios.post(url, body, { headers });
        return response.data;
    } catch (err) {
        return err.response ? err.response.data : { error: err.message };
    }
}

// -------------------------
// PlayFab Proxy Endpoints
// -------------------------

// CloudScript endpoints (server-level)
app.post('/CloudScript/ExecuteEntityCloudScript', async (req, res) => {
    const sessionTicket = req.headers['x-sessionticket'];
    const data = await proxyPlayFabClient(
        'CloudScript/ExecuteEntityCloudScript',
        req.body,
        sessionTicket
    );
    res.json(data);
});

app.post('/CloudScript/ExecuteFunction', async (req, res) => {
    const sessionTicket = req.headers['x-sessionticket'];
    const data = await proxyPlayFabClient(
        'CloudScript/ExecuteFunction',
        req.body,
        sessionTicket
    );
    res.json(data);
});

// Client endpoints

// LoginWithCustomID does not require a session ticket
app.get('/Client/LoginWithCustomID', async (req, res) => {
    const data = await proxyPlayFabClient('Client/LoginWithCustomID', req.body);
    res.json(data);
});

// Fixed double slashes
app.post('/Client/GetCatalogItems', async (req, res) => {
    res.json({
        "code": 200,
        "status": "OK",
        "data": { "Catalog": [] }
    });
});

// Mock GetUserInventory (using real GetUserData as base if needed)
app.post('/Client/GetUserInventory', async (req, res) => {
    const sessionTicket = req.headers['x-sessionticket'] || req.body.SessionTicket;

    // You can keep the real call or just return mock – here we return mock directly
    const mockResponse = {
        "code": 200,
        "status": "OK",
        "data": {
            "Inventory": [
                // Add mock inventory items here if desired
            ],
            "VirtualCurrency": {
                "GD": 500,
                "KY": 3
            },
            "VirtualCurrencyRechargeTimes": {}
        }
    };

    res.json(mockResponse);
});

// Test endpoint – should now work and show on root URL
app.get('/', (req, res) => {
    res.send('PlayFab Proxy is running!');
});

// Catch-all fallback for any other PlayFab client endpoints
app.all('*', async (req, res) => {
    let sessionTicket;
    if (req.headers['x-sessionticket']) {
        sessionTicket = req.headers['x-sessionticket'];
    } else if (req.body && req.body.SessionTicket) {
        sessionTicket = req.body.SessionTicket;
    }

    // Remove leading slash for PlayFab endpoint
    const endpoint = req.path.startsWith('/') ? req.path.slice(1) : req.path;

    const data = await proxyPlayFabClient(endpoint, req.body, sessionTicket);
    res.json(data);
});

// -------------------------
// Export for Vercel
// -------------------------
module.exports = app;
