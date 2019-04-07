/* eslint-disable import/prefer-default-export */
/* global MOVIES_BUCKET_NAME:false */

import sharp from 'sharp';
import { CloudFrontResponseHandler } from 'aws-lambda';

import S3 from ':clients/aws/S3';

export const handler: CloudFrontResponseHandler = async (event) => {
  const { request, response } = event.Records[0].cf;
  if (response.status !== '404') {
    return response;
  }
  const key = request.uri.slice(1);
  const pathComponents = key.match(/(.*)\/(\d+)x(\d+)\/(.*)\/(.*)/);
  if (!pathComponents) {
    throw new Error(`Failed to parse ${request.uri}`);
  }
  const [, prefix, width, height, format, imageName] = pathComponents;
  const contentType = `image/${format}`;
  const contentTypeHeader = { key: 'Content-Type', value: contentType };
  const normalizedHeight = +height;
  const normalizedKey = `${prefix}/${imageName}`;
  const normalizedWidth = +width;
  const { Body: sourceImage } = await S3.getObject({
    Bucket: MOVIES_BUCKET_NAME,
    Key: normalizedKey,
  }).promise();
  if (!sourceImage) {
    throw new Error(
      `Source image could not be found at ${MOVIES_BUCKET_NAME}/${key}`
    );
  }
  const resizedImage = await sharp(sourceImage as Buffer)
    .resize(normalizedWidth, normalizedHeight)
    .toFormat(format)
    .toBuffer();
  S3.putObject({
    Body: resizedImage,
    Bucket: MOVIES_BUCKET_NAME,
    CacheControl: 'max-age=31536000',
    ContentType: contentType,
    Key: key,
  }).promise();
  return {
    ...response,
    body: resizedImage.toString('base64'),
    bodyEncoding: 'base64' as 'base64',
    headers: {
      ...response.headers,
      'content-type': [contentTypeHeader],
    },
    status: '200',
  };
};
