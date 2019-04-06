function getAssociations(resources) {
  const distributions = Object.values(resources).filter(
    ({ Type }) => Type === 'AWS::CloudFront::Distribution'
  );
  return distributions.reduce(
    (
      acc,
      {
        Properties: {
          DistributionConfig: { CacheBehaviors = [], DefaultCacheBehavior },
        },
      }
    ) => {
      const associations = CacheBehaviors.reduce(
        (cacheBehaviors, { LambdaFunctionAssociations }) =>
          cacheBehaviors.concat(LambdaFunctionAssociations),
        []
      );
      const defaultAssociations =
        DefaultCacheBehavior.LambdaFunctionAssociations || [];
      acc.push(...defaultAssociations, ...associations);
      return acc;
    },
    []
  );
}

function getVersionedARN(compiledResourceEntries, arn) {
  const [key] =
    compiledResourceEntries.find(
      ([
        ,
        {
          Properties: { FunctionName: { Ref } = {} },
          Type,
        },
      ]) => Ref === arn && Type === 'AWS::Lambda::Version'
    ) || [];
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
      provider: {
        compiledCloudFormationTemplate: { Resources: compiledResources },
      },
      resources: { Resources: resources },
    } = this.serverless.service;
    const associations = getAssociations(resources);
    associations.forEach((association) => {
      const { LambdaFunctionARN: arn } = association;
      if (arn) {
        const versionedARN = getVersionedARN(
          Object.entries(compiledResources),
          arn
        );
        if (versionedARN) {
          Object.assign(association, { LambdaFunctionARN: versionedARN });
        }
      }
    });
  }
}

module.exports = UpdateFunctionVersions;
