/* eslint-disable @typescript-eslint/no-var-requires, import/no-extraneous-dependencies */

const findKey = require('lodash/findKey');
const flatMap = require('lodash/flatMap');
const get = require('lodash/get');
const pickBy = require('lodash/pickBy');

function getAssociations(resources) {
  const distributions = pickBy(resources, {
    Type: 'AWS::CloudFront::Distribution',
  });
  return flatMap(distributions, (distribution) => {
    const associations = get(
      distribution,
      'Properties.DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations',
      []
    );
    const cacheBehaviors = get(
      distribution,
      'Properties.DistributionConfig.CacheBehaviors',
      []
    );
    return associations.concat(
      flatMap(cacheBehaviors, (cacheBehavior) =>
        get(cacheBehavior, 'LambdaFunctionAssociations', [])
      )
    );
  });
}

function getVersionedARN(resources, arn) {
  const key = findKey(resources, {
    Properties: {
      FunctionName: {
        Ref: arn,
      },
    },
    Type: 'AWS::Lambda::Version',
  });
  return (
    key && {
      'Fn::Join': [
        '',
        [
          { 'Fn::GetAtt': [arn, 'Arn'] },
          ':',
          { 'Fn::GetAtt': [key, 'Version'] },
        ],
      ],
    }
  );
}

class UpdateFunctionVersions {
  constructor(serverless) {
    this.hooks = {
      'before:package:finalize': this.updateFunctionVersions.bind(this),
    };
    this.serverless = serverless;
  }

  updateFunctionVersions() {
    const {
      provider,
      resources: { Resources: resources },
    } = this.serverless.service;
    const associations = getAssociations(resources);
    const compiledResources = provider.compiledCloudFormationTemplate.Resources;
    associations.forEach((association) => {
      const arn = association.LambdaFunctionARN;
      const versionedARN = getVersionedARN(compiledResources, arn);
      if (arn && versionedARN) {
        // eslint-disable-next-line no-param-reassign
        association.LambdaFunctionARN = versionedARN;
      }
    });
  }
}

module.exports = UpdateFunctionVersions;
