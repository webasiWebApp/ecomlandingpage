import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.static(__dirname));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Form submission endpoint
app.post('/api/submit-form', async (req, res) => {
  try {
    const { name, business, phone, whatsapp, package: pkg, message } = req.body;

    // Validate required fields
    if (!name || !business || !phone || !pkg) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Prepare email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0E7C63; border-bottom: 2px solid #E8A13B; padding-bottom: 10px;">
          New AVIX Inquiry from Storepolio Website
        </h2>
        
        <div style="background: #F5F6F1; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p style="margin: 8px 0;"><strong>Business Type:</strong> ${escapeHtml(business)}</p>
          <p style="margin: 8px 0;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>
          <p style="margin: 8px 0;"><strong>WhatsApp:</strong> ${escapeHtml(whatsapp)}</p>
          <p style="margin: 8px 0;"><strong>Package:</strong> ${escapeHtml(pkg)}</p>
          ${message ? `<p style="margin: 8px 0;"><strong>Message:</strong> ${escapeHtml(message)}</p>` : ''}
        </div>

        <div style="margin: 20px 0; padding: 15px; background: #DFF0EA; border-left: 4px solid #0E7C63; border-radius: 4px;">
          <p style="margin: 0; color: #0A5C49;">
            <strong>Next Step:</strong> Contact this client via WhatsApp: 
            <a href="https://wa.me/${whatsapp}" style="color: #0E7C63; text-decoration: none; font-weight: bold;">
              +${formatPhoneNumber(whatsapp)}
            </a>
          </p>
        </div>

        <p style="font-size: 12px; color: #4E5A52; margin-top: 30px; border-top: 1px solid #DEE3D8; padding-top: 15px;">
          Submitted from: Storepolio Website Landing Page<br>
          Time: ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    const emailText = `
AVIX Storepolio Website - New Inquiry

Name: ${name}
Business Type: ${business}
Phone: ${phone}
WhatsApp: +${formatPhoneNumber(whatsapp)}
Package: ${pkg}
${message ? `Message: ${message}` : ''}

Contact via WhatsApp: https://wa.me/${whatsapp}
    `;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: 'AVIX <noreply@resend.dev>',
      to: process.env.NEXT_PUBLIC_RECEIVER_EMAIL,
      replyTo: phone ? `tel:${phone}` : undefined,
      subject: `New AVIX Inquiry: ${name} - ${business}`,
      html: emailHtml,
      text: emailText,
    });

    if (emailResponse.error) {
      console.error('Resend Error:', emailResponse.error);
      return res.status(500).json({ 
        error: 'Failed to send email',
        details: emailResponse.error 
      });
    }

    // Log successful submission
    console.log(`✓ Form submitted - ID: ${emailResponse.data.id}, From: ${name} (${business})`);

    res.json({ 
      success: true, 
      message: 'Form submitted successfully',
      emailId: emailResponse.data.id 
    });

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      error: 'Server error processing form',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Middleware Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  AVIX Storepolio Form Server Running   ║
╠════════════════════════════════════════╣
║  URL: http://localhost:${PORT}                ║
║  API: POST /api/submit-form            ║
║  Health: GET /health                   ║
║  API Key: ${process.env.RESEND_API_KEY ? '✓ Loaded' : '✗ Missing'}              ║
║  Receiver: ${process.env.NEXT_PUBLIC_RECEIVER_EMAIL}       ║
╚════════════════════════════════════════╝
  `);
});

// Helper function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Helper function to format phone number
function formatPhoneNumber(phone) {
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Add country code if not present
  return cleaned.startsWith('94') ? cleaned : '94' + cleaned;
}
