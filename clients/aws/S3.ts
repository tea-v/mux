import https from 'https';
import { S3 } from 'aws-sdk';

const agent = new https.Agent({
  keepAlive: true,
});

export default new S3({
  httpOptions: {
    agent,
  },
});
