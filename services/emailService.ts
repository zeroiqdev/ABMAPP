/**
 * emailService.ts
 * Centralized service for sending emails via Resend REST API (Client-side for React Native).
 */

import Constants from 'expo-constants';

const RESEND_API_KEY = Constants.expoConfig?.extra?.resendApiKey;
const FROM_EMAIL = 'ABM Workshop <onboarding@resend.dev>';
const API_URL = 'https://api.resend.com/emails';

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; background: #f5f5f5; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { font-size: 24px; font-weight: 800; color: #111; letter-spacing: -0.5px; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111; margin: 0 0 8px; }
    p { font-size: 15px; line-height: 1.6; color: #555; margin: 0 0 16px; }
    .code-box { background: #f8f8f8; border: 2px dashed #ddd; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .code { font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #111; font-family: monospace; }
    .badge { display: inline-block; background: #111; color: #fff; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; text-transform: capitalize; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">ABM</div>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ABM Workshop & Marketplace. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

const staffInviteTemplate = (name: string, role: string, invitationCode: string, workshopName?: string) => emailWrapper(`
  <h1>You're Invited! 🎉</h1>
  <p>Hi ${name || 'there'},</p>
  <p>You've been invited to join <strong>${workshopName || 'a workshop'}</strong> as a <span class="badge">${role.replace('_', ' ')}</span>.</p>
  <p>Use this invitation code to set up your account in the ABM app:</p>
  <div class="code-box">
    <div class="code">${invitationCode}</div>
  </div>
  <p>Open the ABM app, go to <strong>Staff Invite</strong>, and enter this code to get started.</p>
`);

const welcomeTemplate = (name: string, role?: string) => emailWrapper(`
  <h1>Welcome to ABM! 👋</h1>
  <p>Hi ${name || 'there'},</p>
  <p>Your account has been successfully created as a <span class="badge">${(role || 'member').replace('_', ' ')}</span>.</p>
  <p>You can now access the ABM Workshop & Marketplace platform. Here's what you can do:</p>
  <ul style="color: #555; font-size: 15px; line-height: 2;">
    <li>Access workshop services and manage your jobs</li>
    <li>Browse the marketplace for auto parts</li>
    <li>Track orders and service history</li>
  </ul>
`);

export const emailService = {
    async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
        if (!RESEND_API_KEY) {
            console.warn('Resend API key missing in Expo config. Email not sent.');
            return false;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: FROM_EMAIL,
                    to: [to],
                    subject,
                    html,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send email');
            }

            return true;
        } catch (error) {
            console.error('Email sending failed:', error);
            return false;
        }
    },

    async sendStaffInvite(to: string, name: string, code: string, role: string, workshopName?: string) {
        return this.sendEmail(
            to,
            `You're invited to join ${workshopName || 'ABM Workshop'}!`,
            staffInviteTemplate(name, role, code, workshopName)
        );
    },

    async sendWelcomeEmail(to: string, name: string, role?: string) {
        return this.sendEmail(
            to,
            'Welcome to ABM Workshop & Marketplace!',
            welcomeTemplate(name, role)
        );
    }
};
