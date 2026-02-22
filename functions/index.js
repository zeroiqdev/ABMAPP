/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");

// Cloudinary imports
const functions = require("firebase-functions");
const cors = require("cors")({origin: true});
const {v2: cloudinary} = require("cloudinary");
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
setGlobalOptions({maxInstances: 10});

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
      const busboy = new Busboy({headers: req.headers});
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
        const options = {folder};
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
      return res.status(500).json({error: "Upload failed"});
    }
  });
});

// Monnify Integration
const axios = require("axios");
const admin = require("firebase-admin");
if (!admin.apps.length) {
  admin.initializeApp();
}

const getMonnifyToken = async () => {
  const config = functions.config().monnify;
  if (!config) throw new Error("Monnify config not found");

  const apiKey = config.api_key;
  const secretKey = config.secret_key;
  // Base64 encode API_KEY:SECRET_KEY
  const auth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

  try {
    // Using Sandbox URL for now. Production URL: https://api.monnify.com
    // Sandbox: https://sandbox.monnify.com
    const baseUrl = config.base_url || "https://sandbox.monnify.com";

    const response = await axios.post(
        `${baseUrl}/api/v1/auth/login`,
        {},
        {headers: {Authorization: `Basic ${auth}`}},
    );
    return response.data.responseBody.accessToken;
  } catch (error) {
    console.error("Monnify Auth Error:",
        error.response?.data || error.message);
    throw new Error("Failed to authenticate with Monnify");
  }
};

/**
 * Initializes a Monnify transaction by reserving a bank account.
 * @param {object} data - The request data.
 * @param {string} data.orderId - The unique ID for the order.
 * @param {string} data.customerName - The name of the customer.
 * @param {string} data.customerEmail - The email of the customer.
 * @return {Promise<object>} An object containing transaction details
 *   or an error message.
 */
exports.initializeMonnifyTransaction = functions.https.onCall(async (data) => {
  // data: { orderId, customerName, customerEmail }
  try {
    const token = await getMonnifyToken();
    const config = functions.config().monnify;
    const contractCode = config.contract_code;
    const baseUrl = config.base_url || "https://sandbox.monnify.com";

    // Sanitize customer name for account name
    const sanitizedName = data.customerName
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .substring(0, 20);

    const response = await axios.post(
        `${baseUrl}/api/v2/bank-transfer/reserved-accounts`,
        {
          accountReference: data.orderId,
          accountName: `ABM-${sanitizedName}`,
          currencyCode: "NGN",
          contractCode: contractCode,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
          getAllAvailableBanks: true,
        },
        {headers: {Authorization: `Bearer ${token}`}},
    );

    const account = response.data.responseBody;
    return {
      success: true,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      reference: account.accountReference,
    };
  } catch (error) {
    console.error("Monnify Reservation Error:",
        error.response?.data || error.message);
    return {success: false, error: "Failed to reserve Monnify account"};
  }
});

