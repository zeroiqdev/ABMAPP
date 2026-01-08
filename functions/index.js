/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");

// Cloudinary imports
const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { v2: cloudinary } = require("cloudinary");
const Busboy = require("busboy");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Configure Cloudinary
cloudinary.config({
  cloud_name: functions.config().cloudinary.cloud_name,
  api_key: functions.config().cloudinary.api_key,
  api_secret: functions.config().cloudinary.api_secret,
});

// Cloudinary upload function
exports.uploadImage = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    try {
      const busboy = new Busboy({ headers: req.headers });
      let fileBuffer = Buffer.alloc(0);
      const folder = req.query.folder ||
        (req.body && req.body.folder) || "general";
      const transformation = req.query.transformation ||
        (req.body && req.body.transformation);

      busboy.on("file", (_name, file) => {
        file.on("data", (data) => {
          fileBuffer = Buffer.concat([fileBuffer, data]);
        });
      });

      busboy.on("finish", async () => {
        const options = { folder };
        if (transformation) {
          options.transformation =
            transformation.split("/").filter(Boolean);
        }

        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(options, (error, uploaded) => {
              if (error || !uploaded) return reject(error);
              resolve(uploaded);
            })
            .end(fileBuffer);
        });

        return res.json({
          url: result.secure_url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      });

      req.pipe(busboy);
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
});

// Monnify Integration
const axios = require('axios');
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}

const getMonnifyToken = async () => {
  const config = functions.config().monnify;
  if (!config) throw new Error('Monnify config not found');

  const apiKey = config.api_key;
  const secretKey = config.secret_key;
  // Base64 encode API_KEY:SECRET_KEY
  const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

  try {
    // Using Sandbox URL for now. Production URL: https://api.monnify.com
    // Sandbox: https://sandbox.monnify.com
    const baseUrl = config.base_url || 'https://sandbox.monnify.com';

    const response = await axios.post(
      `${baseUrl}/api/v1/auth/login`,
      {},
      { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.responseBody.accessToken;
  } catch (error) {
    console.error('Monnify Auth Error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Monnify');
  }
};

exports.initializeMonnifyTransaction = functions.https.onCall(async (data, context) => {
  // data: { orderId, customerName, customerEmail }
  try {
    const token = await getMonnifyToken();
    const config = functions.config().monnify;
    const contractCode = config.contract_code;
    const baseUrl = config.base_url || 'https://sandbox.monnify.com';

    const response = await axios.post(
      `${baseUrl}/api/v2/bank-transfer/reserved-accounts`,
      {
        accountReference: data.orderId,
        accountName: `ABM-${data.customerName.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 20)}`,
        currencyCode: 'NGN',
        contractCode: contractCode,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        getAllAvailableBanks: true
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const account = response.data.responseBody;
    return {
      success: true,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      reference: account.accountReference
    };
  } catch (error) {
    console.error('Monnify Reservation Error:', error.response?.data || error.message);
    return { success: false, error: 'Failed to reserve Monnify account' };
  }
});

exports.monnifyWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const body = req.body;
    console.log('Monnify Webhook Received:', JSON.stringify(body));

    // Basic validation could involve checking signature hash, but skipping for MVP speed
    const eventType = body.eventType;

    if (eventType === 'SUCCESSFUL_TRANSACTION_NOTIFICATION') {
      const eventData = body.eventData;
      const orderId = eventData.product.reference; // accountReference passed during reservation
      const paidAmount = eventData.amountPaid;

      // Verify order exists
      const orderRef = admin.firestore().collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();

      if (orderSnap.exists) {
        await orderRef.update({
          status: 'confirmed', // Mark as paid/confirmed
          monnifyPaymentStatus: 'paid',
          monnifyTransactionRef: eventData.transactionReference,
          amountPaid: paidAmount, // Store actual paid amount
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Order ${orderId} confirmed via Monnify`);
      } else {
        console.warn(`Order ${orderId} not found for Monnify webhook`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).send('Error processing webhook');
  }
});
