import 'dotenv/config';
import { SESv2Client, GetAccountCommand, GetEmailIdentityCommand } from '@aws-sdk/client-sesv2';
import { smtpTransport, validateMailConfig } from '../apps/api/src/mail';
async function main() {
  validateMailConfig();
  if (!process.env.EMAIL_PROVIDER || process.env.EMAIL_PROVIDER === 'local') {
    console.log('LOCAL PREVIEW ONLY. Emails are saved in the database; no inbox delivery. Configure EMAIL_PROVIDER, EMAIL_FROM and SMTP_URL (or SES credentials).');
    return;
  }
  if (process.env.EMAIL_PROVIDER === 'smtp') {
    const transport = smtpTransport();
    try { await transport.verify(); console.log('SMTP connection and authentication verified. Sender acceptance and inbox delivery still require a test email.'); }
    finally { transport.close(); }
  } else {
    const ses = new SESv2Client({ region: process.env.AWS_REGION });
    const account = await ses.send(new GetAccountCommand({}));
    const from = process.env.EMAIL_FROM!.match(/<([^>]+)>/)?.[1] || process.env.EMAIL_FROM!;
    console.log({ provider: 'ses', sendingEnabled: account.SendingEnabled, productionAccess: account.ProductionAccessEnabled });
    // A sender may be verified individually or through its domain.
    for (const identity of [from, from.split('@')[1]]) {
      try {
        const result = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: identity }));
        if (result.VerifiedForSendingStatus) { console.log('Sender identity verified.'); return; }
      } catch (error) { if ((error as Error).name !== 'NotFoundException') throw error; }
    }
    throw new Error('Verify your sender email or domain in SES');
  }
}
main().catch(error => { console.error('Email configuration check failed:', error.name); process.exitCode = 1; });
