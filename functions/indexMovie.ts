/* eslint-disable import/prefer-default-export */
/* global OMDB_API_KEY:false */

import fetch from 'node-fetch';
import uuid from 'uuid/v1';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { S3Handler } from 'aws-lambda';

import DynamoDB from ':clients/aws/DynamoDB';
import OMDB from ':types/_omdb';
import S3 from ':clients/aws/S3';

const MAX_POSTER_WIDTH = 2160;

interface AttributeMap {
  [key: string]: AttributeMap | boolean | number | string;
}

enum MIMEType {
  mkv = 'video/x-matroska',
  mp4 = 'video/mp4',
}

type Extension = keyof typeof MIMEType;

function getCloudFrontUrl(key: string) {
  return `${process.env.CLOUDFRONT_URL}/${key}`;
}

async function putPoster(posterUrl: string, bucketName: string) {
  const key = `images/${uuid()}.jpg`;
  const poster = await fetch(posterUrl).then(({ buffer }) => buffer());
  S3.putObject({
    Body: poster,
    Bucket: bucketName,
    CacheControl: 'max-age=31536000',
    ContentType: 'image/jpeg',
    Key: key,
  }).promise();
  return getCloudFrontUrl(key);
}

async function getMovieInfo({
  bucketName,
  key,
  releaseYear,
  title,
}: {
  bucketName: string;
  key: string;
  releaseYear: string;
  title: string;
}) {
  const titleParam = encodeURIComponent(title);
  const response: OMDB['Response'] = await fetch(
    `http://www.omdbapi.com?apikey=${OMDB_API_KEY}&t=${titleParam}&y=${releaseYear}`
  ).then(({ json }) => json());
  const poster = await putPoster(
    response.Poster.replace(/_SX\d+/, `_SX${MAX_POSTER_WIDTH}`),
    bucketName
  );
  return {
    actors: response.Actors,
    country: response.Country,
    createdAt: Date.now(),
    director: response.Director,
    duration: response.Runtime,
    genre: response.Genre,
    id: uuid(),
    language: response.Language,
    metascore: response.Metascore,
    plot: response.Plot,
    poster,
    rating: response.Rated,
    releasedAt: new Date(response.Released).getTime(),
    title: response.Title,
    video: { src: getCloudFrontUrl(key) },
  };
}

function getAttributeMap(object: AttributeMap) {
  return Object.entries(object).reduce<DocumentClient.PutItemInputAttributeMap>(
    (acc, [key, value]) => {
      switch (typeof value) {
        case 'boolean':
          acc[key] = { BOOL: value };
          break;
        case 'number':
          acc[key] = { N: `${value}` };
          break;
        case 'object':
          acc[key] = { M: getAttributeMap(value) };
          break;
        case 'string':
          acc[key] = { S: value };
          break;
        default:
      }
      return acc;
    },
    {}
  );
}

export const handler: S3Handler = async (event) => {
  const {
    bucket: { name: bucketName },
    object: { key },
  } = event.Records[0].s3;
  const srcKey = key.replace(/\+/g, ' ');
  // Matches any key of the format 'The Fifth Element (1997).mkv'
  const srcKeyComponents = srcKey.match(/(.*) \((.*)\)\.([^.]*)/);
  if (!srcKeyComponents) {
    throw new Error(`Failed to parse ${key}`);
  }
  const [, title, releaseYear, extension] = srcKeyComponents;
  if (!MIMEType[extension as Extension]) {
    return;
  }
  const movieInfo = await getMovieInfo({ bucketName, key, releaseYear, title });
  DynamoDB.put({
    Item: getAttributeMap(movieInfo),
    TableName: 'movies',
  }).promise();
};
