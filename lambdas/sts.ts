import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';

const stsClient = new STSClient();
const ONE_WEEK_IN_MS = 604_800_000;
let expiration: Date | undefined;
export const logger = console;

export const getCredentials = async ({ sourceAccount, remoteRoleName }: { sourceAccount: string; remoteRoleName: string }) => {
  const roleArn = `arn:aws:iam::${sourceAccount}:role/${remoteRoleName}`;

  logger.info(`Assuming role: ${roleArn}`);

  const { Credentials } = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: `arn:aws:iam::${sourceAccount}:role/${remoteRoleName}`,
      RoleSessionName: 'capture-sync',
    }),
  );

  if (!Credentials || !Credentials.AccessKeyId || !Credentials.SecretAccessKey) throw new Error('Failed to assume role');

  expiration = Credentials.Expiration ?? new Date(Date.now() + ONE_WEEK_IN_MS);

  logger.info(`Role assumed (expiration = ${expiration.toISOString()})`);

  return {
    accessKeyId: Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretAccessKey,
    sessionToken: Credentials.SessionToken,
    expiration,
  };
};
