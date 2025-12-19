// index.js - PlayFab Proxy Server with SessionTicket for Client APIs

const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express.Router();
const PORT = 3000;

// Load PlayFab config
const PLAYFAB_TITLE_ID = "34dc6";

if (!PLAYFAB_TITLE_ID) {
    console.error("ERROR: PLAYFAB_TITLE_ID is required.");
    process.exit(1);
}

app.use(bodyParser.json());

// -------------------------
// Helpers
// -------------------------

// Client-level request (user APIs, using SessionTicket)
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

app.use((req, res, next) => {
    console.log(`Received ${req.method} request for ${req.url} ${req.ip}`);

    next();
})

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

// Client endpoints (user-level)

// LoginWithCustomID does not need a session ticket yet
app.get('/Client/LoginWithCustomID', async (req, res) => {
    const data = await proxyPlayFabClient(
        'Client/LoginWithCustomID',
        req.body
    );
    res.json(data);
});

app.post("//Client/GetCatalogItems", async (req, res) => {
    res.json({"code":200,"status":"OK","data":{"Catalog":[]}});
})

// Mock GetUserInventory
app.post('//Client/GetUserInventory', async (req, res) => {
    const sessionTicket = req.headers['x-sessionticket'] || req.body.SessionTicket;
    const data = await proxyPlayFabClient('Client/GetUserData', req.body, sessionTicket);

    const mockResponse = 
        {
        "code": 200,
            "data": {
            "Inventory": [
// Mock inventory items can be added here (replace it with this entire line)
            ],
                "VirtualCurrency": {
                "GD": 500,
                    "KY": 3
            },
            "VirtualCurrencyRechargeTimes": { }
        },
        "status": "OK"
    };
    res.json(mockResponse);
});

// Test endpoint
app.get('/', (req, res) => {
    res.send('PlayFab Proxy is running!');
});

app.use(async (req, res, next) => {
    let sessionTicket;
    if (req.headers['x-sessionticket']) {
        sessionTicket = req.headers['x-sessionticket'];
    } else if (req.body && req.body.SessionTicket) {
        sessionTicket = req.body.SessionTicket;
    }

    const data = await proxyPlayFabClient(req.path, req.body, sessionTicket);
    res.json(data);
});

// -------------------------
// Start server
// -------------------------
module.exports = app;