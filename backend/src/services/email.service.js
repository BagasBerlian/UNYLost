// For development, we'll log emails to console
// In production, you would use a real email service like Nodemailer

class EmailService {
  async sendVerificationEmail(email, name, verificationCode) {
    // In a real application, this would send an actual email
    console.log("========== VERIFICATION EMAIL ==========");
    console.log(`To: ${email}`);
    console.log(`Subject: Verify Your UNYLost Account`);
    console.log(`Hello ${name},`);
    console.log(`Your verification code is: ${verificationCode}`);
    console.log(`This code will expire in 10 minutes.`);
    console.log("=======================================");

    // Return success for development
    return true;
  }

  async sendWelcomeEmail(email, name) {
    console.log("========== WELCOME EMAIL ==========");
    console.log(`To: ${email}`);
    console.log(`Subject: Welcome to UNYLost!`);
    console.log(`Hello ${name},`);
    console.log(
      `Thank you for registering with UNYLost. Your account has been verified.`
    );
    console.log(
      `You can now start using our service to report lost and found items.`
    );
    console.log("=======================================");

    return true;
  }

  async sendPasswordResetEmail(email, name, resetLink) {
    console.log("========== PASSWORD RESET EMAIL ==========");
    console.log(`To: ${email}`);
    console.log(`Subject: Reset Your UNYLost Password`);
    console.log(`Hello ${name},`);
    console.log(
      `You requested a password reset. Click the link below to set a new password:`
    );
    console.log(resetLink);
    console.log(`This link will expire in 1 hour.`);
    console.log("=======================================");

    return true;
  }

  async sendItemMatchAlert(email, matchData) {
    console.log("========== ITEM MATCH ALERT ==========");
    console.log(`To: ${email}`);
    console.log(`Subject: We Found a Match for Your Item!`);
    console.log(`Hello,`);
    console.log(
      `We found a potential match for your ${matchData.itemType} item "${matchData.itemName}"`
    );
    console.log(`Similarity: ${matchData.similarity}%`);
    console.log(`Check your account for details.`);
    console.log("=======================================");

    return true;
  }

  async sendClaimNotificationEmail(email, claimData) {
    console.log("========== CLAIM NOTIFICATION ==========");
    console.log(`To: ${email}`);
    console.log(`Subject: New Claim for Your Found Item`);
    console.log(`Hello,`);
    console.log(`Someone has claimed your found item "${claimData.itemName}"`);
    console.log(`Check your account to review and respond to this claim.`);
    console.log("=======================================");

    return true;
  }
}

module.exports = new EmailService();
