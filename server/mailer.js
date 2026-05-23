const nodemailer = require("nodemailer");

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendEmail({ to, subject, html }) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log("Email not sent. Configure SMTP in .env.");
    console.log({ to, subject, html });
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html
  });
}

module.exports = { sendEmail };
