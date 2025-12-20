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
