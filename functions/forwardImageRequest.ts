/* eslint-disable import/prefer-default-export */

import querystring from 'querystring';
import {
  CloudFrontRequest,
  CloudFrontRequestHandler,
  CloudFrontResultResponse,
} from 'aws-lambda';

import { handler as authorizeUser } from './authorizeUser';

const MAX_WIDTH = 2160;
const MIN_WIDTH = 100;

function getNormalizedDimensions(width: number, height: number) {
  const aspectRatio = width / height;
  const nearestWidth = Math.round(width / 100) * 100;
  const normalizedWidth = Math.max(
    Math.min(nearestWidth, MAX_WIDTH),
    MIN_WIDTH
  );
  const normalizedHeight = Math.round((1 / aspectRatio) * normalizedWidth);
  return [normalizedWidth, normalizedHeight];
}

function isAuthorized(
  request: CloudFrontRequest | CloudFrontResultResponse
): request is CloudFrontRequest {
  return (request as CloudFrontResultResponse).status !== '401';
}

export const handler: CloudFrontRequestHandler = async (...args) => {
  const request = await authorizeUser(...args);
  if (!request || !isAuthorized(request)) {
    return request || null;
  }
  const { d: dimensions, f: format } = querystring.parse(request.querystring);
  if (!dimensions) {
    return request;
  }
  const requestPathComponents = request.uri.match(/(.*)\/(.*)\.(.*)/);
  if (!requestPathComponents) {
    throw new Error(`Failed to parse ${request.uri}`);
  }
  const [, prefix, imageName, extension] = requestPathComponents;
  const [width, height] = (dimensions as string).split('x');
  const [normalizedWidth, normalizedHeight] = getNormalizedDimensions(
    Math.abs(+width || 1),
    Math.abs(+height || 1)
  );
  const forwardedPathComponents = [
    prefix,
    `${normalizedWidth}x${normalizedHeight}`,
    format || extension,
    `${imageName}.${extension}`,
  ];
  request.uri = forwardedPathComponents.join('/');
  return request;
};