/**
 * Handles incoming webhooks from Monnify for transaction notifications.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
exports.monnifyWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const body = req.body;
    console.log("Monnify Webhook Received:", JSON.stringify(body));

    // Basic validation could involve checking signature hash,
    // but skipping for MVP speed
    const eventType = body.eventType;

    if (eventType === "SUCCESSFUL_TRANSACTION_NOTIFICATION") {
      const eventData = body.eventData;
      // accountReference passed during reservation
      const orderId = eventData.product.reference;
      const paidAmount = eventData.amountPaid;

      // Verify order exists
      const orderRef = admin.firestore().collection("orders").doc(orderId);
      const orderSnap = await orderRef.get();

      if (orderSnap.exists) {
        await orderRef.update({
          status: "confirmed", // Mark as paid/confirmed
          monnifyPaymentStatus: "paid",
          monnifyTransactionRef: eventData.transactionReference,
          amountPaid: paidAmount, // Store actual paid amount
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Order ${orderId} confirmed via Monnify`);
      } else {
        console.warn(`Order ${orderId} not found for Monnify webhook`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Error processing webhook");
  }
});

// ============================================================================
// PUSH NOTIFICATION HELPERS & TRIGGERS (REMOVED FOR CLIENT-SIDE STRATEGY)
// ============================================================================
// Since the project is on the Spark plan (Free), we cannot use Cloud Functions
// for triggers that require Node.js 10+ (which is all of them now).
// We have moved the push notification logic to the client-side app.
// It directly calls the Expo Push API upon job/order creation.

// ============================================================================
// RESEND EMAIL SERVICE
// ============================================================================
const {Resend} = require("resend");

const getResendClient = () => {
  const apiKey = functions.config().resend?.api_key;
  if (!apiKey) {
    throw new Error("Resend API key not configured.");
  }
  return new Resend(apiKey);
};

const FROM_EMAIL = "ABM Workshop <onboarding@resend.dev>";

// ---- HTML Email Templates ----

const emailWrapper = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #fff; border-radius: 12px; padding: 40px; }
    .logo {
      font-size: 24px; font-weight: 800; color: #111; margin-bottom: 24px;
    }
    h1 { font-size: 22px; font-weight: 700; color: #111; margin: 0 0 8px; }
    p { font-size: 15px; line-height: 1.6; color: #555; margin: 0 0 16px; }
    .code-box { background: #f8f8f8; border: 2px dashed #ddd; padding: 20px; }
    .code { font-size: 32px; font-weight: 800; letter-spacing: 4px; }
    .badge {
      background: #111; color: #fff; font-size: 12px; padding: 4px 12px;
    }
    .footer {
      text-align: center; margin-top: 24px; font-size: 12px; color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">ABM</div>
      ${content}
    </div>
  </div>
</body>
</html>`;

const staffInviteTemplate = (name, role, invitationCode, workshopName) =>
  emailWrapper(`
  <h1>You're Invited! 🎉</h1>
  <p>Hi ${name},</p>
  <p>You've been invited to join
    <strong>${workshopName || "a workshop"}</strong>
  as a <span class="badge">${role.replace("_", " ")}</span>.</p>
  <p>Use this invitation code to set up your account in the ABM app:</p>
  <div class="code-box">
    <div class="code">${invitationCode}</div>
  </div>
  <p>Open the ABM app and enter this code to get started.</p>
`);

const welcomeTemplate = (name, role) => emailWrapper(`
  <h1>Welcome to ABM! 👋</h1>
  <p>Hi ${name},</p>
  <p>Your account has been created as <span class="badge">
  ${(role || "member").replace("_", " ")}</span>.</p>
  <p>You can now access the ABM platform. Here's what you can do:</p>
  <ul style="color: #555; font-size: 15px; line-height: 2;">
    <li>Access workshop services and manage your jobs</li>
    <li>Browse the marketplace for auto parts</li>
  </ul>
`);

const passwordResetTemplate = (name, resetLink) => emailWrapper(`
  <h1>Reset Your Password 🔑</h1>
  <p>Hi ${name || "there"},</p>
  <p>We received a request to reset your password:</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="${resetLink}"
      style="background: #111; color: #fff; padding: 14px;">
      Reset Password
    </a>
  </div>
`);

// ---- Cloud Function Triggers ----

exports.onStaffInvitationCreated = functions.firestore
    .document("staffInvitations/{invitationId}")
    .onCreate(async (snap) => {
      const data = snap.data();
      if (!data.email) return;

      try {
        const resend = getResendClient();
        let workshopName = "";
        if (data.workshopId) {
          try {
            const wsDoc = await admin.firestore().collection("workshops")
                .doc(data.workshopId).get();
            if (wsDoc.exists) workshopName = wsDoc.data().name || "";
          } catch (e) {
          // Silently skip if workshop lookup fails
          }
        }

        await resend.emails.send({
          from: FROM_EMAIL,
          to: [data.email],
          subject: `You're invited to join ${workshopName || "ABM Workshop"}!`,
          html: staffInviteTemplate(
              data.name || "there",
              data.role || "staff",
              data.invitationCode,
              workshopName,
          ),
        });
      } catch (error) {
        console.error("Failed to send invitation email:", error);
      }
    });

exports.onNewUserCreated = functions.firestore
    .document("users/{userId}")
    .onCreate(async (snap) => {
      const data = snap.data();
      if (!data.email) return;

      try {
        const resend = getResendClient();
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [data.email],
          subject: "Welcome to ABM Workshop & Marketplace!",
          html: welcomeTemplate(data.name || "there", data.role),
        });
      } catch (error) {
        console.error("Failed to send welcome email:", error);
      }
    });

exports.sendCustomPasswordReset = functions.https.onCall(async (data) => {
  const {email} = data;
  if (!email) return {success: false, error: "Email is required"};

  try {
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    let userName = "";
    const userQuery = await admin.firestore().collection("users")
        .where("email", "==", email.toLowerCase().trim())
        .limit(1).get();
    if (!userQuery.empty) {
      userName = userQuery.docs[0].data().name || "";
    }

    const resend = getResendClient();
    await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: "Reset Your ABM Password",
      html: passwordResetTemplate(userName, resetLink),
    });
    return {success: true};
  } catch (error) {
    console.error("Password reset email error:", error);
    return {success: false, error: error.message || "Failed to send email"};
  }
});
