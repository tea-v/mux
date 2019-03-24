/* eslint-disable import/prefer-default-export */
/* global USER_POOL_URL:false USER_POOL_PUBLIC_KEYS:false */

import jwkToPem from 'jwk-to-pem';
import jwt from 'jsonwebtoken';
import { CloudFrontResponseHandler } from 'aws-lambda';

const getCertificates = () =>
  USER_POOL_PUBLIC_KEYS.reduce<{ [key: string]: string }>((acc, publicKey) => {
    const { e, kid, kty, n } = publicKey;
    acc[kid] = jwkToPem({ e, kty, n });
    return acc;
  }, {});

const unauthorizedResponse = {
  status: '401',
  statusDescription: 'Unauthorized',
};

export const handler: CloudFrontResponseHandler = async (event) => {
  const { request } = event.Records[0].cf;
  const { headers } = request;
  if (!headers.authorization) {
    return unauthorizedResponse;
  }
  const token = headers.authorization[0].value.slice(7);
  const decodedJWT = jwt.decode(token, { complete: true });
  if (
    !decodedJWT ||
    typeof decodedJWT === 'string' ||
    decodedJWT.payload.iss !== USER_POOL_URL ||
    decodedJWT.payload.token_use !== 'access'
  ) {
    return unauthorizedResponse;
  }
  const certificate = (await getCertificates())[decodedJWT.header.kid];
  if (!certificate) {
    return unauthorizedResponse;
  }
  jwt.verify(token, certificate, { issuer: USER_POOL_URL }, (err) => {
    if (err) {
      return unauthorizedResponse;
    }
    delete headers.authorization;
    return request;
  });
  return unauthorizedResponse;
};
